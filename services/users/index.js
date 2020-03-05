const pg = require("../../utils/PostresHelper");
const log = require("../../common/logger");
const cfg = require("../../common/config");
const redis = require("../../utils/RedisHelper");
const nanoid = require("nanoid");
const bcrypt = require("bcrypt");
const { producer } = require("../../utils/KafkaHelper");

class UserService {
  async createUser(user) {
    const activationCode = nanoid(10);
    user.password = bcrypt.hashSync(user.password, 10);
    const userStr = JSON.stringify(user);
    // const userWithCodeStr = JSON.stringify({ ...user, activationCode });
    await redis.setex(activationCode, cfg.get("USER_ACTIVATION_DELAY"), userStr);
    await producer.connect();
    await producer.send({
      topic: cfg.get("KAFKA_ACTIVATION_TOPIC"),
      messages: [
        { value: { ...user, payload: { ...user.payload, activationCode } } }
      ]
    });
  }

  async activate(activationCode) {
    const userStr = await redis.get(activationCode);
    const res = await pg.query(
      "INSERT INTO jwtup.users(obj) VALUES($1) RETURNING id, obj",
      [userStr]
    );
    log.info(
      `user activated, code ${activationCode}, user: ${JSON.stringify(res)}`
    );
    return res;
  }

  async update(user) {
    delete user.onetime_token;
    const res = await pg.query(
      "UPDATE jwtup.users SET obj = obj || $1 RETURNING id, obj",
      [JSON.stringify(user)]
    );
    log.info(
      `user updated: user ${JSON.stringify(
        user
      )}, updated user: ${JSON.stringify(res)}`
    );
    return res;
  }

  async get(id) {
    const res = await pg.query("SELECT obj FROM jwtup.users WHERE id = $1", [
      id
    ]);
    log.info(`user extracted by id: ${id}, user: ${JSON.stringify(res)}`);
    return res;
  }

  async getByEmail(email) {
    const res = await pg.query(
      "SELECT obj FROM jwtup.users WHERE obj->>'email' = $1",
      [email]
    );
    log.info(`user extracted by id: ${id}, user: ${JSON.stringify(res)}`);
    return res;
  }

  async delete(id) {
    const res = await pg.query(
      "DELETE jwtup.users WHERE id = $1 RETURNING obj",
      [id]
    );
    log.info(`user deleted, id: ${id}, user: ${JSON.stringify(res)}`);
    return res;
  }

  async deleteByEmail(email) {
    const res = await pg.query(
      "DELETE jwtup.users WHERE obj->>'email' = $1 RETURNING obj",
      [email]
    );
    log.info(`user deleted, email: ${email}, user: ${JSON.stringify(res)}`);
    return res;
  }

  async list({ filter, sort, offset, limit }) {
    const res = await pg.query(
      "SELECT obj FROM jwtup.users WHERE filter ORDER BY sort LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    log.info(
      `users extracted by filter: ${filter}, sort: ${sort}, offset ${offset}, limit ${limit}. Total results: ${res.length}`
    );
    return res;
  }
}

module.exports = new UserService();
