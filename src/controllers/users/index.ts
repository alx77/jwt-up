import type { Request, Response } from "express";
import log from "../../common/logger.js";
import userService from "../../services/users/index.js";
import StatusError from "../../exceptions/StatusError.js";
import jwtHelper from "../../utils/JwtHelper.js";

async function register(req: Request, res: Response): Promise<void> {
  //TODO check captcha `user.captcha_token`
  const baseUrl = req.protocol + "://" + req.get("host");
  await userService.registerUser(req.body, baseUrl);
  //    metrics.increment("users.created");
  res.json({ status: "OK" }).end();
}

async function activate(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  try {
    const result = await userService.activate(code);
    log.info(`User with code: ${code} successfully activated, user_id: ${result.user_id}`);
    //    metrics.increment("users.activated");
    res.json({ status: "OK", ...result }).end();
  } catch (e: unknown) {
    if ((e as Error).message.includes("user_email_idx")) throw new Error("USER_ALREADY_EXISTS");
    throw e;
  }
}

async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const result = await userService.login(email, password);
  log.info(`User with email: ${email} successfully logged in`);
  //    metrics.increment("users.logged_in");
  res.json({ status: "OK", ...result }).end();
}

async function refreshToken(req: Request, res: Response): Promise<void> {
  const user_id = req.preprocessed!.headers.authorization.user_id;
  const token = req.headers.authorization!.split(" ")[1];
  const result = await userService.refreshToken(user_id, token);
  log.info(`Token for user: ${user_id} is refreshed`);
  //    metrics.increment("users.refresh_token");
  res.json({ status: "OK", ...result }).end();
}

async function read(req: Request, res: Response): Promise<void> {
  const user_id = req.params["user_id"] ?? req.preprocessed!.headers.authorization.user_id;
  const user = await userService.get(user_id);
  log.info(`User: ${user.email} retrieved`);
  //    metrics.increment("users.read");
  res.json({ status: "OK", user }).end();
}

async function update(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    user_id: string;
    login: string;
    email: string;
    name?: string;
  };
  if (
    body.user_id !== req.preprocessed!.headers.authorization.user_id &&
    !req.preprocessed!.headers.authorization.roles?.includes("admin")
  ) {
    throw new StatusError(401, "UNAUTHORIZED");
  }
  const result = await userService.update(body);
  log.info(`User: ${result.email} updated`);
  res.json({ status: "OK", user: result }).end();
}

async function del(req: Request, res: Response): Promise<void> {
  const { user_id } = req.params;
  if (
    user_id !== req.preprocessed!.headers.authorization.user_id &&
    !req.preprocessed!.headers.authorization.roles?.includes("admin")
  ) {
    throw new StatusError(401, "UNAUTHORIZED");
  }
  const result = await userService.delete(user_id);
  if (!result) throw new Error("USER_NOT_FOUND");
  log.info(`User: ${user_id} deleted`);
  //    metrics.increment("users.deleted");
  res.json({ status: "OK" }).end();
}

async function logout(req: Request, res: Response): Promise<void> {
  const accessToken = req.headers.authorization!.split(" ")[1];
  const accessTtl = req.preprocessed!.headers.authorization.exp - Math.floor(Date.now() / 1000);

  const { refresh_token } = req.body as { refresh_token: string };
  const context = (req.headers["x-issuer-context"] as string | undefined) ?? "default";

  let refreshTtl = 0;
  try {
    const decoded = jwtHelper.decodeTokenSync(refresh_token, context);
    refreshTtl = decoded.exp - Math.floor(Date.now() / 1000);
  } catch {
    log.warn("Failed to decode refresh token during logout, skipping blacklist");
  }

  await userService.logout(accessToken, accessTtl, refresh_token, refreshTtl);
  log.info(`Tokens blacklisted`);
  res.json({ status: "OK" }).end();
}

export default {
  register,
  activate,
  login,
  refreshToken,
  read,
  update,
  del,
  logout,
};
//TODO
//reset-password
//assignRole
//revokeRole
//changePassword
