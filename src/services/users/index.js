const { pg } = require("../../utils/KnexHelper");
const log = require("../../common/logger");
const cfg = require("../../common/config");
const redis = require("../../utils/RedisHelper");
const bcrypt = require("bcryptjs");
//const moment = require("moment");
const StatusError = require("../../exceptions/StatusError");
const jwtHelper = require("../../utils/JwtHelper");
const crypto = require("crypto");
const { encode, decode } = require("../../utils/UuidBase64");
const { transporter } = require("../../utils/EmailHelper");

const AccountStatus = Object.freeze({
  ACTIVE: 1,
  BLOCKED: 2,
  TEMPORARY_BLOCKED: 3,
});

const AccountRole = Object.freeze({
  GUEST: 1,
  ADMIN: 2,
  MANAGER: 3,
  OPERATOR: 4,
  REGISTERED: 5,
});

//const { producer, CompressionTypes } = require("../../utils/KafkaHelper");

const ACTIVATION_CODE_PREFIX = "act_";

class UserService {
  async registerUser(user, baseUrl) {
    try {
      log.debug(`registering user ${user.email}`);
      const userData = await pg
        .with("new_user", (q) => {
          q.insert({
            login: user.login,
            passwd: bcrypt.hashSync(user.password, 10),
            email: user.email,
            name: user.name,
            start_date: new Date(), //moment().utc().format("YYYY-MM-DD HH:mm:ss.SSS")
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
              .from("new_user")
          ).into(pg.raw("acl (account_id, role_id)"));
        })
        .select("uid")
        .from("new_user");
      const userUuid = userData[0]?.uid;
      const user_id = encode(userUuid);

      log.debug(`generating activation code for user ${user.email}`);
      const activationCode = encode(crypto.randomUUID());

      log.debug(
        `saving user to redis, activationCode: ${activationCode}, user_id: ${user_id}`
      );
      await redis.setex(
        ACTIVATION_CODE_PREFIX + activationCode,
        cfg.get("USER_ACTIVATION_DELAY"),
        userUuid
      );

      //sending email
      const activationUrl = baseUrl + "/api/auth/activate/" + encodeURIComponent(activationCode);
      const mailOptions = {
        from: cfg.get("EMAIL_SMTP_USER"),
        to: user.email,
        subject: 'Activation email',
        text: 'Please click this link to activate your account: ' + activationUrl,
        html: `<h1>Hi, ${user.name}!</h1><p>Please click this link to activate your account: <a href="${activationUrl}">${activationUrl}</a>.</p>`,
      };

      log.debug(
        `sending mail to: ${user.email}, activationCode: ${activationCode}, user_id: ${user_id}`
      );
      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          log.error('Error sending email to: ' + user.email, error);
        } else {
          log.info('Email was successfully sent to: ' + user.email + ' , with response: ' + info.response);
        }
      });

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
    } catch (err) {
      if (err.code === "23505" && err.constraint === "login_idx") {
        throw new StatusError(409, "USER_ALREADY_EXISTS");
      }
      throw err;
    }
  }

  async activate(activationCode) {
    log.debug(`extracting user from redis, activationCode: ${activationCode}`);
    const userUuid = await redis.get(ACTIVATION_CODE_PREFIX + activationCode);
    if (!userUuid) {
      log.warn(`no activationCode: ${activationCode} exists`);
      throw new Error("ACTIVATION_CODE_NOT_EXISTS");
    }
    log.debug(`saving user with ID ${userUuid} to the DB`);
    const userData = await pg
      .with(
        "update_user",
        pg("account")
          .update({
            status: AccountStatus.ACTIVE,
          })
          .where("uid", userUuid)
          .returning(["id", "email"])
      )
      .select(
        "email",
        pg.raw("? as roles", [
          pg("role")
            .select(pg.raw("json_agg(role.name)"))
            .join("acl", "acl.role_id", "role.id")
            .where("acl.account_id", pg.ref("update_user.id")),
        ])
      )
      .from("update_user")
      .where({ id: pg.ref("update_user.id") });
    const email = userData[0]?.email;
    const roles = userData[0]?.roles;

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

  async login(email, password) {
    const userData = await pg("account")
      .select([
        "account.uid",
        "account.passwd",
        pg.raw("? as roles", [
          pg("role")
            .select(pg.raw("json_agg(role.name)"))
            .join("acl", "acl.role_id", "role.id")
            .where("acl.account_id", pg.raw("account.id")),
        ]),
      ])
      .where({ email, status: AccountStatus.ACTIVE });
    const user = userData[0];
    if (!user) throw new Error("USER_NOT_FOUND");
    const matches = bcrypt.compareSync(password, user.passwd);
    if (!matches) throw new StatusError(401, "UNAUTHORIZED");
    //generate token
    const user_id = encode(user.uid);
    const access_token = await this.generateAccessToken({
      user_id,
      email,
      roles: user.roles,
    });
    const refresh_token = await this.generateRefreshToken({ user_id });
    return { user_id, access_token, refresh_token };
  }

  async refreshToken(user_id) {
    //TODO check refresh token jti in redis blacklist (when logout)
    const uid = decode(user_id);
    const userData = await pg("account")
      .select([
        "email",
        pg.raw("? as roles", [
          pg("role")
            .select(pg.raw("json_agg(role.name)"))
            .join("acl", "acl.role_id", "role.id")
            .where("acl.account_id", pg.raw("account.id")),
        ]),
      ])
      .where({ uid, status: AccountStatus.ACTIVE });

    const user = userData[0];
    if (!user) throw new StatusError(401, "UNAUTHORIZED");
    log.debug(
      `user extracted by id: ${user_id}, user: ${JSON.stringify(user)}`
    );

    //generate token
    const access_token = await this.generateAccessToken({
      user_id,
      email: user.email,
      roles: user.roles,
    });
    const refresh_token = await this.generateRefreshToken({ user_id });
    return { user_id, access_token, refresh_token };
  }

  async generateAccessToken(user) {
    return await jwtHelper.getAccessToken(user);
  }
  async generateRefreshToken(obj) {
    return await jwtHelper.getRefreshToken(obj);
  }

  async get(user_id) {
    const uid = decode(user_id);
    const userData = await pg("account")
      .select("login", "email", "name", "start_date", "status")
      .where({ uid });

    const user = userData[0];
    if (!user) throw new Error("USER_NOT_FOUND");
    log.debug(
      `user extracted by id: ${user_id}, user: ${JSON.stringify(user)}`
    );
    return {
      user_id,
      login: user.login,
      email: user.email,
      name: user.name,
      start_date: user.start_date,
      status: user.status,
    };
  }

  async update(user) {
    log.debug(`updating user ${user.email}`);
    const userData = await pg("account")
      .update({
        login: user.login,
        passwd: bcrypt.hashSync(user.password, 10),
        email: user.email,
        name: user.name,
      })
      .where("uid", decode(user.user_id));
    if (!userData[0]) throw new Error("USER_NOT_FOUND");

    log.debug(`user updated: ${JSON.stringify(user)}`);
    return user;
  }

  async delete(id) {
    const uid = decode(id);
    const userData = await pg("account")
      .delete()
      .returning("login", "email", "name", "start_date", "status")
      .where({ uid });

    const user = userData[0];
    if (!user) throw new Error("USER_NOT_FOUND");
    log.debug(`user deleted by id: ${id}, user: ${JSON.stringify(user)}`);
    return {
      user_id: id,
      login: user.login,
      email: user.email,
      name: user.name,
      start_date: user.start_date,
      status: user.status,
    };
  }
}

module.exports = new UserService();
