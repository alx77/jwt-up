export interface IssuerConfig {
  context: string;
  publicKeyFile: string;
  privateKeyFile: string;
  tokenIssuer: string;
  tokenExpiresSec: number;
  refreshTokenExpiresSec: number;
}

export interface IssuerContext {
  context: string;
  publicKey: string;
  privateKey: string;
  issuer: string;
  tokenExpiresSec: number;
  refreshTokenExpiresSec: number;
}

export interface DecodedToken {
  sub: string;
  user_id: string;
  email?: string;
  roles?: string[];
  iss: string;
  exp: number;
  iat?: number;
  jti: string;
  aud?: string;
}

export interface AccountRow {
  id: number;
  uid: string;
  login: string;
  passwd: string;
  email: string;
  name: string | null;
  start_date: Date;
  status: number;
}

export interface UserDto {
  user_id: string;
  login?: string;
  email?: string;
  name?: string | null;
  start_date?: Date;
  status?: number;
}

export interface RegisterInput {
  login: string;
  email: string;
  password: string;
  name?: string;
  captcha_token?: string;
  ip?: string;
}

export interface TokenPair {
  user_id: string;
  access_token: string;
  refresh_token: string;
}

export interface JwkKey {
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  alg: string;
  use: string;
  kid: string;
  [key: string]: unknown;
}

export interface JwkResponse {
  keys: JwkKey[];
}

export interface AuthConfig {
  type: "access" | "refresh";
  roles?: string[];
}

export interface Binding {
  function: string;
  method: string;
  route: string;
  auth?: false | AuthConfig;
  validate?: boolean;
  hide?: boolean;
  summary?: string;
  description?: string;
  responses?: number[];
}

export interface FunctionConfig {
  enabled: boolean;
  type: string;
  description?: string;
  bindings: Binding[];
}

export interface SwaggerInfo {
  description?: string;
  version?: string;
  title?: string;
  contact?: Record<string, string>;
  license?: Record<string, string>;
}

export interface SwaggerTag {
  name: string;
  description?: string;
}

export type SwaggerRule = Record<string, unknown>;

export interface CorsConfig {
  enabled: boolean;
  allowAny: boolean;
  origin?: string;
}

export interface LogLevelConfig {
  file?: string;
  console?: string;
}

export interface AppConfig {
  port: number;
  host: string;
  cors: CorsConfig;
  loglevel: LogLevelConfig;
  issuers: IssuerConfig[];
  POSTGRES_CONN: string;
  POSTGRES_POOL_MAX?: number;
  REDIS_HOST: string;
  REDIS_PORT: number;
  EMAIL_SMTP_HOST: string;
  EMAIL_SMTP_PORT: number;
  EMAIL_SMTP_USER?: string;
  EMAIL_SMTP_PASS?: string;
  EMAIL_USE_AUTH?: boolean;
  EMAIL_USE_SSL?: boolean;
  USER_ACTIVATION_DELAY: number;
  CLIENT_ID?: string;
  KAFKA_HOST?: string;
  KAFKA_SASL_ENABLED?: boolean;
  KAFKA_SASL_USERNAME?: string;
  KAFKA_SASL_PASSWORD?: string;
  KAFKA_SSL_ENABLED?: boolean;
  KAFKA_CONSUMER_GROUP?: string;
}
