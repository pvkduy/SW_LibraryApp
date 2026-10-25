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
