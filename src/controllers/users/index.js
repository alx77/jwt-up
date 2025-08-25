const log = require("../../common/logger");
//const metrics = require("../../common/metrics");
const userService = require("../../services/users");

async function register(req, res) {
  const user = req.body;
  //TODO check captcha `user.captcha_token`
  await userService.registerUser(user);
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
  const result = await userService.login(email, password);
  log.info(`User with email: ${email} successfully logged in`);
  //    metrics.increment("users.logged_in");
  res.json({ status: "OK", ...result }).end();
}

async function refreshToken(req, res) {
  const user_id = req.preprocessed.headers.authorization.user_id;
  const result = await userService.refreshToken(user_id);
  log.info(`Token for user: ${user_id} is refreshed`);
  //    metrics.increment("users.refresh_token");
  res.json({ status: "OK", ...result }).end();
}

async function read(req, res) {
  const user_id = req.params.user_id || req.preprocessed.headers.authorization.user_id;
  const user = await userService.get(user_id);
  log.info(`User: ${user.email} retrieved`);
  //    metrics.increment("users.read");
  res.json({ status: "OK", user }).end();
}

async function update(req, res) {
  const user = { ...req.body, ...req.preprocessed.body };
  const { user_id } = user;
  const result = await userService.update(user);
  log.info(`User: ${result.email} updated`);
  //    metrics.increment("users.updated");
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

module.exports = {
  register,
  activate,
  login,
  refreshToken,
  read,
  update,
  del,
};
//logout
//reset-password
//assignRole
//revokeRole
//changePassword
//updateUser (changeName, changeEmail)
//deleteUser (admin)

