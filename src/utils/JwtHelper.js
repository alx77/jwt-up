const cfg = require("../common/config");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const crypto = require("crypto");
const { encode } = require("./UuidBase64");


class JwtHelper {
  constructor(publicKeyFile, privateKeyFile) {
    this.publicKey = fs.readFileSync(publicKeyFile, "utf8");
    this.privateKey = fs.readFileSync(privateKeyFile, "utf8");
    this.issuer = cfg.get("TOKEN_ISSUER");
  }

  async getJwk() {
    const jwk = await crypto
      .createPublicKey(this.publicKey)
      .export({ format: "jwk" });
    return {
      keys: [
        {
          ...jwk,
          alg: "ES256",
          use: "sig",
        },
      ],
    };
  }

  async getAccessToken(obj) {
    return await new Promise((res, rej) =>
      jwt.sign(
        {
          ...{
            iss: cfg.get("TOKEN_ISSUER"),
            exp:
              Math.floor(Date.now() / 1000) +
              Number.parseInt(cfg.get("TOKEN_EXPIRES_SEC")),
          },
          sub: obj.user_id,
          jti: encode(crypto.randomUUID()),
          ...obj,
        },
        this.privateKey,
        { algorithm: "ES256" },
        (err, token) => (err && rej(err)) || res(token)
      )
    );
  }

  async getRefreshToken(obj) {
    return await new Promise((res, rej) =>
      jwt.sign(
        {
          ...{
            iss: cfg.get("TOKEN_ISSUER"),
            exp:
              Math.floor(Date.now() / 1000) +
              Number.parseInt(cfg.get("REFRESH_TOKEN_EXPIRES_SEC")),
          },
          sub: obj.user_id,
          jti: encode(crypto.randomUUID()),
          ...obj
        },
        this.privateKey,
        { algorithm: "ES256" },
        (err, token) => (err && rej(err)) || res(token)
      )
    );
  }

  decodeTokenSync(token) {
    return jwt.verify(token, this.publicKey, { iss: this.issuer });
  }

  async decodeToken(token) {
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
