import log from "../../common/logger.js";
//import metrics from "../../common/metrics.js";
import tokenService from "../../services/tokens/index.js";

async function jwk(req, res) {
  const jwk = await tokenService.getJwk();
  if (!jwk) throw new Error("JWK_NOT_FOUND");
  log.info(`Jwk successfully retrieved`);
  //    metrics.increment("jwk.jwk");
  res.json(jwk).end();
}

export default { jwk };