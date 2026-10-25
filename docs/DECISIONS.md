# Decisions Log

Recorded deviations and clarifications per Constitution Principle VIII (Spec Fidelity and
Recorded Deviations).

Precedence: (1) `specs/SHELFHELP_FULLSPEC.md` §3 Decisions and §4 Policies; (2) the original
proposal PA1; (3) engineering judgment recorded here.

---

## DEC-LOG-01 — Flask + Firebase demo scaffold is retired; Supabase is canonical

**Date**: 2025-10-25
**Status**: Accepted
**Relates to**: SRS DEC-54, SRS §10.2, Constitution Stack & Architectural Constraints

**Context.**
The repository contained an early demo scaffold built on a different stack than the
authoritative specification:

| Area | Content | Size |
|---|---|---|
| `src/backend/` | Flask API: health endpoint, `require_auth` decorator, books CRUD, Firebase Admin init | ~268 lines |
| `src/firebase/firestore.rules` | Firestore security rules | 29 lines |
| `src/frontend/` | React + Vite demo (login + book list) | ~220 lines |

The specification (DEC-54) mandates Supabase — Postgres, Auth, Storage, Edge Functions, and
`pg_cron` — and explicitly rejects Firestore because it requires a paid plan for scheduled jobs
and server code, and provides no joins, constraints, or full-text search.

**Decision.**
Supabase is canonical. The Flask backend and Firestore rules are retired as legacy demo code and
are not to be extended.

- `src/backend/` — **retired**. No further development. Remaining code is reference only and should
  be deleted once the Supabase foundation (M0) exists.
- `src/firebase/` — **retired**. Superseded by Supabase Storage policies and Postgres RLS.
- `src/frontend/` — **kept**. React + Vite matches SRS §10.2. It must be rewired from the Firebase
  JS SDK to `supabase-js`, and `context/AuthContext.jsx` must move to Supabase session handling.

**Rationale.**
The scaffold implements 2 of 107 functional requirements (health check, book list) and contains no
business logic to preserve. The specification's hardest requirements — checkout concurrency
(`FOR UPDATE SKIP LOCKED`), gap-free receipt numbering, receipt immutability, the reservation
promotion engine, fine caps, diacritic-aware search (`unaccent` + `pg_trgm`), vector retrieval
(`pgvector`), scheduled jobs (`pg_cron`), and deny-by-default row authorization (RLS) — are all
native to Postgres and would have to be reimplemented by hand in a Flask/Relational-database
combination. Retiring the scaffold is near-zero cost; retaining it would mean rebuilding the
specification's infrastructure.

**Known defect in retired code.**
`src/firebase/firestore.rules` declares `service cloud.firestore` twice in one file. Firestore
permits one service block per rules file, so this file is invalid as written. Recorded for
completeness only; the file is retired and will not be fixed.

**Consequences.**
- The README must be updated to describe the Supabase stack, replacing the Flask/Firebase table.
- Bootstrap instructions for Flask, `.env` service account keys, and Firestore rules become
  obsolete and should be replaced with Supabase CLI setup.
- The Supabase foundation is milestone **M0** in SRS §19.

**Resolution (2025-10-25).** The retirement gate in `M0-PLAN.md` §D5 ("keep until M0b") is met,
and the deletions have been carried out:

| Path | Action | Note |
|---|---|---|
| `src/backend/` | **Deleted** (7 files) | Flask app, `firebase_admin` init, Firestore routes, `requirements.txt`, `.env.example` |
| `src/firebase/` | **Deleted** | `firestore.rules` including the duplicate `service cloud.firestore` defect above — the defect is moot, the file is gone |
| `supabase/` (repo root) | **Deleted** | Stray CLI state (`.branches/`, `.temp/`, empty `snippets/`) created by running the CLI at the repo root. `src/supabase/` is canonical per DEC-LOG-02; the CLI is invoked with `--workdir src` |
| `.gitignore` | **Updated** | Dropped Python entries (`__pycache__/`, `*.py[cod]`, `.venv/`, `venv/`) and the Firebase service-account rules; added `src/supabase/.branches/` and `src/supabase/.temp/` |
| `src/frontend/` | **Migrated** | Now uses `lib/supabase.js` + `lib/api.js`; `services/firebase.js` and `context/AuthContext.jsx` are gone. No `firebase` package remains in any `package.json` |

A repository-wide scan for `firebase`/`firestore` across `*.js`, `*.jsx`, `*.ts`, `*.tsx`,
`*.json`, `*.py`, `*.toml` returns **zero** matches. Remaining textual mentions are intentional:
historical PA1 meeting notes under `docs/management/`, and SRS/constitution text explaining DEC-54
(why Firestore was rejected, and that Firebase Auth survives only as a documented fallback).

---

## DEC-LOG-02 — Layout is /src-rooted; npm workspaces; no apps/web

**Date**: 2025-10-25
**Relates to**: SRS §11 (proposed project structure), M0-PLAN.md §2b

**Context.** SRS §11 proposes a monorepo layout with `apps/web/`, `packages/shared/`,
`supabase/` at the root. The project requirement is that everything app-related lives
inside `/src`.

**Decision.** `src/` in this repository corresponds to `shelfhelp/` in SRS §11. Two
deviations from the literal §11 tree are adopted:

| SRS §11 | This repo | Reason |
|---|---|---|
| `apps/web/src/` | `src/frontend/` | One deployable. `apps/` is monorepo ceremony with no benefit; the frontend is not moved. |
| `packages/shared/src/` | `src/shared/src/` | Same intent, one level flatter, inside the required `/src` root. |

- **Workspace root**: `package.json` and workspace globs live at the repository root
  (`src/frontend`, `src/shared`), so CI and editors resolve naturally. `src/` is the
  project root, not the workspace root.
- **Package manager**: npm workspaces. pnpm is not installed on the dev machine and the
  workspace needs are basic. Installing pnpm later is a non-breaking change.

**Rationale.** `apps/` exists to separate multiple deployables from shared libraries.
With a single deployable it holds exactly one child. The `/src` requirement is absolute
and the flat layout satisfies both it and §11's intent.

**Consequences.**
- The Supabase dashboard's Next.js snippets (`utils/supabase/server.ts`, `middleware.ts`,
  `page.tsx`, `NEXT_PUBLIC_*` env names) do not apply. Only the browser client is used;
  privileged access goes through Edge Functions.
- Server-side secrets must never enter the Vite bundle (NFR-06).

---

## DEC-LOG-03 — M0 toolchain: Docker, Supabase CLI, Playwright are prerequisites

**Date**: 2025-10-25
**Relates to**: M0-PLAN.md §2 (blockers) and §4 (D1, D2, D4)

**Context.** The M0 plan was written when Docker, the Supabase CLI, and Playwright were
all absent. That blocked two of the three SRS §19 exit criteria (pgTAP, Playwright).

**Decision.** All three are installed and in use:

| Tool | Version | Notes |
|---|---|---|
| Docker | 29.7.2 (daemon running) | Required for `supabase start` |
| Supabase CLI | 2.122.0 via `npx` | No global install; `--workdir src` is mandatory (DEC-LOG-02) |
| Playwright | 1.64.1 (`@playwright/test`) | Chromium only in M0; NT-06 widens to 3 browsers at M11 |
| npm workspaces | npm 11.6.1 | Confirms D2; pnpm still unused |

`src/e2e` is now a third workspace alongside `src/frontend` and `src/shared`.

**Hosted projects (D4).** Still deferred. Local-only until M1 needs real data, per
M0-PLAN §6. `supabase/config.toml` carries no project ref.

**Consequences.**
- CI (`.github/workflows/ci.yml`) can run all three exit criteria on GitHub runners.
- The dev machine must have Docker running for `npm run db:test` and `npm run e2e`.
  The Docker-free subset is `npm run verify` (typecheck + spec-matrix).

---

## DEC-LOG-04 — Edge Functions import shared code by relative path, not package name

**Date**: 2025-10-25
**Relates to**: SRS §10.1, §11 ("`_shared/`"), NFR-14

**Context.** `functions/_shared/http.ts` imported `@shelfhelp/shared`. The function
failed to boot:

```
worker boot error: Relative import path "@shelfhelp/shared" not prefixed with / or ./ or ../
```

The Edge Runtime container mounts **only** `src/supabase/functions`. There is no
`node_modules` and no import map inside it, so an npm workspace name can never resolve.

**Decision.** Edge Functions reach shared code with an explicit relative path:

```ts
import { HttpStatus, type ReasonCode } from '../../../shared/src/reason-codes/index.ts'
```

Verified empirically: a relative path that escapes `functions/` resolves correctly,
because the host directory is mirrored into the container. `supabase functions deploy`
bundles the imports, so this also works when deployed.

**Rejected alternatives.**

| Option | Why not |
|---|---|
| Keep `@shelfhelp/shared` + Deno import map | The container has no mount for `src/shared`, so the map would point at a path that does not exist inside it |
| Vendor copy of `shared/` into `functions/_shared` | Duplicates the source of truth; drifts silently |
| Inline the two constants in `http.ts` | Contradicts SRS §12.5 single-source rule and §11's "shared logic goes to the shared package" |

**Consequence.** Deep relative paths from `functions/` are expected and correct. Only
import **inside** the shared package itself (`packages/shared/src/...`) uses clean
relative paths.

---

## DEC-LOG-05 — Column REVOKE does not hide `books.embedding`; use a column GRANT list

**Date**: 2025-10-25
**Relates to**: SRS §12.3 ("the `books.embedding` column is revoked from client roles"), NFR-06

**Context.** The initial migration wrote the obvious form:

```sql
grant select on public.books to authenticated;
revoke select (embedding) on public.books from authenticated;   -- NO EFFECT
```

This **does not work**. Supabase's default privileges grant table-level `SELECT` to
`authenticated` on every new table, and a table-level grant covers every column — a
column-level `REVOKE` cannot subtract from it. Confirmed on the local stack: a student
could read `embedding`.

**Decision.** Drop the table-level `SELECT` first, then grant an explicit column list
that omits `embedding`:

```sql
revoke select on public.books from anon, authenticated;
grant select (id, title, authors, ..., search_vector, added_at, updated_at)
  on public.books to authenticated;
```

**Trade-off and guard.** A column-list grant is opt-in: a future column added to
`books` is invisible to clients until it is added to this list. That is the safe
default, but it can surprise. `tests/rls_test.sql` asserts **both** halves — that a
normal select still works (so a missing column breaks CI loudly rather than silently)
and that `embedding` raises `42501`.

**Consequence.** Every table whose client-readable columns are not the full set must
use this pattern. Tables with no client access at all need no grant.

---

## DEC-LOG-06 — RLS filters rows; it does not raise. Tests assert row counts, not exceptions

**Date**: 2025-10-25
**Relates to**: SRS §12.3, TS-04

**Context.** Writing the pgTAP suite revealed a semantic that is easy to test wrongly.
With RLS enabled and **no** policy for a command:

| Statement | Result |
|---|---|
| `SELECT` | Returns 0 rows |
| `UPDATE` | **Succeeds**, affects 0 rows |
| `DELETE` | **Succeeds**, affects 0 rows |
| `INSERT` | Raises `42501` (implicit `WITH CHECK` evaluates the new row) |

So `throws_ok(... '42501')` is the wrong assertion for client `UPDATE`/`DELETE` — it
reports "no exception" for a correctly locked-down table. An early draft of the suite
was misread as a security hole for exactly this reason.

**Decision.** Assertions are chosen per command:

- `INSERT` on a table the client may not write → `throws_ok(..., '42501')`
- `UPDATE` / `DELETE` on such a table → `results_eq` asserting **0 rows affected**
- Missing column/table privilege → `throws_ok(..., '42501')`

**Consequence.** The suite documents this in its header so the next person does not
re-introduce the wrong assertion. "Deny-by-default" means *no rows change*, not *an
error is raised*.

---

# Awaiting sign-off

Per SRS §0 (Owner sign-off for `[CONFIRM]` and `Confirm = Yes` items), an item is
confirmed **only** when a dated entry exists in this file naming the item ID and the
confirmed value. Nothing in this section is confirmed yet.

Each open question from SRS §18.3 is listed below with blank fields. To confirm one,
copy its block into a new dated entry above (e.g. `## DEC-LOG-02 — <title>`) and fill
it in, then delete the row here.

| # | Question | Owning IDs | Status |
|---|---|---|---|
| Q01 | Single admin role; admin accounts created by hand | DEC-01, DEC-02 | Pending |
| Q02 | Email domain allowlist and student ID format | DEC-50, POL-02 | Pending |
| Q03 | Membership price and duration | DEC-04 | Pending |
| Q04 | Fine rate, cap, and 60-day lost threshold | DEC-15, POL-08 | Pending |
| Q05 | Both lost-resolution paths and waiver rules | DEC-17 | Pending |
| Q06 | Debt hold also blocks renewals, reservations, handover | DEC-20 | Pending |
| Q07 | Reservation limits, strike window, ban length | DEC-24, DEC-25 | Pending |
| Q08 | Premium renewal fee rule for non-members | DEC-06 | Pending |
| Q09 | 30-minute online payment window; counter-payment flow | DEC-12, DEC-13 | Pending |
| Q10 | Retention periods | POL-16 | Pending |
| Q11 | Replacement-price source and default | ASM-09, settings `default_replacement_price` | Pending |
| Q12 | Separate staff assistant / management reports beyond §3.10 | — | Pending |
| Q13 | Production Supabase plan; Supabase Auth acceptable instead of Firebase Auth | DEC-54 | Pending |

## Sign-off entry template

```
## DEC-LOG-NN — <short title>

**Date**: YYYY-MM-DD
**Answers**: Q<nn> (SRS §18.3)
**Confirmed IDs**: <DEC-xx, POL-xx, ...>

**Decision.** <the confirmed value(s), stated concretely>

**Impact.** <which requirements, defaults, or settings keys change, if any>
```

Judge/the team answers these; the values are business decisions and are deliberately
left blank here.
