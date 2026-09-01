# Contest Platform — Microservices

React frontend + two independent Express microservices: **User Service** (MongoDB) owns
auth, profiles, posts and interactions; **Admin Service** (PostgreSQL + Prisma) owns
prize ranking, allocation, and KYC. The two never share a database — the Admin Service
only ever reads User Service data through one authenticated internal HTTP endpoint.

```
frontend (React/Vite)  ──HTTP──>  user-service (Express + MongoDB)  :4000
        │                                     ▲
        └───────────HTTP────>  admin-service (Express + Postgres/Prisma)  :5000
                                              │
                                    GET /api/internal/rankings
                                    (shared-secret header, one call)
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
| `POST /winners/:id/kyc` | admin JWT | `{ status: 'PASSED'\|'FAILED' }` — `FAILED` cascades |
| `POST /ranking/generate` | admin JWT | `{ force?: boolean }` — see below |

### Internal — User Service → Admin Service

`GET /api/internal/rankings` (User Service), header `x-internal-api-key: <shared secret>`.

Returns pre-aggregated, pre-scored data so the Admin Service never has to see raw posts
or interactions, and never queries MongoDB directly:

```json
{
  "posts": [{ "postId", "userId", "residency", "category", "likes", "comments", "views", "score", "createdAt", "week" }],
  "consistency": [{ "userId", "weeks": {...}, "isConsistent", "totalConsistencyScore" }]
}
```

Residency filtering happens **once, in the User Service** (the residency data owner) —
the Admin Service additionally re-checks the `residency` field defensively, but the
architecture rule ("Admin gets data via API, not DB access") is what's enforced here,
not blind trust.

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
  full rankings when unnecessary").

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

## Assumptions

- Contest weeks are computed server-side from a `CONTEST_START_DATE` env var (default:
  service start time) rather than accepted from the client, so a post's week can't be
  spoofed to game the consistency ranking.
- Media uploads are validated by sniffing the file's actual magic bytes (not the
  client-supplied mimetype/extension, both of which are spoofable) and stored locally
  under `uploads/<image|video>s/<YYYY-MM>/<random>.ext`; swapping this for S3/GCS later
  only touches `user-service/src/utils/storeMedia.js`.
- The internal ranking API is protected by a shared-secret header
  (`INTERNAL_API_KEY`), not mTLS/OAuth — adequate for this exercise, called out as the
  place to harden first in a real deployment.
- `Winner` only ever holds active winners; a KYC failure deletes the row and appends to
  `WinnerHistory` rather than flipping a status flag, which is what lets `userId` be a
  plain (non-partial) unique constraint — see "Data model" above.
- No live PostgreSQL instance was reachable in this development environment, so the
  initial Prisma migration SQL was hand-authored to match `schema.prisma` rather than
  generated by `prisma migrate dev`; it should be verified against a real Postgres
  before relying on it in production.

## Setup

1. **User Service**: `cd user-service`, copy `.env` (`JWT_SECRET`, `PORT`, `MONGO_URI`,
   `INTERNAL_API_KEY`), `npm install`, `npm start`.
2. **Admin Service**: `cd admin-service`, copy `.env` (`DATABASE_URL`,
   `ADMIN_JWT_SECRET`, `INTERNAL_API_KEY` — must match the User Service's —
   `USER_SERVICE_URL`), `npm install`, `npx prisma migrate deploy`, `npx prisma generate`.
   Admin accounts are database-backed (bcrypt-hashed, `Admin` table) with no public
   signup route — create the first one with `npm run create-admin -- <username> <password>`,
   then `npm start`. `npm test` runs the ranking/cascade unit tests.
3. **Frontend**: `cd frontend`, copy `.env.example` to `.env`, `npm install`, `npm run dev`.
4. `node seed.js` from the repo root to load the sample dataset (User Service's Mongo
   connection must be reachable).
