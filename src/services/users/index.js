const pg = require("../../utils/PostresHelper");
const log = require("../../common/logger");
const cfg = require("../../common/config");
const redis = require("../../utils/RedisHelper");
const nanoid = require("nanoid");
const bcrypt = require("bcrypt");
const moment = require("moment");
const StatusError = require("../../exceptions/StatusError");
const sqlFilter = require("../../utils/SqlFilterBuilder");
const jwtHelper = require("../../utils/JwtHelper");
const { encodeId } = require("../../utils/hashids");
const { producer, CompressionTypes } = require("../../utils/KafkaHelper");

const ACTIVATION_CODE_PREFIX = "act_";

class UserService {
  async createUser(user) {
    const existingUser = await this.getByEmail(user.email);
    if (!!existingUser) throw new Error("USER_ALREADY_EXISTS");

    log.debug(`generating activation code for user ${user.email}`);
    const activationCode = nanoid(10);
    user.password = bcrypt.hashSync(user.password, 10);
    user.created_at = moment().utc().format("YYYY-MM-DD HH:mm:ss.SSS");

    const userStr = JSON.stringify(user);
    const userWithCode = {
      ...user,
      payload: { ...user.payload, activationCode },
    };
    delete userWithCode.password;
    const userWithCodeStr = JSON.stringify(userWithCode);

    log.debug(
      `saving user to redis, activationCode: ${activationCode}, user: ${userStr}`
    );
    await redis.setex(
      ACTIVATION_CODE_PREFIX + activationCode,
      cfg.get("USER_ACTIVATION_DELAY"),
      userStr
    );

    log.debug(`queuing user: ${userWithCodeStr}`);
    await producer.connect();
    await producer.send({
      topic: cfg.get("KAFKA_ACTIVATION_TOPIC"),
      messages: [{ key: activationCode, value: userWithCodeStr }],
      timeout: 15000,
      compression: CompressionTypes.Snappy,
    });
    await producer.disconnect();
    log.debug(`user ${user.email} was sent to queue`);
  }

  async activate(activationCode) {
    log.debug(`extracting user from redis, activationCode: ${activationCode}`);
    const userStr = await redis.get(ACTIVATION_CODE_PREFIX + activationCode);
    if (!userStr) {
      log.warn(
        `user with activationCode: ${activationCode} is absent in redis (wrong code or retention period is expired)`
      );
      throw new Error("ACTIVATION_OBSOLETE");
    }
    log.debug(`saving user to the DB: ${userStr}`);
    const {
      rows: [result],
    } = await pg.query(
      "INSERT INTO jwtup.users(obj) VALUES($1) RETURNING id, obj",
      [userStr]
    );
    await redis.del(ACTIVATION_CODE_PREFIX + activationCode);
    //generate token
    const user = JSON.parse(userStr);
    const user_id = encodeId(result.id);
    const access_token = await this.generateAccessToken(user_id, user);
    return result && { user_id, access_token };
  }

  async login(email, password) {
    const {
      rows: [result],
    } = await pg.query(
      "SELECT id, obj FROM jwtup.users WHERE obj->>'email' = $1",
      [email]
    );
    if (!result) throw new Error("USER_NOT_FOUND");
    const matches = bcrypt.compareSync(password, result.obj.password);
    if (!matches) throw new StatusError(401, "UNAUTHORIZED");
    //generate token
    const user = result.obj;
    delete user.password;
    delete user.ip;
    const user_id = encodeId(result.id);
    const access_token = await this.generateAccessToken(user_id, user);
    return { user_id, access_token };
  }

  async generateAccessToken(user_id, user) {
    const obj = {
      user_id,
      email: user.email,
      securables: user.securables,
    };
    return await jwtHelper.encode(obj);
  }

  async refreshToken(user) {
    return await jwtHelper.encode(user);
  }

  async getJwk() {
    return await jwtHelper.getJwk();
  }

  async update(user) {
    const user_id = user.user_id;
    delete user.user_id;
    const {
      rows: [result],
    } = await pg.query(
      "UPDATE jwtup.users SET obj = obj || $2 WHERE id = $1 RETURNING id, obj",
      [user_id, JSON.stringify(user)]
    );
    log.debug(
      `user updated: user ${JSON.stringify(
        user
      )}, updated user: ${JSON.stringify(result)}`
    );
    return { ...result.obj, user_id: encodeId(result.id) };
  }

  async get(id) {
    const {
      rows: [result],
    } = await pg.query("SELECT id, obj FROM jwtup.users WHERE id = $1", [id]);
    if (!result) return;
    const user = { ...result.obj, user_id: encodeId(result.id) };
    log.debug(`user extracted by id: ${id}, user: ${JSON.stringify(user)}`);
    return user;
  }

  async getByEmail(email) {
    const {
      rows: [result],
    } = await pg.query(
      "SELECT id, obj FROM jwtup.users WHERE obj->>'email' = $1",
      [email]
    );
    if (!result) return;
    const user = { ...result.obj, user_id: encodeId(result.id) };
    log.debug(
      `user extracted by email: ${email}, user: ${JSON.stringify(user)}`
    );
    return user;
  }

  async delete(id) {
    const result = await pg.query(
      "DELETE FROM jwtup.users WHERE id = $1 RETURNING obj",
      [id]
    );
    if (!result) return;
    const user = { ...result.obj, user_id: encodeId(id) };
    log.debug(`user deleted, id: ${id}, user: ${JSON.stringify(user)}`);
    return user;
  }

  async list({ filter, sort, offset, limit }) {
    const sortField = ["email", "created_at"].includes(sort.field);
    const sortOrder = ["asc", "desc"].includes(sort.field);

    // filter.rule.field;
    // filter.rule.op;
    // filter.rule.value;
    const result = await pg.query(
      `SELECT id, obj FROM jwtup.users ${sqlFilter(filter)} ORDER BY obj->>'${
        sort.field
      }' ${sort.order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    log.debug(
      `users extracted by filter: ${filter}, sort.field: ${sort.field}, sort.order: ${sort.order}, offset ${offset}, limit ${limit}. Total results: ${result.rowCount}`
    );
    const users = [];
    result &&
      result.rows.forEach(({ id, obj }) => {
        delete obj.password;
        delete obj.ip;
        obj.user_id = encodeId(id);
        users.push(obj);
      });

    return users;
  }
}

module.exports = new UserService();
