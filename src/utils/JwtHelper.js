const cfg = require("../common/config");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const crypto = require("crypto");
const { encode } = require("./UuidBase64");

class JwtHelper {
  constructor(issuersConfig) {
    this.config = issuersConfig.reduce(
      (
        acc,
        {
          context,
          publicKeyFile,
          privateKeyFile,
          tokenIssuer,
          tokenExpiresSec,
          refreshTokenExpiresSec,
        }
      ) => {
        acc[context] = {
          context,
          publicKey: fs.readFileSync(publicKeyFile, "utf8"),
          privateKey: fs.readFileSync(privateKeyFile, "utf8"),
          issuer: tokenIssuer,
          tokenExpiresSec: tokenExpiresSec,
          refreshTokenExpiresSec: refreshTokenExpiresSec,
        };
        return acc;
      },
      {}
    );
  }

  async getJwk() {
    const keyPromises = Object.values(this.config).map(
      async ({ context, publicKey }) => {
        const jwk = await crypto
          .createPublicKey(publicKey)
          .export({ format: "jwk" });

        return {
          ...jwk,
          alg: "ES256",
          use: "sig",
          kid: await this.generateKidFromKey(publicKey, context),
        };
      }
    );

    var keys = await Promise.all(keyPromises);
    return {
      keys,
    };
  }

  async generateKidFromKey(publicKey, context) {
    const hash = crypto
      .createHash("sha256")
      .update(publicKey)
      .digest("hex")
      .slice(0, 8);
    return `key-${context}-${hash}`;
  }

  async getAccessToken(obj, context = "default") {
    return await new Promise((res, rej) =>
      jwt.sign(
        {
          ...{
            iss: this.config[context].issuer,
            exp:
              Math.floor(Date.now() / 1000) +
              Number.parseInt(this.config[context].tokenExpiresSec),
          },
          sub: obj.user_id,
          jti: encode(crypto.randomUUID()),
          ...obj,
        },
        this.config[context].privateKey,
        { algorithm: "ES256" },
        (err, token) => (err && rej(err)) || res(token)
      )
    );
  }

  async getRefreshToken(obj, context = "default") {
    return await new Promise((res, rej) =>
      jwt.sign(
        {
          ...{
            iss: this.config[context].issuer,
            exp:
              Math.floor(Date.now() / 1000) +
              Number.parseInt(this.config[context].refreshTokenExpiresSec),
          },
          sub: obj.user_id,
          jti: encode(crypto.randomUUID()),
          ...obj,
        },
        this.config[context].privateKey,
        { algorithm: "ES256" },
        (err, token) => (err && rej(err)) || res(token)
      )
    );
  }

  decodeTokenSync(token, context = "default") {
    return jwt.verify(token, this.config[context].publicKey, {
      iss: this.config[context].issuer,
    });
  }

  async decodeToken(token, context = "default") {
    return await new Promise((res, rej) =>
      jwt.verify(
        token,
        this.config[context].publicKey,
        { issuer: this.config[context].issuer },
        (err, decoded) => (err && rej(err)) || res(decoded)
      )
    );
  }
}

module.exports = new JwtHelper(cfg.get("issuers"));
