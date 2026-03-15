import { pg } from "../../utils/KnexHelper.js";
import log from "../../common/logger.js";
import cfg from "../../common/config.js";
import redis from "../../utils/RedisHelper.js";
import { hashPassword, verifyPassword } from "../../utils/CryptoHelper.js";
import StatusError from "../../exceptions/StatusError.js";
import jwtHelper from "../../utils/JwtHelper.js";
import crypto from "crypto";
import { encode, decode } from "../../utils/UuidBase64.js";
import { transporter } from "../../utils/EmailHelper.js";
import type { RegisterInput, TokenPair, UserDto } from "../../types/index.js";

export const AccountStatus = Object.freeze({
  ACTIVE: 1,
  BLOCKED: 2,
  TEMPORARY_BLOCKED: 3,
} as const);

export const AccountRole = Object.freeze({
  GUEST: 1,
  ADMIN: 2,
  MANAGER: 3,
  OPERATOR: 4,
  REGISTERED: 5,
} as const);

const ACTIVATION_CODE_PREFIX = "act_";

interface AccountRow {
  id: number;
  uid: string;
  email: string;
  passwd: string;
  roles: string[] | null;
}

interface ActivationResult extends TokenPair {}

class UserService {
  async registerUser(
    user: RegisterInput,
    baseUrl: string,
  ): Promise<{ user_id: string }> {
    try {
      log.debug(`hashing password for user ${user.email}`);
      const encodedPassword = await hashPassword(user.password);

      log.debug(`registering user ${user.email}`);
      const userData = await pg
        .with("new_user", (q) => {
          q.insert({
            login: user.login,
            passwd: encodedPassword,
            email: user.email,
            name: user.name,
            start_date: new Date(),
            status: AccountStatus.BLOCKED,
          })
            .into("account")
            .returning(["id", "uid"]);
        })
        .with("new_role", (q) => {
          q.insert(
            pg
              .select({
                account_id: pg.ref("new_user.id"),
                role_id: AccountRole.REGISTERED,
              })
              .from("new_user"),
          ).into(pg.raw("account_roles (account_id, role_id)"));
        })
        .select("uid")
        .from("new_user");

      const userUuid: string = userData[0]?.uid;
      const user_id = encode(userUuid);

      log.debug(`generating activation code for user ${user.email}`);
      const activationCode = encode(crypto.randomUUID());

      log.debug(`saving activation code to redis, user_id: ${user_id}`);
      await redis.setex(
        ACTIVATION_CODE_PREFIX + activationCode,
        cfg.get("USER_ACTIVATION_DELAY"),
        userUuid,
      );

      const activationUrl = `${baseUrl}/api/auth/activate/${encodeURIComponent(activationCode)}`;
      const mailOptions = {
        from: cfg.get("EMAIL_SMTP_USER"),
        to: user.email,
        subject: "Activation email",
        text: `Please click this link to activate your account: ${activationUrl}`,
        html: `<h1>Hi, ${user.name ?? user.login}!</h1><p>Please click this link to activate your account: <a href="${activationUrl}">${activationUrl}</a>.</p>`,
      };

      log.debug(
        `sending mail to: ${user.email}, activationCode: ${activationCode}`,
      );
      transporter.sendMail(
        mailOptions,
        (error: Error | null, info: { response: string }) => {
          if (error) {
            log.error("Error sending email to: " + user.email, error);
          } else {
            log.info(
              `Email sent to: ${user.email}, response: ${info.response}`,
            );
          }
        },
      );

            // log.debug(`queuing user: ${userWithCodeStr}`);
      // await producer.connect();
      // await producer.send({
      //   topic: cfg.get("KAFKA_ACTIVATION_TOPIC"),
      //   messages: [{ key: activationCode, value: userWithCodeStr }],
      //   timeout: 15000,
      //   compression: CompressionTypes.Snappy,
      // });
      // await producer.disconnect();
      // log.debug(`user ${user.email} was sent to queue`);

      return { user_id };
    } catch (err: unknown) {
      const pg_err = err as { code?: string; constraint?: string };
      if (pg_err.code === "23505" && pg_err.constraint === "account_login_uq") {
        throw new StatusError(409, "USER_ALREADY_EXISTS");
      }
      throw err;
    }
  }

  async activate(activationCode: string): Promise<ActivationResult> {
    log.debug(`extracting user from redis, activationCode: ${activationCode}`);
    const userUuid = await redis.get(ACTIVATION_CODE_PREFIX + activationCode);
    if (!userUuid) {
      log.warn(`no activationCode: ${activationCode} exists`);
      throw new Error("ACTIVATION_CODE_NOT_EXISTS");
    }

    log.debug(`activating user with UUID ${userUuid}`);
    const userData = await pg
      .with(
        "update_user",
        pg("account")
          .update({ status: AccountStatus.ACTIVE })
          .where("uid", userUuid)
          .returning(["id", "email"]),
      )
      .select(
        "email",
        pg.raw("? as roles", [
          pg("role")
            .select(pg.raw("json_agg(role.name)"))
            .join("account_roles", "account_roles.role_id", "role.id")
            .where("account_roles.account_id", pg.ref("update_user.id")),
        ]),
      )
      .from("update_user")
      .where({ id: pg.ref("update_user.id") });

    const email: string = userData[0]?.email;
    const roles: string[] = userData[0]?.roles;
    const user_id = encode(userUuid);

    const access_token = await this.generateAccessToken({
      user_id,
      email,
      roles,
    });
    const refresh_token = await this.generateRefreshToken({ user_id });

    await redis.del(ACTIVATION_CODE_PREFIX + activationCode);
    return { user_id, access_token, refresh_token };
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const start = performance.now();

    const userData = await pg("account")
      .select<AccountRow[]>([
        "account.uid",
        "account.passwd",
        pg.raw("? as roles", [
          pg("role")
            .select(pg.raw("json_agg(role.name)"))
            .join("account_roles", "account_roles.role_id", "role.id")
            .where("account_roles.account_id", pg.raw("account.id")),
        ]),
      ])
      .where({ email, status: AccountStatus.ACTIVE });

    const user = userData[0];
    log.info(`DB extract in ${(performance.now() - start).toFixed(2)}ms`);

    if (!user) throw new Error("USER_NOT_FOUND");
    const matches = await verifyPassword(password, user.passwd);
    log.info(`Check password in ${(performance.now() - start).toFixed(2)}ms`);

    if (!matches) throw new StatusError(401, "UNAUTHORIZED");

    const user_id = encode(user.uid);
    const access_token = await this.generateAccessToken({
      user_id,
      email,
      roles: user.roles ?? [],
    });
    log.info(`AC generated in ${(performance.now() - start).toFixed(2)}ms`);

    const refresh_token = await this.generateRefreshToken({ user_id });
    log.info(`RT generated in ${(performance.now() - start).toFixed(2)}ms`);

    return { user_id, access_token, refresh_token };
  }

  async refreshToken(user_id: string, token: string): Promise<TokenPair> {
    //TODO check refresh token jti in redis blacklist (when logout), and this check should be moved to the middleware
    const is_blacklisted = await redis.get(`blacklist_${token}`);
    if (is_blacklisted) throw new StatusError(401, "UNAUTHORIZED");

    const uid = decode(user_id);
    const userData = await pg("account")
      .select<Pick<AccountRow, "email" | "roles">[]>([
        "email",
        pg.raw("? as roles", [
          pg("role")
            .select(pg.raw("json_agg(role.name)"))
            .join("account_roles", "account_roles.role_id", "role.id")
            .where("account_roles.account_id", pg.raw("account.id")),
        ]),
      ])
      .where({ uid, status: AccountStatus.ACTIVE });

    const user = userData[0];
    if (!user) throw new StatusError(401, "UNAUTHORIZED");
    log.debug(`user extracted by id: ${user_id}`);

    const access_token = await this.generateAccessToken({
      user_id,
      email: user.email,
      roles: user.roles ?? [],
    });
    const refresh_token = await this.generateRefreshToken({ user_id });
    return { user_id, access_token, refresh_token };
  }

  async get(user_id: string): Promise<UserDto> {
    const uid = decode(user_id);
    const userData = await pg("account")
      .select<
        Pick<
          AccountRow & {
            login: string;
            name: string | null;
            start_date: Date;
            status: number;
          },
          "login" | "email" | "name" | "start_date" | "status"
        >[]
      >("login", "email", "name", "start_date", "status")
      .where({ uid });

    const user = userData[0];
    if (!user) throw new Error("USER_NOT_FOUND");
    log.debug(`user extracted by id: ${user_id}`);
    return {
      user_id,
      login: user.login,
      email: user.email,
      name: user.name,
      start_date: user.start_date,
      status: user.status,
    };
  }

  async update(user: {
    user_id: string;
    login: string;
    email: string;
    name?: string;
  }): Promise<typeof user> {
    log.debug(`updating user ${user.email}`);
    const userData = await pg("account")
      .update({ login: user.login, email: user.email, name: user.name })
      .where("uid", decode(user.user_id))
      .returning(["login", "email", "name", "start_date", "status"]);
    if (!userData[0]) throw new Error("USER_NOT_FOUND");
    log.debug(`user updated: ${JSON.stringify(user)}`);
    return user;
  }

  async delete(id: string): Promise<UserDto> {
    const uid = decode(id);
    const userData = await pg("account")
      .delete()
      .returning(["login", "email", "name", "start_date", "status"])
      .where({ uid });

    const user = userData[0];
    if (!user) throw new Error("USER_NOT_FOUND");
    log.info(`user deleted by id: ${id}`);
    return {
      user_id: id,
      login: user.login,
      email: user.email,
      name: user.name,
      start_date: user.start_date,
      status: user.status,
    };
  }

  async logout(accessToken: string, accessTtl: number, refreshToken: string, refreshTtl: number): Promise<void> {
    if (accessTtl > 0) {
      await redis.setex(`blacklist_${accessToken}`, accessTtl, 1);
    }
    if (refreshTtl > 0) {
      await redis.setex(`blacklist_${refreshToken}`, refreshTtl, 1);
    }
    log.info(`tokens blacklisted in redis`);
  }

  private async generateAccessToken(payload: {
    user_id: string;
    email: string;
    roles: string[];
  }): Promise<string> {
    return jwtHelper.getAccessToken(payload);
  }

  private async generateRefreshToken(payload: {
    user_id: string;
  }): Promise<string> {
    return jwtHelper.getRefreshToken(payload);
  }
}

export default new UserService();
