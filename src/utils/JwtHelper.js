const cfg = require("../common/config");
const jwt = require("jsonwebtoken");
const rasha = require("rasha");
const fs = require("fs");

class JwtHelper {
  constructor(publicKeyFile, privateKeyFile) {
    this.publicKey = fs.readFileSync(publicKeyFile).toString("utf8");
    this.privateKey = fs.readFileSync(privateKeyFile).toString("utf8");
  }

  async getJwk() {
    const jwk = await rasha.import({ pem: this.publicKey });
    return { keys: [Object.assign({}, jwk, { alg: "RS256", use: "sig" })] };
  }

  async encode(obj) {
    return await new Promise((res, rej) =>
      jwt.sign(
        {
          ...{
            iss: cfg.get("TOKEN_ISSUER"),
            exp:
              Math.floor(Date.now() / 1000) +
              Number.parseInt(cfg.get("TOKEN_EXPIRES_SEC")),
          },
          ...obj,
        },
        this.privateKey,
        { algorithm: "RS256" },
        (err, token) => (err && rej(err)) || res(token)
      )
    );
  }

  decodeSync(token) {
    return jwt.verify(token, this.publicKey, { issuer: this.issuer });
  }

  async decode(token) {
    return await new Promise((res, rej) =>
      jwt.verify(
        token,
        this.publicKey,
        { issuer: this.issuer },
        (err, decoded) => (err && rej(err)) || res(decoded)
      )
    );
  }
}

module.exports = new JwtHelper(
  cfg.get("PUBLIC_KEY_FILE"),
  cfg.get("PRIVATE_KEY_FILE")
);
