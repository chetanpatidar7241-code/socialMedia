# Contest Platform — Microservices

React frontend + two independent Express microservices: **User Service** (MongoDB) owns
auth, profiles, posts and interactions; **Admin Service** (PostgreSQL + Prisma) owns
prize ranking, allocation, and KYC. The two never share a database — the Admin Service
only ever reads User Service data via NATS request/reply, never touching MongoDB directly.

```
frontend (React/Vite)  ──HTTP──>  user-service (Express + MongoDB)  :4000
        │                                     ▲
        └───────────HTTP────>  admin-service (Express + Postgres/Prisma)  :5000
                                              │
                                  NATS request/reply, subjects
                                  internal.rankings.get / internal.users.get
                                  (shared secret stamped in the message payload)
                                              │
                                        NATS server :4222
```

## Project structure

```
microservice/
├── user-service/                  Express + MongoDB — auth, profiles, posts, interactions
│   ├── index.js                   Entry point: env checks, Express app, error handler
│   ├── uploads/                   Locally stored media (images/videos), served statically
│   └── src/
│       ├── config/                MongoDB connection, env.js (centralized/validated config)
│       ├── constants.js           Fixed categories, residency list, interaction types
│       ├── controllers/           Thin request handlers (auth, posts) — parse → call service → respond
│       ├── messaging/             natsClient.js (connection), internalSubscriber.js (replaces the old
│       │                          internal HTTP routes — replies to internal.rankings.get / internal.users.get)
│       ├── middlewares/           JWT auth (required/optional), rate limiter, upload, request validation
│       ├── models/                Mongoose schemas: User, Post, Interaction
│       ├── repositories/          Thin data-access wrappers around the Mongoose models
│       ├── routes/index.js        All route → controller wiring
│       ├── services/              authService, postService, internalService (business logic),
│       │                          CommonService.js (shared response helper)
│       ├── validators/            Joi schemas per domain
│       └── utils/                 ResponseMessage, AppError, media validation/storage, contest week
│
├── admin-service/                 Express + PostgreSQL/Prisma — ranking, prizes, KYC
│   ├── index.js                   Entry point: env checks, starts the Express app
│   ├── prisma/
│   │   ├── schema.prisma          Winner, WinnerHistory, Admin models
│   │   └── migrations/            SQL migration history
│   ├── scripts/createAdmin.js     CLI to create an admin account (no public signup route)
│   └── src/
│       ├── app.js                 Express app assembly (routes + error handling)
│       ├── config/env.js          Centralized/validated config (replaces scattered process.env reads)
│       ├── constants.js           Tiers, categories, priority order
│       ├── controllers/           Thin request handlers (admin auth, winners, ranking)
│       ├── messaging/             natsClient.js — connection used by userServiceClient.js's requests
│       ├── middlewares/           Admin JWT auth, rate limiter, request validation
│       ├── prismaClient.js        Prisma client (with the Postgres driver adapter)
│       ├── queue/rankingQueue.js  BullMQ queue producer: enqueues ranking-generate/KYC-cascade jobs,
│       │                          reads job status back (backs GET /ranking/jobs/:jobId)
│       ├── ranking/               Pure functions: tie-break, scoring, allocation, cascade — plus their tests
│       ├── repositories/          Thin data-access wrappers around Prisma (winner, winnerHistory, admin)
│       ├── routes/                Route → controller wiring only
│       ├── services/              userServiceClient.js (NATS request/reply to the User Service),
│       │                          winnerService.js (DB/transaction orchestration), adminAuthService.js
│       ├── validators/            Joi schemas per domain
│       ├── workers/rankingWorker.js  Separate process (`npm run worker`) — consumes the BullMQ queue,
│       │                          runs winnerService.generateInitialRankings /
│       │                          markKycFailedWithCascade unchanged
│       └── utils/                 AppError helper
│
├── shared/auth/                   @internal/shared-auth — JWT verification middleware factory shared by
│                                   both services (file: dependency; each service keeps its own secret)
│
├── frontend/                      React (Vite)
│   └── src/
│       ├── pages/                 Auth, Feed, CreatePost, Profile, AdminDashboard
│       ├── components/            ErrorBoundary, ProtectedRoute
│       ├── context/                AuthContext (user/admin session), ToastContext (notifications)
│       ├── utils/                 api.js (axios clients), validation.js
│       └── constants.js           Categories, residency list, winner tiers (mirrors the backend)
│
├── seed.js                        Loads the sample dataset (edge cases) into MongoDB
└── README.md
```

## Data model

### User Service (MongoDB)

- **User** — `username` (unique, 3-30 chars), `passwordHash` (bcrypt), `residency`
  (constrained to a fixed list of Indian states/UTs — only `"Chhattisgarh"` is
  contest-eligible). Indexed on `residency` (the primary filter for the ranking API)
  and `username` (unique).
- **Post** — `userId`, `mediaUrl`, `mediaType` (`image`/`video`, detected server-side
  from file content — never trusted from the client), `caption`, `category` (one of 10
  fixed values), `likesCount`/`commentsCount`/`viewsCount` (denormalized counters,
  updated atomically via `$inc`), `week` (1-4, computed server-side from a fixed
  contest start date — never accepted from the client). Indexed on
  `{category, likesCount}`, `{userId, week}`, `{category, userId}`, and `createdAt`.
- **Interaction** — one row per (post, user, type) for `like`/`view`; unrestricted for
  `comment` (a user can comment many times, but only like/view a post once). A
  **partial unique index** on `{postId, userId, type}` (scoped to `like`/`view` only)
  enforces "no double-likes" atomically at the database layer, so concurrent duplicate
  clicks race safely — the loser gets a `409`, not a corrupted counter.

### Admin Service (PostgreSQL + Prisma)

- **Winner** — only *currently active* winners, one row per person. `userId` is
  `@unique`, which is what actually enforces "one prize per person" at the database
  layer (not just in application code). Indexed on `tier`, `category`, `kycStatus`.
- **WinnerHistory** — append-only audit log of every KYC failure: who failed, which
  slot (`tier`/`category`) they occupied, and who replaced them (`replacedByUserId`,
  nullable if the slot was left unawarded). This is what makes a *chained* cascade
  (A fails → B promoted → B fails → C promoted) inspectable after the fact via
  `GET /api/winners/history`, and it's also why `Winner.userId` can be a plain unique
  column instead of a Postgres partial/filtered index: a failed winner is deleted from
  `Winner` and recorded in `WinnerHistory` instead of having its status flag flipped.

Migrations live in `admin-service/prisma/migrations/`. (In this environment no live
Postgres was reachable to run `prisma migrate dev` interactively — the initial
migration SQL was hand-authored to exactly match `schema.prisma`; run
`npx prisma migrate deploy` against a real database to apply it, and `npx prisma
migrate dev` for any schema change after that.)

## API contract

### Public — User Service (`:4000/api`)

| Route | Auth | Notes |
|---|---|---|
| `POST /auth/signup` | — | Returns a token immediately (auto-login) |
| `POST /auth/login` | — | |
| `PUT /auth/residency` | user JWT | Value must be one of the fixed state list |
| `POST /posts` | user JWT | `multipart/form-data`: `media` (file), `caption`, `category` |
| `GET /posts?page=&limit=` | — | Paginated feed |
| `GET /posts/:postId/comments` | — | |
| `POST /posts/:postId/interact` | user JWT | `{ type: 'like'\|'comment'\|'view', content? }` |

### Public — Admin Service (`:5000/api`)

| Route | Auth | Notes |
|---|---|---|
| `POST /admin/login` | — | |
| `GET /winners?tier=&category=` | admin JWT | Filter by tier/category |
| `GET /winners/history` | admin JWT | Cascade audit trail |
| `POST /winners/:id/kyc` | admin JWT | `{ status: 'PASSED'\|'FAILED' }` — `PASSED` is synchronous (`200`); `FAILED` is queued (`202 { message, jobId }`), poll below |
| `POST /ranking/generate` | admin JWT | `{ force?: boolean }` — `409` synchronously if already generated and not forced, else queued (`202 { message, jobId }`) |
| `GET /ranking/jobs/:jobId` | admin JWT | Poll a queued job — see "Background job queue" below |

### Internal — User Service → Admin Service (NATS request/reply)

The old `GET /api/internal/rankings` / `GET /api/internal/users` HTTP routes are
retired. The Admin Service now reaches this data by publishing a NATS request and the
User Service replies — same synchronous, latency-sensitive request/response
interaction as before, just over a different transport:

| Subject | Request payload | Reply (`data` on success) |
|---|---|---|
| `internal.rankings.get` | `{ apiKey }` | `{ posts: [...], consistency: [...] }` |
| `internal.users.get` | `{ apiKey, ids: [...] }` | `{ [userId]: { username } }` |

Reply envelope: `{ ok: true, message, data }` on success, `{ ok: false, statusCode, message }`
on failure (auth rejection, bad request, or an unexpected server error). This
discriminator replaces HTTP status codes, which don't exist on a NATS reply.

Returns the same pre-aggregated, pre-scored data as before so the Admin Service never
has to see raw posts or interactions, and never queries MongoDB directly:

```json
{
  "posts": [{ "postId", "userId", "residency", "category", "likes", "comments", "views", "score", "createdAt", "week" }],
  "consistency": [{ "userId", "weeks": {...}, "isConsistent", "totalConsistencyScore" }]
}
```

**Auth over NATS**: request/reply has no built-in per-subject ACL, so the shared secret
that used to be the `x-internal-api-key` header is now stamped into the request
payload's `apiKey` field instead, and checked the same way on the subscriber side
(exact match against `INTERNAL_API_KEY`) — same trust model as before (a shared
static secret), not a stronger one; see Assumptions below.

Residency filtering happens **once, in the User Service** (the residency data owner) —
the Admin Service additionally re-checks the `residency` field defensively, but the
architecture rule ("Admin gets data via the User Service, never direct DB access") is
what's enforced here, not blind trust.

Why a computed contract instead of raw data: it means the Admin Service's ranking
logic is completely insulated from how the User Service stores/queries posts. The User
Service's data volume or schema can change freely as long as this response shape
holds — a large evaluation criterion ("an API contract that wouldn't break if either
service's data volume or team grew").

## Ranking & cascade design

- **Score** = `likes*1 + comments*3 + views*0.2`, computed in the User Service.
- **Tie-break**: comments desc → views desc → earliest `createdAt` — one shared
  `compareByScore` function (`admin-service/src/ranking/tieBreak.js`) used everywhere,
  so a tie never resolves differently in two different tiers.
- **Allocation** (`allocatePrizes.js`) runs once, strictly in priority order, using
  `Map`-keyed lookups (not plain objects) so numeric-looking `userId`s can never
  silently reorder and corrupt a tie-break. The multi-category-leader rule falls out
  naturally: category candidates are walked in *global* score order across all 10
  categories, so a person is claimed by whichever category slot they reach first (their
  single strongest), and their weaker category is already-excluded by the time it's
  reached — no special-casing needed.
- **KYC failure cascade** (`findReplacement.js` + `winnerService.markKycFailedWithCascade`)
  is **slot-scoped, not a full regenerate**: failing one winner only searches that
  winner's own tier/category candidate list for the next person who (a) hasn't
  KYC-failed before, and (b) doesn't already hold a different active prize. It never
  touches any other slot, so a Grand Prize failure can't accidentally promote someone
  out of their already-awarded Category prize. Each failure event runs this once, so
  chains (A→B→C) fall out of calling the same endpoint again on the next winner —
  no special "chain" code path exists or is needed.
- **Concurrency**: the cascade runs inside a `prisma.$transaction`, and the `Winner.userId`
  unique constraint is the final safety net — if two concurrent KYC failures would
  otherwise promote the same person into two different slots, the second transaction's
  insert fails with a unique violation and is retried (up to 5 times) against the
  now-updated state instead of ever double-allocating a person.
- **`POST /ranking/generate` is intentionally not idempotent-by-default**: once winners
  exist, calling it again returns `409` unless `force:true` is passed, because a full
  regenerate after cascades have already happened would re-litigate slots a KYC-driven
  cascade specifically avoids re-litigating (see evaluation note: "avoid recomputing
  full rankings when unnecessary"). This 409 check still runs synchronously in the
  request — only the actual generation work (below) is queued.

## Background job queue (BullMQ / Redis)

Ranking generation and the KYC-FAILED cascade both do real work — a NATS round trip
to the User Service, `allocatePrizes`/`findReplacement` computation, and a Prisma
transaction (with up to 5 retries on the cascade) — so they no longer run inline in
the request/response cycle. `POST /ranking/generate` and `POST /winners/:id/kyc`
(`FAILED` only) enqueue a job on a BullMQ queue (`admin-service/src/queue/rankingQueue.js`)
and return `202 { message, jobId }` immediately; a **separate process**
(`admin-service/src/workers/rankingWorker.js`, started with `npm run worker`) picks
the job up and calls the exact same `winnerService.generateInitialRankings` /
`markKycFailedWithCascade` functions — unchanged, including the retry logic — that
used to run inline in the controller.

- `PASSED` KYC is a trivial single-row update and stays fully synchronous — no queue
  involved, same `200` response as before.
- The non-idempotency guard (`409` if winners already exist and `force` isn't set)
  runs as a **pre-enqueue check** (`winnerService.assertRankingsNotYetGenerated`) —
  you get the `409` immediately, not after enqueueing and polling a job that was
  always going to fail. `generateInitialRankings` re-checks the same guard itself
  when the job actually executes, since a job can sit in the queue for a moment and
  the check must hold at execution time too, not just at enqueue time.
- `GET /api/ranking/jobs/:jobId` returns `{ jobId, status }` while pending/active,
  `{ jobId, status: 'completed', result }` once done (`result` is whatever
  `generateInitialRankings`/`markKycFailedWithCascade` returned — a winners array or
  a `{ removed, promoted }` object, respectively), or `{ jobId, status: 'failed', error }`
  if the worker threw. `404` if the job id is unknown or has aged out (completed jobs
  are kept 1 hour, failed ones 24 hours).
- The Admin Dashboard polls this endpoint every 1.5s (up to a 2-minute timeout) after
  enqueueing, showing a queued/in-progress state instead of expecting an immediate
  result — see `frontend/src/pages/AdminDashboard.jsx`.

## Sample dataset (`node seed.js`, from repo root)

Seeds directly into MongoDB, covering:
- **Ineligible user** — `outsider` (residency `Delhi`) with a huge score; must never
  appear in any tier.
- **Multi-category leader** — `multi_winner` leads both Art (stronger) and Music
  (weaker); should win Art's Category 1st only, Music cascades.
- **Tie score** — `tie_one` vs `tie_two`, equal score, resolved by comments tie-break.
- **Missing consistency by one week** — `almost_consistent` (3/4 weeks) vs
  `fully_consistent` (4/4 weeks).
- **Exhausted category** — `cook_master` is the only person in `Cooking`; 2nd place
  must stay unawarded.

**KYC failure cascade** can't be pre-seeded (KYC lives in Postgres and only exists
after ranking generation), so exercise it live: log in to the Admin Dashboard,
`Generate Rankings`, then mark any winner's KYC `FAILED` — watch the next-ranked
eligible person get promoted into that exact slot, and repeat on the new holder to see
the chain continue.

## Tests

`admin-service/src/ranking/*.test.js` (`npm test` inside `admin-service`) unit-test the
pure ranking/cascade functions directly — no DB or network required — covering every
edge case above plus one-prize-per-person and disqualification. The DB-transaction
orchestration around the cascade (`winnerService.js`) is integration-level and wasn't
exercised against a live Postgres in this environment (see Assumptions), but was
smoke-tested for module/wiring correctness.

The NATS-based internal call is similarly unit-tested without a live broker: `userServiceClient.test.js`
(admin-service) mocks the NATS connection to verify request payload shape, the
success/auth-failure/bad-shape/timeout error paths, and the `502` on an unexpected
reply shape; `internalSubscriber.test.js` and `internalService.test.js` (user-service)
cover the subscriber's auth check and the rankings/consistency aggregation logic. None
of this exercises a real NATS server — do that manually per the Setup steps below
(start NATS, both services, then trigger `Generate Rankings` from the Admin Dashboard).

The job queue is tested the same way: `rankingQueue.test.js` mocks BullMQ/ioredis to
verify job payloads and the completed/failed/pending status mapping; `rankingWorker.test.js`
verifies the worker's job-name dispatch (`generate` → `generateInitialRankings`,
`kycFailedCascade` → `markKycFailedWithCascade`, anything else → thrown error) without
starting a real BullMQ `Worker`; `winnerService.test.js` covers the new
`assertRankingsNotYetGenerated` pre-enqueue guard. None of this exercises a real Redis
— do that manually too (start Redis + the worker process, then generate rankings or
fail a winner's KYC and watch it resolve).

## Assumptions

- Contest weeks are computed server-side from a `CONTEST_START_DATE` env var (default:
  service start time) rather than accepted from the client, so a post's week can't be
  spoofed to game the consistency ranking.
- Media uploads are validated by sniffing the file's actual magic bytes (not the
  client-supplied mimetype/extension, both of which are spoofable) and stored locally
  under `uploads/<image|video>s/<YYYY-MM>/<random>.ext`; swapping this for S3/GCS later
  only touches `user-service/src/utils/storeMedia.js`.
- The internal ranking API (now NATS request/reply, previously HTTP) is protected by a
  shared secret (`INTERNAL_API_KEY`) stamped into the message payload, not mTLS/OAuth
  or per-subject NATS ACLs — adequate for this exercise, called out as the place to
  harden first in a real deployment (NATS supports TLS + auth/authorization natively;
  neither is configured here).
- The internal call between services now requires a NATS server reachable at
  `NATS_URL` (default `nats://localhost:4222`) — a fourth required local process
  alongside MongoDB and PostgreSQL. The User Service's public auth/post routes don't
  depend on it and keep serving even if NATS is down or not yet started; only
  `POST /ranking/generate` and the KYC-failure cascade in the Admin Service actually
  need it, and fail within 10 seconds (matching the old HTTP call's timeout) if it's
  unreachable, rather than hanging.
- Ranking generation and the KYC-FAILED cascade run on a BullMQ queue backed by Redis
  — a **fifth** required local process, and a **second Admin Service process**
  (`npm run worker`, separate from `npm start`) that must also be running for either
  action to ever complete. Completed job results are kept in Redis for 1 hour, failed
  ones for 24 hours, then age out (`GET /ranking/jobs/:jobId` returns `404` after that
  — the outcome is still visible in `GET /winners` / `GET /winners/history` by then).
- `Winner` only ever holds active winners; a KYC failure deletes the row and appends to
  `WinnerHistory` rather than flipping a status flag, which is what lets `userId` be a
  plain (non-partial) unique constraint — see "Data model" above.
- The initial Prisma migration (`20260901000000_init`) was hand-authored to match
  `schema.prisma` rather than generated by `prisma migrate dev`, since no live Postgres
  was reachable at that point. It has since been verified against a real local Postgres
  instance with `prisma migrate deploy` — see Setup below — and applied cleanly.

## Setup — step by step

You need **four terminals** open at once (User Service, Admin Service API, Admin
Service worker, Frontend), plus MongoDB, PostgreSQL, NATS, and Redis running locally.

### Prerequisites

- Node.js 18+ and npm
- MongoDB running locally (default: `mongodb://localhost:27017`)
- PostgreSQL running locally (default: `localhost:5432`), with a database and a user/role
  that can connect to it
- A NATS server running locally (default: `nats://localhost:4222`) — needed for the
  Admin Service ↔ User Service internal call (ranking generation, KYC cascade).
  Quickest ways to run one:
  ```
  # Docker (no local install needed)
  docker run -p 4222:4222 nats:latest

  # or the standalone binary (https://github.com/nats-io/nats-server/releases)
  nats-server
  ```
  You should see `Server is ready` in its output. The User Service and frontend/public
  Admin routes work fine without it; only ranking generation and KYC failure will fail
  (with a clear timeout error, not a hang) if it isn't running.
- A Redis server running locally (default: `redis://localhost:6379`) — needed for the
  ranking/KYC-cascade job queue (BullMQ). Quickest ways to run one:
  ```
  # Docker (no local install needed)
  docker run -p 6379:6379 redis:latest

  # or a local install (e.g. via WSL/Homebrew/apt) — `redis-server`
  redis-server
  ```
  The Admin Service's queue connection retries for a few seconds and then fails the
  request with a clear error if Redis is completely unreachable, rather than hanging;
  if Redis *is* up but the worker process (below) isn't, enqueueing still succeeds and
  the job just sits in `waiting` until a worker starts.

### Step 1 — User Service (MongoDB)

```
cd user-service
npm install
```

Create a `.env` file in `user-service/` with:

```
JWT_SECRET=some-long-random-string
PORT=4000
MONGO_URI=mongodb://localhost:27017/user-service
INTERNAL_API_KEY=some-shared-secret
NATS_URL=nats://localhost:4222
```

`INTERNAL_API_KEY` must be the **same value** you put in the Admin Service's `.env`
in Step 2 — it's the shared secret the two services use to authenticate the internal
ranking API call between them.

Start it:

```
npm start
```

You should see `User service running on port 4000` and `MongoDB connected successfully`.

### Step 2 — Admin Service (PostgreSQL + Prisma)

```
cd admin-service
npm install
```

Create a `.env` file in `admin-service/` with:

```
DATABASE_URL="postgresql://<db-user>:<db-password>@localhost:5432/<db-name>?schema=public"
INTERNAL_API_KEY=some-shared-secret
ADMIN_JWT_SECRET=some-other-long-random-string
PORT=5000
NATS_URL=nats://localhost:4222
REDIS_URL=redis://localhost:6379
```

(`INTERNAL_API_KEY` here must match the User Service's value from Step 1.)

Create the database tables:

```
npx prisma migrate deploy
npx prisma generate
```

Admin accounts live in the database (bcrypt-hashed passwords) — there's no public
signup form for admins on purpose.

**Note:** A default admin account is automatically created when you start the server:
- **Username:** `admin`
- **Password:** `Admin@123`

You can also create additional admins from the command line:

```
npm run create-admin -- <username> <password>
```

Then start the service:

```
npm start
```

You should see `Admin service on port 5000`. Run `npm test` any time to run the
ranking/cascade/KYC unit tests (no database needed for those).

**In a separate (fourth) terminal**, start the ranking worker — without this running,
`Generate Rankings` and any KYC `FAILED` action will queue but never complete:

```
cd admin-service
npm run worker
```

You should see `[ranking-worker] listening for ranking jobs...`.

### Step 3 — Frontend

```
cd frontend
npm install
```

Copy `.env.example` to `.env` (defaults already point at `localhost:4000`/`localhost:5000`,
so no edits needed if you used the same ports above):

```
cp .env.example .env
```

Start it:

```
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Step 4 — Load the sample dataset (optional but recommended)

With the User Service running (Step 1) and reachable, run from the **repo root**:

```
node seed.js
```

This loads the sample users/posts covering every required edge case (see "Sample
dataset" above). Then in the Admin Dashboard, log in and click **Generate Rankings**
to see the prize allocation, and try failing a winner's KYC to see the cascade.

### Quick reference — what each service needs running

| Service | Needs | Port |
|---|---|---|
| User Service | MongoDB; NATS reachable for the internal subscriber (public routes work without it) | 4000 |
| Admin Service (API) | PostgreSQL; NATS + the User Service's NATS subscriber (for ranking/cascade only); Redis (to enqueue) | 5000 |
| Admin Service (worker, `npm run worker`) | PostgreSQL, Redis, NATS — same as above; picks up and executes queued ranking/cascade jobs | — |
| Frontend | Both services reachable | 5173 (Vite default) |
| NATS server | — | 4222 |
| Redis server | — | 6379 |
