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
