# Affordable Home Match

A property marketplace communication system that lets prospective/current tenants and
landlords/property managers text each other at native-SMS speed while every message is
relayed, moderated, and logged by the platform — neither side ever sees the other's real
phone number.

> **Status: Phase 1 (Foundation), Phase 2 (Messaging), and Phase 3 (Safety and moderation)
> complete**, plus the showing/tour scheduler and real-time (WebSocket) updates pulled forward
> from Phase 4. See [Implementation phases](#implementation-phases) below for what's built vs.
> planned.

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
| Payments | Provider-agnostic `PaymentProvider` interface (hosted checkout + webhook); Mock provider now, Square (Payment Links API, supports Cash App Pay) is the configured real processor |
| Geocoding | Provider-agnostic `GeocodingProvider` interface; Mock provider now, US Census Bureau geocoder (free, keyless) is the configured real one |
| Nearby schools | Provider-agnostic `SchoolsProvider` interface; Mock provider now, GreatSchools NearbySchools API is the configured real one |
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
      properties/        Property + unit CRUD, manager assignment; geocodes the address (and refreshes a
                         cached nearby-schools list) on create/update; address-specific, radius-based
                         rent estimate (not a city/zip bucket average)
      conversations/     Tenant-starts-conversation flow, relay assignment, RBAC
      messages/          Compose/list, moderation gate, SMS relay send, inbound ingestion
      moderation/        Contact-info detector (regex/normalization/pattern/keyword), message-
                         history split-detection + AI-fallback layer (pluggable, mocked), violation
                         escalation, and the moderator-facing admin API (flags/violations/
                         restrictions/admin notes)
      showings/          Showing/tour time-slot proposal + accept + cancel, nested under a conversation;
                         emails both sides a .ics calendar invite once a slot is accepted
      id-submissions/    Tenant pays a $5 convenience fee (PaymentProvider checkout), then submits an
                         ID file that's emailed straight through to whoever currently handles the
                         conversation (owner or assigned property manager) and never persisted
      gig-jobs/          Landlord/property-manager-posted gigs scoped to their own tenants (matched via
                         an existing Conversation, since Lease isn't wired up yet), or admin-posted gigs
                         visible platform-wide. A confirmed gig charges the poster via PaymentProvider
                         and issues a GigVoucher (payout minus a skimmed platform fee) instead of paying
                         the tenant cash — redemption is just a landlord-acknowledged record, since the
                         platform has no rent-ledger/invoicing of its own
      job-referrals/     Landlord/property-manager/admin-posted word-of-mouth about a real external job
                         opening (e.g. "McDonald's is hiring") that the poster doesn't control and isn't
                         paying for — pure information-sharing, so unlike gig-jobs there's no voucher, no
                         PaymentProvider charge, and no completion/claim workflow at all. Visibility uses
                         the same own-tenant-via-Conversation / admin-platform-wide scoping as gig-jobs
      payments/          PaymentProvider interface, Mock provider, Square provider (Payment Links API
                         + webhook signature verification) — shared by id-submissions and gig-jobs
      geocoding/         GeocodingProvider interface, Mock provider, US Census Bureau provider
      schools/           SchoolsProvider interface, Mock provider, GreatSchools provider
      realtime/          Socket.IO gateway broadcasting new messages / conversation / showing updates
      sms/               SmsProvider interface, Mock provider, inbound/delivery webhooks, routing
      audit/             AuditLog service + admin endpoint
      common/            Guards, decorators, crypto/phone/anonymization utils, filters, interceptors
      redis/             Redis client + rate limiter
      prisma/            PrismaService
      config/            Env loading + validation
    test/                e2e tests (supertest against a real Nest app + test DB)
  dashboard/             Next.js dashboard
    src/app/properties/          Browse + detail pages (photo, tabs, sticky "Message Landlord" bar)
    src/app/inbox/                Conversation list — property/status filters, unread indicator, unit label, last-message preview
    src/app/conversations/[id]/   Message thread + reply box, showing panel, live Socket.IO updates (polling only as a fallback)
    src/app/moderation/           Staff-only moderator dashboard: flag queue, review, violation/restriction history, admin notes, account suspend/restore, and an admin-only per-moderator suspend-permission toggle
    src/components/ShowingPanel.tsx  Propose/accept/cancel a showing time slot from the thread
    src/components/IdSubmissionPanel.tsx  Pay the $5 fee, then submit an ID file, from the thread
    src/app/gig-jobs/              Post/browse/claim/complete gig jobs, pay out, and manage rent vouchers,
                                    plus a separate "Job openings" section for no-voucher job referrals
    src/app/mock-checkout/         Dev-only stand-in for Square's hosted checkout page (PAYMENT_PROVIDER=mock)
    src/lib/use-conversation-socket.ts  Socket.IO client hook used by the conversation thread
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
window, open **Inbox**, and reply — the tenant sees the reply appear live (Socket.IO push, with a
30s poll purely as a fallback if the socket drops). Try including a phone number or email in a
message to see it get blocked instead of forwarded — including a spelled-out or lightly disguised
one ("nine zero four... " or "9O4-555-1234"), or one split across two separate messages. Sign in
as `moderator@example.com` and open **Moderation** to review anything escalated to staff (4th+
violation from the same user).

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
  `ADMINISTRATOR`/`SUPER_ADMINISTRATOR` (only a `SUPER_ADMINISTRATOR` can); suspend/restore; a
  `STAFF_MODERATOR` is forbidden from suspending anyone until an admin grants `canSuspendUsers`
  (and can never suspend another moderator or an admin even once granted), an admin can revoke
  the grant again, and an admin can always reverse any suspend/restore regardless of who did it
  (`test/rbac.e2e-spec.ts`).
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

**Phase 3** (`contact-info-detector.util.spec.ts`, `test/moderation-admin.e2e-spec.ts`, plus the
history-split case added to `test/conversations.e2e-spec.ts`) —
- **Full normalization**: spelled-out phone numbers ("nine zero four..."), letter/number
  lookalike substitution ("9O4-555-1234"), whitespace/dash-collapsed digit groups, and bare
  unpunctuated 10-digit runs are all detected — while ordinary counts/measurements ("3 bedroom 2
  bathroom", "four kids and two dogs") and casual words ("lol", "cool") are explicitly asserted
  *not* to false-positive.
- **Message-history analysis**: contact info deliberately split across two separate messages from
  the same sender in the same conversation ("nine zero four five five five" then "one two three
  four thanks") is caught on the message that completes it, tagged `HISTORY_ANALYSIS`, scoped to a
  short lookback window (message count + elapsed time) so unrelated numbers mentioned much earlier
  in a long conversation are never coincidentally stitched together.
- **AI fallback layer**: a real `AiModerationProvider` DI seam (`AI_MODERATION_PROVIDER` token)
  sits behind every deterministic rule, consulted only if all of them find nothing — bound to a
  `NullAiModerationProvider` mock in this environment (no external AI key configured), swappable
  for a real provider without any caller changing, exactly like `SmsProvider`.
- **Moderator dashboard**: staff-only RBAC on every `/moderation/*` route; the full
  escalation-then-review lifecycle (3 violations → warnings → 24h auto-restriction → staff lifts
  it → next violation escalates straight to `MODERATOR_REVIEW` → a `ModerationFlag` appears in the
  queue); reviewing a flag (clear/keep-under-review/confirm-block); imposing and lifting a
  restriction by hand; adding and listing admin notes on a conversation.
- **Delegated account suspension**: a `STAFF_MODERATOR` cannot suspend/restore any account until
  an admin grants `canSuspendUsers` for that specific moderator, can never touch another
  moderator's or admin's account even once granted, and loses the ability the moment an admin
  revokes it — while an admin can suspend/restore any account (and reverse a moderator's action)
  unconditionally, with every grant/revoke/suspend/restore recorded in the audit log.

**Showings + ID submissions** (`test/showings.e2e-spec.ts`, `test/id-submissions.e2e-spec.ts`) —
- **Showings**: only conversation participants can propose/view a showing; a past start time is
  rejected; accepting a slot schedules the showing and emails both the tenant and the current
  landlord-side contact a `.ics` calendar invite (asserted via the mock email provider's attachment
  filenames).
- **ID submissions**: only the conversation's tenant can start one; a duplicate call reuses the
  existing open submission instead of creating another; submitting is rejected until the $5 fee
  shows paid; a payment webhook with an unrecognized order ID is a no-op; once paid, submitting
  emails the ID file straight to the landlord-side contact and is rejected a second time; the
  tenant can cancel an unpaid submission.

**Geocoding, nearby schools, and address-specific rent estimates**
(`test/nearby-schools.e2e-spec.ts`, `test/property-extras.e2e-spec.ts`) —
- **Nearby schools**: creating a property automatically geocodes its address and populates a cached
  nearby-schools list (readable by anyone, refreshable by the owner/manager/staff only); updating a
  property's address re-triggers the refresh, while updating unrelated fields (e.g. rent) leaves the
  cached schools/`schoolsFetchedAt` untouched.
- **Rent estimate**: proven address-specific rather than city/zip-bucketed by placing two properties
  in the *same city* at controlled mock coordinates ~11 miles apart — the far one's rent is excluded
  from the estimate for an address near the first, while an identical-address query still averages
  correctly; an unresolvable address is distinguished from "resolved but no nearby comps."

**Gig jobs** (`test/gig-jobs.e2e-spec.ts`) — a landlord/property-manager-posted gig is visible only to
tenants who have a conversation with that same poster (proven by posting from two different landlords
and asserting each one's tenant sees only their own), while an admin-posted gig is visible platform-wide;
a claim is rejected if the tenant supplies a conversation belonging to someone else, or one with a
landlord the gig isn't scoped to, even though the conversation is genuinely theirs; the full
claim → complete → reject-completion → re-complete → pay → voucher lifecycle is run end-to-end, asserting
the platform fee is skimmed correctly (a $100 payout at the default 10% fee produces a $90 voucher, not
$100); only the landlord a voucher is earmarked for can mark it applied, and a second apply attempt is
rejected; a property manager's own-tenant scoping is proven to follow *current* manager assignments
rather than a tenant's pre-existing conversation with the prior owner.

**Job referrals** (`test/job-referrals.e2e-spec.ts`) — the same own-tenant-vs-platform-wide visibility
rule as gig jobs applies here too (a landlord-posted referral is scoped to only tenants who have a
conversation with that landlord; an admin-posted referral is visible to everyone), but a tenant can
never post one (403); an optional `applyUrl`/`contactInfo`/`description` are accepted and persisted, an
invalid `applyUrl` is rejected (400); and only the original poster can mark their referral filled
(another landlord gets 403, a second close attempt gets 400) — once closed it stops appearing in the
tenant-facing list but still shows as `CLOSED` in the poster's own list.

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
| PATCH | `/users/:id/suspend`, `/restore` | Admin+ unconditionally; a STAFF_MODERATOR only if granted `canSuspendUsers`, and never against another moderator/admin |
| PATCH | `/users/:id/suspend-permission` | Admin+ only — grants/revokes a specific moderator's `canSuspendUsers` |
| GET/POST | `/phone` | List / start OTP verification |
| POST | `/phone/confirm-verification` | |
| GET/POST | `/properties`, `/properties/:id` | Role-shaped response (see above) |
| PATCH | `/properties/:id` | Owner, assigned manager, or staff/admin |
| POST/PATCH | `/properties/:id/managers`, `/managers/:userId/revoke` | |
| GET/POST/PATCH | `/properties/:id/units`, `/units/:unitId` | |
| GET | `/properties/:id/schools` | Cached nearby-schools list (name, level, rating, distance) |
| POST | `/properties/:id/schools/refresh` | Owner/manager/staff only — forces a re-geocode + schools refresh |
| GET | `/properties/rent-estimate` | Address-specific (not city/zip-bucketed): geocodes `addressLine1`/`city`/`state`/`zip` and averages rent from units within a radius of those coordinates |
| POST | `/conversations` | Tenant-only: starts (or reuses) a conversation + sends the first message |
| GET | `/conversations`, `/conversations/:id` | Participant (or staff/admin) only |
| GET/POST | `/conversations/:id/messages` | Send runs the moderation gate before any relay/forward |
| POST | `/sms/webhooks/inbound` | Carrier webhook — routes to a conversation, or texts back a disambiguation menu |
| POST | `/sms/webhooks/delivery-status` | Carrier delivery-status callback |
| GET/POST | `/conversations/:id/showings` | Propose a showing / list showings for a conversation |
| PATCH | `/conversations/:id/showings/:showingId/slots/:slotId/accept` | Accept a proposed time slot — emails both sides a `.ics` calendar invite |
| PATCH | `/conversations/:id/showings/:showingId/cancel`, `/complete` | |
| GET/POST | `/conversations/:id/id-submissions` | Tenant-only: starts (or reuses) a $5 ID-submission checkout for that conversation |
| PATCH | `/id-submissions/:id/cancel` | Tenant cancels their own unpaid submission |
| POST | `/id-submissions/:id/submit` | Tenant uploads the ID file once paid — emailed to the current landlord-side contact, never stored |
| POST | `/payments/webhooks` | Payment processor (or the mock provider's dev checkout page) confirms a completed charge — shared by ID submissions and gig jobs |
| GET | `/gig-jobs` | Tenant view: open gigs visible to them (own landlord's + admin's) plus anything they've claimed |
| GET | `/gig-jobs/posted` | Poster view: every gig this landlord/manager/admin has posted |
| POST | `/gig-jobs` | Landlord/property manager (scoped to their own tenants) or admin (platform-wide) |
| PATCH | `/gig-jobs/:id/claim` | Tenant-only; validated against one of their own conversations |
| PATCH | `/gig-jobs/:id/complete`, `/reject-completion`, `/cancel` | |
| POST | `/gig-jobs/:id/pay` | Poster confirms completion — charges them via PaymentProvider; the voucher issues once the webhook confirms payment |
| GET | `/gig-vouchers/me`, `/gig-vouchers/issued` | Tenant's received vouchers / landlord's issued vouchers |
| PATCH | `/gig-vouchers/:id/apply` | The landlord the voucher is earmarked for marks it applied to rent |
| GET | `/job-referrals` | Tenant view: word-of-mouth about external job openings visible to them (own landlord's + admin's) — no voucher, no payment |
| GET | `/job-referrals/posted` | Poster view: every referral this landlord/manager/admin has posted |
| POST | `/job-referrals` | Landlord/property manager (scoped to their own tenants) or admin (platform-wide) |
| PATCH | `/job-referrals/:id/close` | Only the poster can mark their referral filled |
| GET | `/moderation/flags` | Staff/admin only — filterable by `status`; defaults to `FLAGGED`+`UNDER_REVIEW` |
| GET/PATCH | `/moderation/flags/:id`, `/flags/:id/review` | Review a flag: clear / keep under review / confirm block, with an optional note |
| GET | `/moderation/users/:userId/violations`, `/restrictions` | Staff/admin only |
| POST | `/moderation/users/:userId/restrictions` | Impose a messaging restriction/suspension by hand |
| POST | `/moderation/restrictions/:id/lift` | Lift a restriction early |
| GET/POST | `/moderation/conversations/:id/notes` | Internal admin notes on a conversation |
| GET | `/audit-logs` | Admin/staff only |
| WS | `conversations` namespace | Socket.IO — JWT-authenticated handshake, join a conversation room, receive `newMessage`/`conversationUpdated`/`showingUpdated` pushes |

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
  runs through a layered pipeline before it is ever stored as delivered or relayed, each layer
  only consulted if every earlier one found nothing: (1) deterministic regex/keyword rules
  (phone/email/URL, "at"/"dot" wording, social/payment handles, off-platform phrasing); (2) full
  text normalization (word-to-digit conversion, letter/number lookalike substitution, digit-
  separator collapsing, bare unpunctuated 10-digit runs); (3) message-history analysis, which
  re-runs the same detector over the sender's recent messages joined with the new one, catching
  contact info deliberately split across several sends; (4) an optional AI fallback behind a
  pluggable `AiModerationProvider` interface (mocked in this environment — no external AI call is
  ever made without a real provider bound in). A hit blocks the message (visible only to its own
  sender, so they can edit and resend), records a `Violation`, and escalates: 1st hit →
  educational warning, 2nd → stronger warning, 3rd → 24h messaging restriction, 4th+ → flagged for
  moderator review in the `/moderation` staff dashboard (queue, per-flag violation/restriction
  history, review actions, manual restrict/lift, admin notes). Image analysis for message
  attachments is intentionally **not** implemented yet — there is no file/attachment upload
  system in this build (it needs cloud storage + signed URLs, a Phase 5 dependency), so there is
  nothing yet for that layer to inspect.
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
  more admins. Account suspension follows the same pattern one level down: a `STAFF_MODERATOR`
  has no suspend/restore ability by default, only gains it per-moderator when an admin explicitly
  grants `canSuspendUsers` (toggleable from the moderator-permissions panel in `/moderation`), can
  only ever act on non-staff accounts even when granted, and an admin can revoke the grant or
  reverse any of their actions at any time.
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
- [x] **Phase 3 — Safety and moderation**: full layered contact-information detection (word-to-
      digit normalization, letter/number substitution, message-history analysis across split
      messages, an optional AI-fallback provider seam), and a staff-only moderator dashboard
      (flag queue, per-flag review, violation/restriction history, manual restrict/lift, admin
      notes). **Not yet done**: image analysis for message attachments (no file/attachment upload
      system exists in this build) and a real external AI moderation provider (the interface and
      DI seam are real; only a mock is bound in, since no AI API key is configured here).
- [ ] **Phase 4 — Scheduling and applications**: showing/tour scheduling landed early (proposal +
      accept + cancel + complete, live in the conversation thread) along with real-time
      WebSocket updates for new messages/status changes, both pulled forward from this phase.
      **Still pending**: SMS reminders for upcoming showings, application status, lease status,
      contact-release rules.
- [ ] **Phase 5 — Production readiness**: BullMQ queue workers for all async work, retry/DLQ
      logic, monitoring, analytics dashboards, full test suite (webhook/idempotency/retry/
      obfuscation tests), security review.

The full Prisma schema for every phase already exists (`apps/api/prisma/schema.prisma`) so later
phases only add services/controllers/tests against models that are already migrated — no
destructive schema rewrites.
