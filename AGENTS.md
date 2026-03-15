# jwt-up — AGENTS.md

This file mirrors CLAUDE.md and is intended for AI coding agents (Codex, Copilot Workspace, etc.).

## Stack

- **Node.js** 24, **Express.js** 5, **TypeScript** 5 (strict, ESM)
- **PostgreSQL** via **knex** + **pg**
- **Redis** via **ioredis** — token blacklist, activation codes
- **JWT** ES256 (ECDSA), **Argon2id** password hashing
- **Joi** validation, **Vitest** tests, **Winston** logging

## Purpose

Authentication & authorization service. Issues and verifies JWT tokens. Portal verifies tokens by fetching public keys from `/api/jwk`.

## Structure

```
src/
  common/               # Config, logger, CORS headers, router loader, Swagger builder
  controllers/
    health/             # GET /api/health
    jwk/                # GET /api/jwk
    users/              # Auth: register, activate, login, refresh, logout, profile
    admin/              # Account management (admin role required)
  services/
    users/              # Auth business logic
    tokens/             # JWT/JWK service
    admin/              # Admin account management
  utils/
    JwtHelper.ts        # JWT sign/verify
    CryptoHelper.ts     # Argon2id
    KnexHelper.ts       # PostgreSQL
    RedisHelper.ts      # Redis
    EmailHelper.ts      # Nodemailer
    UuidBase64.ts       # UUID ↔ 22-char Base64url
    __mocks__/          # Vitest mocks (must be .ts files)
  exceptions/
    StatusError.ts      # throw new StatusError(status, message)
dev/
  docker-compose*.yml, postgres/create.sql, postgres/data.sql, genES256.sh
```

## Commands

```bash
npm run watch          # Dev with auto-reload
npm test               # Unit tests
npm run test:it        # Integration tests
npm run test:i         # Start services + run integration tests + stop
npm run build && npm start  # Production
```

## Critical rules — always follow

1. **Route registration** — add routes in `function.json`, not manually in Express. The `routerConfigurer.ts` auto-discovers all controllers
2. **Validation** — add Joi schemas to `validator.ts`. Schema key must match the `function` name in `function.json`
3. **Auth config** — set `auth` field in `function.json` binding. Omit for public endpoints
4. **Errors** — use `throw new StatusError(httpStatus, message)` — never `res.status(x).json(...)` directly from controllers for errors
5. **Mocks must be .ts** — Vitest resolves `.js` imports to `.ts` sources. Mock files in `__mocks__/` must have `.ts` extension
6. **Sensitive data** — passwords and tokens must never appear in logs. Check Winston masking
7. **UUIDs** — stored as UUID in DB, exposed as 22-char Base64url. Use `UuidBase64.ts` for conversion
8. **ESM** — project uses ESM (`"type": "module"`). Use `.js` extension in imports even for `.ts` source files

## Endpoints summary

All under `/api`:
- Public: `/health`, `/jwk`, `POST /auth/user`, `GET /auth/activate/:code`, `POST /auth/login`
- Refresh token: `GET /auth/refresh`
- Access token (registered+): `POST /auth/logout`, `GET/PUT/DELETE /auth/user`
- Access token (admin/manager/operator): `GET /auth/user/:user_id`
- Admin only: `GET/GET/PATCH/DELETE /admin/accounts[/:id]`

## Testing

Framework: **Vitest**. Mocks in `src/utils/__mocks__/`.

```typescript
import { vi } from 'vitest'
vi.mock('../../utils/KnexHelper.js')  // auto-resolved to __mocks__/KnexHelper.ts
```

Integration tests require all dev services running (`npm run startenv`).
