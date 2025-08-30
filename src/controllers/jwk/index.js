const log = require("../../common/logger");
//const metrics = require("../../common/metrics");
const tokenService = require("../../services/tokens");

async function jwk(req, res) {
  const jwk = await tokenService.getJwk();
  if (!jwk) throw new Error("JWK_NOT_FOUND");
  log.info(`Jwk successfully retrieved`);
  //    metrics.increment("jwk.jwk");
  res.json(jwk).end();
}

module.exports = {
  jwk,
};
