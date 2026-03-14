import cfg from "../common/config.js";
import jwt from "jsonwebtoken";
import fs from "fs";
import crypto from "crypto";
import { encode } from "./UuidBase64.js";
import type {
  IssuerConfig,
  IssuerContext,
  DecodedToken,
  JwkKey,
  JwkResponse,
} from "../types/index.js";

interface TokenPayload {
  user_id: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
}

class JwtHelper {
  private readonly config: Record<string, IssuerContext>;

  constructor(issuersConfig: IssuerConfig[]) {
    this.config = issuersConfig.reduce<Record<string, IssuerContext>>(
      (
        acc,
        {
          context,
          publicKeyFile,
          privateKeyFile,
          tokenIssuer,
          tokenExpiresSec,
          refreshTokenExpiresSec,
        },
      ) => {
        acc[context] = {
          context,
          publicKey: fs.readFileSync(publicKeyFile, "utf8"),
          privateKey: fs.readFileSync(privateKeyFile, "utf8"),
          issuer: tokenIssuer,
          tokenExpiresSec,
          refreshTokenExpiresSec,
        };
        return acc;
      },
      {},
    );
  }

  async getJwk(): Promise<JwkResponse> {
    const keyPromises = Object.values(this.config).map(
      async ({ context, publicKey }) => {
        const jwk = crypto
          .createPublicKey(publicKey)
          .export({ format: "jwk" }) as JwkKey;
        return {
          ...jwk,
          alg: "ES256",
          use: "sig",
          kid: await this.generateKidFromKey(publicKey, context),
        };
      },
    );
    const keys = await Promise.all(keyPromises);
    return { keys };
  }

  private async generateKidFromKey(
    publicKey: string,
    context: string,
  ): Promise<string> {
    const hash = crypto
      .createHash("sha256")
      .update(publicKey)
      .digest("hex")
      .slice(0, 8);
    return `key-${context}-${hash}`;
  }

  async getAccessToken(
    payload: TokenPayload,
    context = "default",
  ): Promise<string> {
    const ctx = this.config[context];
    return new Promise((resolve, reject) =>
      jwt.sign(
        {
          iss: ctx.issuer,
          exp: Math.floor(Date.now() / 1000) + Number(ctx.tokenExpiresSec),
          sub: payload.user_id,
          jti: encode(crypto.randomUUID()),
          ...payload,
        },
        ctx.privateKey,
        { algorithm: "ES256" },
        (err, token) => (err ? reject(err) : resolve(token as string)),
      ),
    );
  }

  async getRefreshToken(
    payload: Pick<TokenPayload, "user_id">,
    context = "default",
  ): Promise<string> {
    const ctx = this.config[context];
    return new Promise((resolve, reject) =>
      jwt.sign(
        {
          iss: ctx.issuer,
          exp:
            Math.floor(Date.now() / 1000) + Number(ctx.refreshTokenExpiresSec),
          sub: payload.user_id,
          jti: encode(crypto.randomUUID()),
          aud: "refresh",
          ...payload,
        },
        ctx.privateKey,
        { algorithm: "ES256" },
        (err, token) => (err ? reject(err) : resolve(token as string)),
      ),
    );
  }

  decodeTokenSync(token: string, context = "default"): DecodedToken {
    const ctx = this.config[context];
    return jwt.verify(token, ctx.publicKey, {
      algorithms: ["ES256"],
      issuer: ctx.issuer,
    }) as DecodedToken;
  }

  async decodeToken(token: string, context = "default"): Promise<DecodedToken> {
    const ctx = this.config[context];
    return new Promise((resolve, reject) =>
      jwt.verify(
        token,
        ctx.publicKey,
        { algorithms: ["ES256"], issuer: ctx.issuer },
        (err, decoded) =>
          err ? reject(err) : resolve(decoded as DecodedToken),
      ),
    );
  }
}

const jwtHelper = new JwtHelper(cfg.get("issuers"));

export default jwtHelper;
