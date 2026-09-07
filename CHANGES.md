# Change Report

This document summarizes every change made to this project across the recent work
session: six architecture prompts, a live infrastructure test, and a dead-code
cleanup pass. It's a report of *what changed and why* — not project documentation
(see `README.md` for that).

---

## 1. Schema validation — Joi (backend) + Yup (frontend)

**Goal:** replace hand-written `if` validation checks with schema libraries.

- Added `joi` to `user-service` and `admin-service`; added `yup` to `frontend`.
- New files: `src/middlewares/validate.js` (generic Express middleware) and
  `src/validators/*Schemas.js` (per-domain Joi schemas) in both backend services.
- Every route that used to validate manually now runs `validate(schema)` first;
  controllers no longer contain hand-rolled `if (!x) return ...` checks for
  shape/format/length/enum rules. DB-dependent checks (uniqueness, existence)
  stayed in the service layer, since Joi has no DB access.
- `frontend/src/utils/validation.js` rewritten with Yup schemas behind the **same
  exported function signatures** (`validateAuth`, `validatePost`), so `Auth.jsx`
  and `CreatePost.jsx` needed zero changes. Added `validateResidency`, wired into
  `Profile.jsx`.
- Two small **intentional** behavior deltas (both stricter, not looser):
  - Admin winner `:id`: `"5abc"` used to silently parse to `5`; now rejected outright.
  - `ranking/generate`'s `force` flag: a non-boolean value now errors instead of
    being silently treated as `false`.
- Tests added: `authSchemas.test.js`, `postSchemas.test.js` (user-service),
  `authSchemas.test.js`, `winnerSchemas.test.js`, `rankingSchemas.test.js`
  (admin-service).

## 2. Repository pattern — routes → controllers → services → repositories

**Goal:** stop controllers from touching Mongoose models / Prisma directly.

- New `src/repositories/` in both services: thin wrappers with intention-revealing
  methods (`findByUsername`, `incrementCounter`, etc.), no business logic.
- New `user-service/src/services/authService.js`, `postService.js` — business logic
  (uniqueness checks, error translation, orchestration) moved out of controllers.
- `admin-service/src/services/winnerService.js` rewritten to call repositories
  instead of `prisma.winner.*`/`prisma.winnerHistory.*` directly; every repository
  method accepts an optional `client` (transaction handle) so the existing
  `prisma.$transaction` orchestration and 5x cascade-retry logic kept working
  unchanged.
- New `admin-service/src/services/adminAuthService.js` for symmetry (admin login
  logic moved out of the controller too).
- Controllers reduced to: parse request → call service → `sendResponse`/`sendError`.
- Left untouched on purpose: `admin-service/src/ranking/*.js` (pure functions, not
  data access) and, at the time, `user-service/src/controllers/internalController.js`
  (later folded into the repository pattern anyway during the NATS migration, #5).

## 3. Centralized config — `src/config/env.js`

**Goal:** one validated place that reads `.env`, instead of scattered `process.env.X`.

- New `user-service/src/config/env.js` and `admin-service/src/config/env.js`: each
  loads `.env` once, validates it with a Joi schema, and exports a frozen config
  object. Same fail-fast behavior as before (`Missing required environment
  variable: X` + `process.exit(1)`), verified by directly simulating a missing var.
- Every file that used to read `process.env.X` directly now imports `config/env.js`
  instead: `index.js`, `config/db.js`, `contestWeek.js`, the auth middlewares,
  `authService.js` (user-service); `index.js`, `userServiceClient.js`,
  `adminAuth.js`, `prismaClient.js`, `adminAuthService.js` (admin-service).
- No `.env` key names were renamed.

## 4. Shared auth module — `@internal/shared-auth`

**Goal:** deduplicate the near-identical JWT-verify logic in both services' auth
middlewares, without merging their secrets or response formats.

- New `shared/auth/` package (workspace-local, `file:../shared/auth` dependency —
  your explicit choice over a separate publishable package, since both services
  live in one repo).
- `verifyToken.js` exports `createAuthMiddleware({ secret, attachAs,
  onMissingToken, onInvalidToken })` and `createOptionalAuthMiddleware(...)` — only
  the token-verification *mechanics* live here; every service supplies its own
  secret and decides its own response shape via callbacks.
- `user-service/src/middlewares/{authMiddleware,optionalAuthMiddleware}.js` and
  `admin-service/src/middlewares/adminAuth.js` became thin wrappers around the
  shared factory. `JWT_SECRET` and `ADMIN_JWT_SECRET` were never merged — a test
  (`verifyToken.test.js`) proves a token signed with one secret is rejected against
  the other.

## 5. Message broker — NATS request/reply (replaces internal HTTP)

**Goal:** replace the synchronous `axios` call from Admin Service → User Service
with NATS request/reply, without changing the interaction pattern (still
synchronous/blocking from the caller's point of view, not fire-and-forget).

- Added `nats` to both services. New `src/messaging/natsClient.js` in each —
  **deliberately asymmetric** connection handling: user-service (subscriber)
  retries connecting forever and never blocks its public routes; admin-service
  (requester) fails within a bounded ~10s if NATS is unreachable, matching the old
  `axios` timeout, instead of hanging a request.
- User Service now subscribes on `internal.rankings.get` / `internal.users.get`
  (`src/messaging/internalSubscriber.js`) instead of exposing
  `GET /api/internal/rankings` / `GET /api/internal/users` over HTTP. Business logic
  moved into `src/services/internalService.js` (now using repositories, closing a
  gap left open in #2).
- **Removed** (this was a replace, not an addition): `internalController.js`,
  `internalAuthMiddleware.js`, the two `/api/internal/*` HTTP routes, the now-dead
  `INTERNAL_API_NOT_CONFIGURED` message.
- `admin-service/src/services/userServiceClient.js` rewritten to publish NATS
  requests instead of `axios.get` — **same exported function signatures**
  (`fetchRankingData()`, `fetchUsernames(userIds)`), so `winnerService.js` needed
  zero changes.
- Shared-secret auth preserved as a stamped `apiKey` field inside the NATS message
  payload (NATS request/reply has no built-in per-subject ACL) — same trust level
  as the old header check, not stronger.
- `axios` dependency removed from `admin-service` (no longer used anywhere).
- Tests added (mocking the NATS connection, no live broker needed):
  `userServiceClient.test.js` (admin-service); `internalSubscriber.test.js`,
  `internalService.test.js` (user-service).
- README updated: architecture diagram, API contract, Assumptions, Prerequisites/
  Setup (NATS as a 4th required local process), `.env` examples.

## 6. Background job queue — BullMQ on Redis

**Goal:** stop `POST /ranking/generate` and the KYC-FAILED cascade from blocking
the request while they do real work (NATS round trip + Prisma transaction with
retries).

- Added `bullmq` + `ioredis` to `admin-service`. New `src/queue/rankingQueue.js`
  (producer: `enqueueGenerate`, `enqueueKycFailedCascade`, `getJobStatus`) and
  `src/workers/rankingWorker.js` — a **separate process** (`npm run worker`), not
  started by the main server.
- `POST /ranking/generate` and `POST /winners/:id/kyc` (FAILED only) now return
  `202 { message, jobId }` immediately; a worker dispatches by job name to the
  exact same `winnerService.generateInitialRankings` /
  `markKycFailedWithCascade` — **unchanged**, including the 5x unique-constraint
  retry logic. KYC `PASSED` stays fully synchronous (trivial single-row update).
- New `GET /api/ranking/jobs/:jobId` for polling.
- The non-idempotency guard (409 if winners already exist and `force` isn't set)
  was extracted into `winnerService.assertRankingsNotYetGenerated` so it still runs
  as an instant **synchronous** pre-enqueue check, not discovered later via polling.
- **Bug caught and fixed before shipping:** BullMQ's required
  `maxRetriesPerRequest: null` setting means a naive Redis connection would *hang
  indefinitely* (not fail fast) if Redis were down — the opposite of what was
  asked. Fixed with a bounded `retryStrategy` on the producer-side connection
  (fails after ~5 attempts) while the worker's own separate connection retries
  forever, mirroring the same asymmetric pattern used for NATS in #5.
- `frontend/src/pages/AdminDashboard.jsx` updated (explicitly confirmed with you
  first, since it changes the UX from synchronous to async/polling): added a
  `pollJob()` helper (1.5s interval, 2-minute timeout), wired into both
  `generateRankings` and the KYC-FAILED path in `handleKyc`. `PASSED` stays
  synchronous.
- Tests added (mocking BullMQ/ioredis, no live Redis needed):
  `rankingQueue.test.js`, `rankingWorker.test.js`, `winnerService.test.js`.
- README updated: new "Background job queue" section, Assumptions (Redis as a 5th
  required process + a 2nd Admin Service process to run), Prerequisites/Setup,
  Quick reference table.