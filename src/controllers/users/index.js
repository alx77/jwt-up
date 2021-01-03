const log = require("../../common/logger");
//const metrics = require("../../common/metrics");
const userService = require("../../services/users");
const { pager } = require("../../utils");

async function create(req, res) {
  const user = req.body;
  delete user.captcha_token;
  await userService.createUser(user);
  //    metrics.increment("users.created");
  res.json({ status: "OK" }).end();
}

async function activate(req, res) {
  const { code } = req.params;
  try {
    const result = await userService.activate(code);
    log.info(
      `User with code: ${code} successfully activated, user_id: ${result.user_id}`
    );
    //    metrics.increment("users.activated");
    res.json({ status: "OK", ...result }).end();
  } catch (e) {
    if (e.message.includes("user_email_idx"))
      throw new Error("USER_ALREADY_EXISTS");
    else throw e;
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  try {
    const result = await userService.login(email, password);
    log.info(`User with email: ${email} successfully logged in`);
    //    metrics.increment("users.logged_in");
    res.json({ status: "OK", ...result }).end();
  } catch (e) {
    if (e.message.includes("user_email_idx"))
      throw new Error("USER_ALREADY_EXISTS");
    else throw e;
  }
}

async function refreshToken(req, res) {
  const user = req.preprocessed.headers.authorization;
  delete user.exp;
  delete user.iat;
  const access_token = await userService.refreshToken(user);
  log.info(`Token for user: ${user.email} is refreshed`);
  //    metrics.increment("users.refresh_token");
  res.json({ status: "OK", access_token }).end();
}

async function jwk(req, res) {
  const jwk = await userService.getJwk();
  if (!jwk) throw new Error("JWK_NOT_FOUND");
  log.info(`Jwk successfully retrieved`);
  //    metrics.increment("users.jwk");
  res.json(jwk).end();
}

async function read(req, res) {
  const { user_id } = req.preprocessed.params;
  const user = await userService.get(user_id);
  if (!user) throw new Error("USER_NOT_FOUND");
  log.info(`User: ${user.email} retrieved`);
  //    metrics.increment("users.read");
  delete user.password;
  delete user.ip;
  res.json({ status: "OK", user }).end();
}

async function readByEmail(req, res) {
  const { email } = req.params;
  const user = await userService.getByEmail(email);
  if (!user) throw new Error("USER_NOT_FOUND");
  log.info(`User: ${user.email} retrieved`);
  //    metrics.increment("users.read");
  delete user.password;
  delete user.ip;
  res.json({ status: "OK", user }).end();
}

async function update(req, res) {
  const user = { ...req.body, ...req.preprocessed.body };
  const { user_id } = user;
  delete user.captcha_token;
  delete user.password;
  const result = await userService.update(user);
  if (!result) throw new Error("USER_NOT_FOUND");
  log.info(`User: ${result.email} updated`);
  //    metrics.increment("users.updated");
  delete user.password;
  delete user.ip;
  res.json({ status: "OK", user }).end();
}

async function del(req, res) {
  const { user_id } = req.preprocessed.params;
  const result = await userService.delete(user_id);
  if (!result) throw new Error("USER_NOT_FOUND");
  log.info(`User: ${user_id} deleted`);
  //    metrics.increment("users.updated");
  res.json({ status: "OK" }).end();
}

async function list(req, res) {
  const {
    page = 0,
    size = 10,
    filter = [],
    sort = { field: "name", order: "asc" },
  } = req.query;
  const { limit, offset } = pager({ page, size });
  const users = await userService.list({ filter, sort, offset, limit });
  if (!users) throw new Error(`Could not retrieve user list`);
  log.info(`User list retrieved: ${users.length} found`);
  //    metrics.increment("users.updated");
  res.json({ status: "OK", users }).end();
}

module.exports = {
  create,
  activate,
  login,
  refreshToken,
  read,
  readByEmail,
  update,
  del,
  list,
  jwk,
};
