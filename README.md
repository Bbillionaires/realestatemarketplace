# Landlord/Tenant Relay Messaging Platform

A property marketplace communication system that lets prospective/current tenants and
landlords/property managers text each other at native-SMS speed while every message is
relayed, moderated, and logged by the platform — neither side ever sees the other's real
phone number.

> **Status: Phase 1 (Foundation) complete.** See [Implementation phases](#implementation-phases)
> below for what's built vs. planned.

## Contents

- [Architecture](docs/architecture.md) — system diagram, module boundaries, SMS provider
  abstraction, phone-privacy model, and the full database ER diagram (all Mermaid).
- This README — setup, testing, deployment, and security notes.

## Tech stack

| Concern | Choice |
|---|---|
| API | Node.js + TypeScript + **NestJS** (DI-based module boundaries, Guards for RBAC) |
| Database | PostgreSQL + **Prisma ORM** |
| Cache / queues / rate limits | **Redis** (BullMQ queues land in Phase 2+) |
| Dashboard | **Next.js** (App Router) |
| SMS | Provider-agnostic `SmsProvider` interface; Mock provider now, Twilio in Phase 2 |
| Auth | JWT access tokens + rotating opaque refresh tokens, Argon2id password hashing |
| Containerization | Docker + Docker Compose |

## Repository layout

```
apps/
  api/                  NestJS backend
    prisma/
      schema.prisma     Full data model (all phases)
      migrations/
      seed.ts
    src/
      auth/             Register, login, refresh rotation
      users/             Profiles, admin user management, RBAC role changes
      phone/             OTP phone verification (encrypted storage, masked responses)
      properties/        Property + unit CRUD, manager assignment
      sms/               SmsProvider interface, Mock provider, DI wiring
      audit/             AuditLog service + admin endpoint
      common/            Guards, decorators, crypto/phone utils, filters, interceptors
      redis/             Redis client + rate limiter
      prisma/            PrismaService
      config/            Env loading + validation
    test/                e2e tests (supertest against a real Nest app + test DB)
  dashboard/             Next.js dashboard (login + property list wired to the API)
docker/
docs/
  architecture.md         Mermaid diagrams + design notes
docker-compose.yml
.env.example
```

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (via Docker Compose, or a local install)
- Redis 7 (via Docker Compose, or a local install)

## Setup

```bash
npm install
cp .env.example .env      # then fill in real secrets — see "Generating secrets" below
```

### Generating secrets

```bash
# JWT signing secrets
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET

# Phone-number field encryption (MUST decode to exactly 32 bytes)
openssl rand -base64 32   # PHONE_ENCRYPTION_KEY

# HMAC key for phone-number lookup hashing (separate from the encryption key)
openssl rand -base64 32   # PHONE_HASH_SECRET
```

### Start Postgres + Redis

```bash
docker compose up -d postgres redis
```

(Or run local `postgres`/`redis-server` instances and point `DATABASE_URL`/`REDIS_URL` at them.)

### Run migrations and seed data

```bash
npm run prisma:migrate --workspace=apps/api
npm run prisma:seed --workspace=apps/api
```

The seed script creates one user per role (see `apps/api/prisma/seed.ts`) all with password
`DevPassword123!`, plus two sample properties ("123 Main Street", "455 Oak Avenue") — the same
ones used in the routing-menu example in the spec.

### Run the app

```bash
npm run dev:api          # http://localhost:3001/api
npm run dev:dashboard     # http://localhost:3000
```

## Testing

```bash
# Unit tests (no DB required)
npm run test --workspace=apps/api

# e2e tests (requires Postgres + Redis reachable via apps/api/.env.test)
cd apps/api
npx prisma migrate deploy   # against the *_test database referenced in .env.test
npm run test:e2e
```

`apps/api/.env.test` holds non-secret, dev-only test configuration (dummy JWT/encryption keys)
and points at a separate `_test` database so `npm run test:e2e` never touches dev data.

### What's covered in Phase 1

- **Auth**: registration (role allow-listing), login, refresh-token rotation, reuse-detection
  (a replayed refresh token revokes its whole token family), suspended-user lockout.
- **RBAC**: route-level role guards; an `ADMINISTRATOR` cannot escalate anyone to
  `ADMINISTRATOR`/`SUPER_ADMINISTRATOR` (only a `SUPER_ADMINISTRATOR` can); suspend/restore.
- **Phone privacy**: OTP send + confirm through the mock SMS provider; explicit assertions
  that `encryptedNumber`, `numberHash`, and the raw number never appear in any API response
  (see `test/phone-verification.e2e-spec.ts`).
- **Properties**: RBAC-scoped CRUD, manager assignment, and response-shaping tests proving a
  prospective tenant never receives `ownerId`/manager IDs while the owning landlord does.
- **Audit logging**: every mutating action under test asserts a matching `AuditLog` row.

## API surface (Phase 1)

All routes are prefixed with `/api`. Every route except `/auth/*` requires
`Authorization: Bearer <accessToken>`.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Self-service roles only: PROSPECTIVE_TENANT, LANDLORD, PROPERTY_MANAGER |
| POST | `/auth/login` | |
| POST | `/auth/refresh` | Rotates the refresh token |
| POST | `/auth/logout` | Revokes a refresh token |
| GET/PATCH | `/users/me` | Own profile |
| GET | `/users`, `/users/:id` | Admin/staff only |
| PATCH | `/users/:id/role` | Admin+ (privilege-escalation guarded) |
| PATCH | `/users/:id/suspend`, `/restore` | Admin+ |
| GET/POST | `/phone` | List / start OTP verification |
| POST | `/phone/confirm-verification` | |
| GET/POST | `/properties`, `/properties/:id` | Role-shaped response (see above) |
| PATCH | `/properties/:id` | Owner, assigned manager, or staff/admin |
| POST/PATCH | `/properties/:id/managers`, `/managers/:userId/revoke` | |
| GET/POST/PATCH | `/properties/:id/units`, `/units/:unitId` | |
| GET | `/audit-logs` | Admin/staff only |

## Security notes

- **Passwords**: Argon2id, never reversible; never logged.
- **Phone numbers**: AES-256-GCM at rest, HMAC-SHA256 lookup hash, masked in every API/dashboard
  response. See [docs/architecture.md](docs/architecture.md#phone-number-privacy-model).
- **Tokens**: short-lived JWT access tokens (role/active-status re-checked from the DB on every
  request, so a suspension takes effect immediately); refresh tokens are opaque, hashed at rest,
  and rotate on every use with reuse-detection (a stolen-and-replayed token revokes its whole
  session family).
- **Transport**: `helmet()` security headers, CORS restricted to the configured dashboard origin,
  global input validation (`whitelist + forbidNonWhitelisted`) via class-validator.
- **Rate limiting**: global Nest Throttler plus a Redis-backed limiter specifically for OTP
  send/confirm attempts (per-user and per-phone-number).
- **Least privilege**: an `ADMINISTRATOR` cannot grant `ADMINISTRATOR`/`SUPER_ADMINISTRATOR` —
  only a `SUPER_ADMINISTRATOR` can, preventing a single compromised admin account from minting
  more admins.
- **Audit logging**: every mutating action (role changes, suspensions, property edits, manager
  assignment, phone verification) writes an `AuditLog` row with actor, IP, and user agent.
- **Known Phase 1 simplification to revisit in the Phase 5 security review**: the dashboard
  currently stores tokens in `localStorage` for simplicity. Before production launch this should
  move to httpOnly, `SameSite=strict` cookies with CSRF-token double-submit, to reduce XSS token
  theft risk.
- **Secrets**: everything sensitive is env-var driven (`.env`, never committed); `.env.example`
  documents every variable; `.env.test` holds only dummy dev/test values.

## Deployment

```bash
docker compose up -d --build
```

This builds and runs `postgres`, `redis`, `api` (port 3001), and `dashboard` (port 3000). Set
real secrets in `.env` before doing this outside of local development — see
[Generating secrets](#generating-secrets).

For a managed/production deployment: run `apps/api` behind a process manager (or the provided
Dockerfile) with `DATABASE_URL`/`REDIS_URL` pointing at managed Postgres/Redis, terminate TLS at
a load balancer/reverse proxy in front of both `api` and `dashboard`, and run
`npx prisma migrate deploy` as a release step (never `migrate dev` in production).

## Implementation phases

- [x] **Phase 1 — Foundation**: project setup, auth (register/login/refresh rotation), RBAC,
      user profiles, phone verification (OTP via a pluggable `SmsProvider`, mock implementation
      for dev/test), property + unit management, the full Prisma schema (all phases), audit
      logging.
- [ ] **Phase 2 — Messaging**: conversations, messages, Twilio/Telnyx `SmsProvider`
      implementations, inbound SMS webhook, outbound SMS, relay-number routing (including the
      numbered-menu disambiguation flow), delivery-status tracking, property-specific threads.
- [ ] **Phase 3 — Safety and moderation**: contact-information detection (regex, normalization,
      keyword/pattern rules, history analysis, optional AI fallback, image analysis), message
      blocking with sender-edit flow, escalating violations, moderator dashboard, fraud/abuse
      protections.
- [ ] **Phase 4 — Scheduling and applications**: showing scheduler + SMS reminders, application
      status, lease status, contact-release rules.
- [ ] **Phase 5 — Production readiness**: BullMQ queue workers for all async work, retry/DLQ
      logic, monitoring, analytics dashboards, full test suite (webhook/idempotency/retry/
      obfuscation tests), security review.

The full Prisma schema for every phase already exists (`apps/api/prisma/schema.prisma`) so later
phases only add services/controllers/tests against models that are already migrated — no
destructive schema rewrites.
