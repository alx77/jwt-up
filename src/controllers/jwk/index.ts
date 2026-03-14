import type { Request, Response } from "express";
import log from "../../common/logger.js";
import tokenService from "../../services/tokens/index.js";

async function jwk(_req: Request, res: Response): Promise<void> {
  const result = await tokenService.getJwk();
  if (!result) throw new Error("JWK_NOT_FOUND");
  log.info("Jwk successfully retrieved");
  res.json(result).end();
}

export default { jwk };
