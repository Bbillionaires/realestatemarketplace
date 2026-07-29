# Landlord/Tenant Relay Messaging Platform

A property marketplace communication system that lets prospective/current tenants and
landlords/property managers text each other at native-SMS speed while every message is
relayed, moderated, and logged by the platform — neither side ever sees the other's real
phone number.

> **Status: Phase 1 (Foundation) and Phase 2 (Messaging) complete.** See
> [Implementation phases](#implementation-phases) below for what's built vs. planned.

## Contents

- [Architecture](docs/architecture.md) — system diagram, module boundaries, SMS provider
  abstraction, phone-privacy model, and the full database ER diagram (all Mermaid).
- This README — setup, testing, deployment, and security notes.

## Tech stack

| Concern | Choice |
|---|---|
| API | Node.js + TypeScript + **NestJS** (DI-based module boundaries, Guards for RBAC) |
| Database | PostgreSQL + **Prisma ORM** |
| Cache / queues / rate limits | **Redis** (rate limits + SMS routing-menu state now; BullMQ queues land in Phase 5) |
| Dashboard | **Next.js** (App Router) |
| SMS | Provider-agnostic `SmsProvider` interface; Mock provider now, Twilio/Telnyx implementations are a drop-in for Phase 5 |
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
      conversations/     Tenant-starts-conversation flow, relay assignment, RBAC
      messages/          Compose/list, moderation gate, SMS relay send, inbound ingestion
      moderation/        Contact-info detector (regex/normalization/keyword) + violation escalation
      sms/               SmsProvider interface, Mock provider, inbound/delivery webhooks, routing
      audit/             AuditLog service + admin endpoint
      common/            Guards, decorators, crypto/phone/anonymization utils, filters, interceptors
      redis/             Redis client + rate limiter
      prisma/            PrismaService
      config/            Env loading + validation
    test/                e2e tests (supertest against a real Nest app + test DB)
  dashboard/             Next.js dashboard
    src/app/properties/          Browse + detail pages (photo, tabs, sticky "Message Landlord" bar)
    src/app/inbox/                Conversation list
    src/app/conversations/[id]/   Message thread + reply box
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
`DevPassword123!`, two sample properties ("123 Main Street", "455 Oak Avenue") — the same ones
used in the routing-menu example in the spec — and a small pool of relay phone numbers so
conversations can be started immediately.

Try the messaging flow: sign in as `tenant@example.com`, open a property, tap **Message
Landlord**, send an inquiry. Sign in as `landlord@example.com` in another browser/incognito
window, open **Inbox**, and reply — the tenant sees the reply on refresh (the dashboard polls
every 5s). Try including a phone number or email in a message to see it get blocked instead of
forwarded.

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

### What's covered

**Phase 1** —
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

**Phase 2** (`test/conversations.e2e-spec.ts`, `test/sms-webhooks.e2e-spec.ts`) —
- **Conversation lifecycle**: tenant-initiated only, relay-number auto-assignment, reuse of an
  existing open conversation for the same tenant+property instead of duplicating it, status
  transition `NEW_INQUIRY → ACTIVE` on the landlord's first reply.
- **Anonymity**: the tenant is shown to the landlord as `Tenant #1234` everywhere (conversation
  header *and* every message bubble) — the tenant's real profile name is asserted absent from
  every landlord-facing response.
- **RBAC**: only conversation participants (or staff/admin) can view a conversation or its
  messages.
- **Moderation gate**: a message containing a phone number is blocked, never forwarded, visible
  only to its own sender (not the other party), and recorded as a `Violation`; three violations
  escalate warning → strong warning → 24h `UserRestriction`, after which further sends are
  rejected outright.
- **SMS webhooks**: inbound messages route to the correct conversation by relay number + sender
  phone hash; a duplicate webhook delivery (same provider message ID) never creates a duplicate
  message; when the same phone/relay pair matches more than one conversation, a numbered menu is
  texted back and the *original* message is delivered once the sender picks a number (the digit
  reply itself is never stored as a message); delivery-status callbacks update message status.

## API surface

All routes are prefixed with `/api`. Every route except `/auth/*` and `/sms/webhooks/*` requires
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
| POST | `/conversations` | Tenant-only: starts (or reuses) a conversation + sends the first message |
| GET | `/conversations`, `/conversations/:id` | Participant (or staff/admin) only |
| GET/POST | `/conversations/:id/messages` | Send runs the moderation gate before any relay/forward |
| POST | `/sms/webhooks/inbound` | Carrier webhook — routes to a conversation, or texts back a disambiguation menu |
| POST | `/sms/webhooks/delivery-status` | Carrier delivery-status callback |
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
- **Rate limiting**: global Nest Throttler (`GLOBAL_RATE_LIMIT_PER_MIN`, default 300/min per IP)
  plus a stricter per-route limit on `/auth/*` (`AUTH_RATE_LIMIT_PER_MIN`, default 10/min — read
  directly from `process.env` at module-load time since `@Throttle()` is evaluated before Nest's
  DI container exists, which is why `main.ts` loads dotenv as its very first import) and a
  Redis-backed limiter specifically for OTP send/confirm attempts (per-user and per-phone-number).
- **Message moderation gate**: every message — composed in-app or received via inbound SMS —
  runs through a deterministic contact-info detector (phone/email/URL regexes, an "at"/"dot"
  normalization pass, and keyword rules for social/payment handles and off-platform requests)
  *before* it is ever stored as delivered or relayed. A hit blocks the message (visible only to
  its own sender, so they can edit and resend), records a `Violation`, and escalates: 1st hit →
  educational warning, 2nd → stronger warning, 3rd → 24h messaging restriction, 4th+ → flagged
  for moderator review. This is intentionally the *minimal* rule-based layer — Phase 3 adds full
  word-to-digit normalization, pattern recognition, message-history analysis, an AI fallback, and
  image analysis on top of the same gate.
- **Tenant anonymity**: until a Phase 4 contact-release event, the tenant is shown to the
  landlord/property manager only as an anonymized `Tenant #1234` label (deterministic HMAC of
  their user ID, truncated to 4 digits) — in the conversation header, every message bubble, and
  the SMS notification text. Their real profile name never appears in anything the landlord can
  see; e2e tests assert this explicitly.
- **SMS relay privacy**: neither party's real phone number is ever used as the SMS "from"/"to"
  visible to the other side — every send uses the conversation's assigned `RelayNumber`, and
  routing an inbound reply never depends solely on (senderPhone, relayNumber), since that pair is
  reused across many conversations; when it's ambiguous, the platform texts back a numbered menu
  instead of guessing.
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
- [x] **Phase 2 — Messaging**: conversations (tenant-initiated, relay-assigned, one per
      tenant+property), messages (compose + list, moderation gate, SMS relay send), inbound SMS
      webhook with routing + numbered-menu disambiguation + idempotency, delivery-status webhook,
      property-specific threads, redesigned property browse/detail UI with a sticky "Message
      Landlord" CTA, landlord inbox + tenant/landlord conversation thread views. A minimal
      rule-based moderation gate (regex + basic normalization + keyword rules) with escalating
      enforcement ships now; Twilio/Telnyx `SmsProvider` implementations are the remaining piece
      for a real carrier (currently mocked end-to-end).
- [ ] **Phase 3 — Safety and moderation**: full layered contact-information detection (word-to-
      digit normalization, letter/number substitution, pattern recognition, message-history
      analysis, optional AI fallback, image analysis for attachments), moderator dashboard,
      administrator override, fraud/abuse protections beyond the Phase 2 baseline.
- [ ] **Phase 4 — Scheduling and applications**: showing scheduler + SMS reminders, application
      status, lease status, contact-release rules.
- [ ] **Phase 5 — Production readiness**: BullMQ queue workers for all async work, retry/DLQ
      logic, monitoring, analytics dashboards, full test suite (webhook/idempotency/retry/
      obfuscation tests), security review.

The full Prisma schema for every phase already exists (`apps/api/prisma/schema.prisma`) so later
phases only add services/controllers/tests against models that are already migrated — no
destructive schema rewrites.
