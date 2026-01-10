import cfg from "../common/config.js";
import jwt from "jsonwebtoken";
import fs from "fs";
import crypto from "crypto";
import { encode } from "./UuidBase64.js";

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
        const jwk = crypto
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

    const keys = await Promise.all(keyPromises);
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
    return new Promise((resolve, reject) =>
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
        (err, token) => (err ? reject(err) : resolve(token))
      )
    );
  }

  async getRefreshToken(obj, context = "default") {
    return new Promise((resolve, reject) =>
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
          aud: "refresh"
        },
        this.config[context].privateKey,
        { algorithm: "ES256" },
        (err, token) => (err && reject(err) || resolve(token))
      )
    );
  }

  decodeTokenSync(token, context = "default") {
    return jwt.verify(token, this.config[context].publicKey, {
      algorithms: ["ES256"],
      issuer: this.config[context].issuer
    });
  }

  async decodeToken(token, context = "default") {
    return new Promise((resolve, reject) =>
      jwt.verify(
        token,
        this.config[context].publicKey,
        {
          algorithms: ["ES256"],
          issuer: this.config[context].issuer
        },
        (err, decoded) => (err ? reject(err) : resolve(decoded))
      )
    );
  }
}

const jwtHelper = new JwtHelper(cfg.get("issuers"));

export default jwtHelper;
