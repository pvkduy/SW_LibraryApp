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
