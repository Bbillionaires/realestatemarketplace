# HomeKey — Rental Marketplace

A rental listing marketplace for three account types:

- **Landlords** — list properties for rent with full lease terms: HUD/Section 8
  acceptance, price, lease length, tenant criteria, a utilities-paid-by
  statement, lawn care responsibility, late fee policy, and an optional
  work-for-rent arrangement.
- **Property managers** — manage listings on behalf of a landlord's account
  (create/edit listings, set showing availability, track appointments).
- **Tenants** — join for free, browse published listings, and chat with an AI
  screening assistant per listing. The assistant collects the info needed to
  check fit against the landlord's stated criteria; a deterministic rules
  engine (not the LLM) decides pass/fail, and the showing-booking calendar
  only unlocks once a tenant actually passes.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS v4
- **PostgreSQL** via **Prisma 7** (new `prisma-client` generator + `@prisma/adapter-pg` driver adapter — Prisma 7 requires an explicit adapter, there is no default query engine binary)
- **Auth**: hand-rolled credentials auth (bcrypt password hashing + signed JWT session cookies via `jose`), following the pattern in Next.js's own authentication guide — not a third-party auth library, to avoid peer-dependency risk on a brand-new major Next.js version
- **AI**: `@anthropic-ai/sdk`, model `claude-sonnet-5`, used only for the tenant-facing screening conversation. Tenant readiness is always decided by the deterministic gate in `src/lib/screening.ts`, never by the model's own judgment.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — a Postgres connection string.
- `SESSION_SECRET` — a random signing secret. Generate one with `openssl rand -base64 32`.
- `ANTHROPIC_API_KEY` — required for the AI screening chat to hold a
  conversation. Without it, the chat page still loads and shows the initial
  greeting, but sending a message returns a clean "temporarily unavailable"
  error instead of a reply.

### 3. Set up the database

```bash
npx prisma migrate dev
npm run db:seed
```

The seed script creates three demo accounts (password `Password123` for all):

- `landlord@example.com`
- `manager@example.com`
- `tenant@example.com`

...and one published sample listing with a few showing slots.

### 4. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000`.

## How the AI screening gate works

1. A tenant opens a listing and starts a screening chat (`POST /api/screening`).
2. Each message the tenant sends goes through two model calls
   (`src/lib/ai.ts`): one forced tool-call to extract structured answers
   (income, credit score, HUD voucher status, eviction history, move-in date,
   background-check consent), and one to generate the assistant's next reply.
3. After extraction, `evaluateScreening()` (`src/lib/screening.ts`) — plain
   rules, no LLM — checks the merged answers against the property's stated
   criteria and sets the session to `IN_PROGRESS`, `PASSED`, or `FAILED`.
4. The booking calendar for that property only renders once the session is
   `PASSED`. Booking itself (`bookAppointment` in
   `src/app/actions/booking.ts`) re-verifies `PASSED` server-side and uses a
   transaction with a conditional update to prevent double-booking a slot.

## Project layout

- `prisma/schema.prisma` — data model (users/roles, properties, utilities,
  availability slots, screening sessions/answers/messages, appointments).
- `src/lib/` — session/auth, Prisma client, Zod form schemas, the screening
  rules engine, and the Anthropic-backed chat helpers.
- `src/app/actions/` — Server Actions (auth, property CRUD, availability,
  booking).
- `src/app/api/screening/`, `src/app/api/properties/[id]/slots/` — route
  handlers used by the chat UI (which needs `fetch`-style calls, not just
  form-bound Server Actions).
- `src/proxy.ts` — route protection (Next.js 16 renamed Middleware to Proxy;
  same mechanism).

## Not yet built

- Payments (rent collection, deposits) — intentionally out of scope for this
  first pass; the data model doesn't preclude adding it later.
- Photo uploads — listings currently take an `imageUrls` string array with no
  upload UI.
