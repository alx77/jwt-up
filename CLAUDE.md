# jwt-up — CLAUDE.md

## Stack

- **Node.js** 24, **Express.js** 5, **TypeScript** 5 (strict, ESM)
- **PostgreSQL** via **knex** (query builder) + **pg** driver
- **Redis** via **ioredis** — token blacklist, activation codes
- **JWT** — ES256 (ECDSA), signed with EC keypairs
- **Argon2id** — password hashing
- **Kafka** via **kafkajs** — event streaming (configured but not yet active)
- **Nodemailer** — email (MailPit in dev)
- **Joi** — request validation
- **swagger-ui-express** — API docs at `/api/swagger`
- **Vitest** — unit + integration tests
- **Winston** — logging
- **tsx** — dev runtime (replaces nodemon)

## Purpose

Authentication & authorization service for the ideaficus platform. Issues and verifies JWT tokens, manages user accounts. The **portal** project verifies tokens by fetching public keys from `/api/jwk`.

## Structure

```
src/
  common/
    config.ts              # nconf-based typed config loader
    logger.ts              # Winston logger
    headers.ts             # CORS + security headers middleware
    routerConfigurer.ts    # Auto-loads controllers from folder structure via function.json
    SwaggerBuilder.ts      # Builds OpenAPI doc from function.json + Joi schemas
  controllers/
    health/                # GET /api/health
    jwk/                   # GET /api/jwk — public keys for token verification
    users/
      index.ts             # Auth endpoints (register, login, refresh, logout, profile)
      function.json        # Route definitions
      validator.ts         # Joi validation schemas
    admin/
      index.ts             # Admin account management endpoints
      function.json        # Route definitions (all require admin role)
      validator.ts         # Joi validation schemas
  services/
    users/index.ts         # User auth business logic
    tokens/index.ts        # Token/JWK service
    admin/index.ts         # Admin account management logic
  types/
    index.ts               # All domain types (AuthConfig, Binding, AppConfig, ...)
    express.d.ts           # Express Request augmentation (req.preprocessed)
    joi-to-swagger.d.ts    # Type declarations for joi-to-swagger
    kafkajs-snappy.d.ts    # Type declarations for kafkajs-snappy
  utils/
    JwtHelper.ts           # JWT sign/verify, JWK generation
    CryptoHelper.ts        # Argon2id hashing
    KnexHelper.ts          # PostgreSQL connection
    RedisHelper.ts         # Redis connection
    EmailHelper.ts         # Nodemailer setup
    KafkaHelper.ts         # Kafka producer/consumer
    UuidBase64.ts          # UUID ↔ Base64url (22-char user IDs)
    __mocks__/             # Vitest mocks: KnexHelper, RedisHelper, EmailHelper
  exceptions/
    StatusError.ts         # Custom error with HTTP status
dev/
  docker-compose*.yml      # Postgres, Redis, Kafka, MailPit
  postgres/create.sql      # DB schema
  postgres/data.sql        # Seed data (guest, admin, job users + 5 roles)
  genES256.sh              # Generate EC keypair
index.ts                   # Entry point
config.json                # Main configuration
ES256*.key                 # EC keypairs (user + service-to-service)
```

## Commands

```bash
npm run start:dev      # Dev server (tsx)
npm run watch          # Dev server with auto-reload (tsx watch)
npm run build          # Compile TypeScript → dist/
npm start              # Start production server (node dist/index.js)
npm run startenv       # Start all dev services (docker compose)
npm run stopenv        # Stop dev services
npm test               # Unit tests
npm run test:it        # Integration tests (requires running services)
npm run test:i         # Start services + integration tests + stop services
npm run test:coverage  # Coverage report
```

Dev services: Postgres `:35432`, Redis `:26379`, MailPit `:1025` / `:8025`

## Endpoints

All routes prefixed with `/api`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | public | Server status |
| GET | `/jwk` | public | Public keys for JWT verification |
| POST | `/auth/user` | public | Register (creates BLOCKED account, sends activation email) |
| GET | `/auth/activate/:code` | public | Activate account via email link |
| POST | `/auth/login` | public | Login → access + refresh tokens |
| GET | `/auth/refresh` | refresh token | Refresh access token |
| POST | `/auth/logout` | access token | Blacklist both tokens in Redis |
| GET | `/auth/user` | access (registered+) | Get current user profile |
| GET | `/auth/user/:user_id` | access (admin/manager/operator) | Get user by ID |
| PUT | `/auth/user` | access (registered+) | Update user profile |
| DELETE | `/auth/user/:user_id` | access (registered+) | Delete account |
| GET | `/admin/accounts` | access (admin) | List accounts (paginated, filterable) |
| GET | `/admin/accounts/:id` | access (admin) | Get account by ID |
| PATCH | `/admin/accounts/:id` | access (admin) | Update account status |
| DELETE | `/admin/accounts/:id` | access (admin) | Delete account |

## Auth config (function.json)

Auth is configured per-binding via the `auth` field:

```json
{ "auth": { "type": "refresh" } }                          // refresh token only
{ "auth": { "type": "access" } }                           // any valid access token
{ "auth": { "type": "access", "roles": ["admin"] } }       // access + role required
```

Omitting `auth` means the endpoint is public.

## Auth flow

1. **Register** → password hashed (Argon2id) → stored as BLOCKED → activation code → Redis (24h TTL) → email sent
2. **Activate** → code lookup in Redis → account set ACTIVE → access + refresh tokens issued
3. **Login** → Argon2 verify → issue access token (600s) + refresh token (10800s)
4. **Refresh** → validate refresh token (`aud === "refresh"`) → check Redis blacklist → issue new token pair
5. **Logout** → access token (header) + refresh token (body) → both blacklisted in Redis with remaining TTL

## JWT

- Algorithm: **ES256** (Elliptic Curve, SHA-256)
- Two issuer contexts: `default` (users) and `service-to-service`
- Access token: contains `roles` array claim, no `aud`
- Refresh token: no roles, `aud: "refresh"`
- Issuer: `https://ideaficus.com/oauth2/default`
- Keypairs: `ES256.priv.key` / `ES256.pub.key` (and `ES256-service.*` for s2s)
- JWK endpoint consumed by **portal** for token verification

## Configuration (config.json)

```json
{
  "port": 8088,
  "POSTGRES_CONN": "postgres://...",
  "REDIS_HOST": "localhost",
  "REDIS_PORT": 26379,
  "EMAIL_SMTP_HOST": "localhost",
  "EMAIL_SMTP_PORT": 1025
}
```

Override any key via env var: `CONFIG_KEY__SUBKEY=value`

## Database

Own database `auth` (separate from **portal**):
- `account` — users (`uid` UUID, `login`, `passwd`, `email`, `name`, `status`)
- `role` — roles: guest=1, admin=2, manager=3, operator=4, registered=5
- `acl` — account ↔ role mapping with permissions
- Account status: ACTIVE=1, BLOCKED=2, TEMPORARY_BLOCKED=3

User IDs stored as UUID, exposed as 22-char Base64url (`UuidBase64.ts`) — same convention as **portal**.

## Relation to other projects

- **dashboard** → calls jwt-up for all auth (login, logout, refresh, profile)
- **portal** → verifies JWT tokens via `/api/jwk`, does not issue tokens
- jwt-up uses its own `auth` database (not shared with portal)

## Key conventions

- Routes auto-discovered from `src/controllers/` via `routerConfigurer.ts` + `function.json`
- `__mocks__` files must be `.ts` (Vitest resolves `.js` imports to `.ts` sources)
- Validation via Joi schemas in `validator.ts` — schema key must match `function` name in `function.json`
- Sensitive fields (password, token) masked in all logs
- Custom errors: `throw new StatusError(httpStatus, message)`
- EC keypairs must be generated with `./dev/genES256.sh` before first run
