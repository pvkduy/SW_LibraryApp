<!--
Performed by: Nguyễn Anh Khôi

Sync Impact Report
Version change: 0.1.0 (draft) → 1.0.0 (ratified)
Status change: DRAFT — NOT RATIFIED → RATIFIED

Modified principles:
  - I. Real-World Lending Fidelity (kept; aligned to POL-04/POL-08)
  - II. Role-Based Access Control by Default (kept; widened to RLS + Edge Functions + Storage)
  - III. Money and Fees Are Auditable (kept; aligned to POL-10 immutability)
  - IV. Test-First for Business Rules (kept; aligned to NFR-14 and the spec-matrix gate)
  - V. Simplicity and Incremental Delivery (kept)
  - VI. Server-Writes-Only (NEW, from SRS 10.1 principle 1)
  - VII. Configuration Over Hardcoding (NEW, from SRS agent rule 2)
  - VIII. Spec-Fidelity and Recorded Deviations (NEW, from SRS agent rules 4 + precedence)

Sections changed:
  - "Stack & Architectural Constraints" REWRITTEN: Flask + Firebase/Firestore was WRONG.
    The authoritative spec (DEC-54, SRS 10.2) mandates Supabase (Postgres, Auth,
    Storage, Edge Functions, pg_cron) and TypeScript everywhere. Firebase Auth is only
    a fallback if Supabase Auth proves unsuitable.
  - "Development Workflow & Quality Gates" REWRITTEN: milestones M0-M11, definition of
    done, and the CI spec-matrix gate replace the earlier generic sprint wording.
  - "Governance" RATIFIED with dated version line.

Removed sections: none.

Follow-up TODOs:
  - RATIFICATION_DATE is recorded as 2025-10-25 (team ratification of v1.0.0). Adjust
    if the team records a different adoption date.
  - NFR thresholds (NFR-01..16) are owned by specs/000-core/spec.md; this constitution
    delegates rather than duplicates, so amendments to numeric targets do not require a
    constitution amendment.
-->

# ShelfHelp Constitution


> **Status: RATIFIED v1.0.0.** Grounded in the authoritative SRS
> `specs/SHELFHELP_FULLSPEC.md` (v1.2) and the split specs under `specs/`. Where this
> document and the spec disagree, the spec's Section 3 (Decisions) and Section 4
> (Policies) win, and this constitution MUST be amended.

## Core Principles

### I. Real-World Lending Fidelity

The system MUST model the physical reality of library lending rather than abstracting it away.

- A web loan request is a *request*, not a loan. A loan becomes active only when a librarian
  confirms the physical handover (POL-04).
- Every physical copy MUST have its own record with a unique barcode, a status, and a shelf
  location (POL-13). A book is title-level metadata; a copy is the lendable object.
- Book condition MUST be recorded at both handover and return; liability for damage or loss is
  determined from those records (POL-08).
- A loan MUST NOT be closed on a digital action alone — a librarian-confirmed physical return is
  required, and the returned copy's next status is chosen explicitly.

**Rationale**: Lending is about physical objects. A model that lets a student "borrow" without the
book leaving the shelf produces inventory that drifts from reality and makes fines, lost-book
tracking, and reporting untrustworthy.

### II. Role-Based Access Control by Default (NON-NEGOTIABLE)

Student and staff capabilities MUST be separated at every layer, and access MUST start closed.

- Roles MUST be enforced in four places: route guards, Row Level Security policies, Edge Function
  checks, and Storage policies (FR-AUTH-05).
- Students MUST never reach administrative data or functions through any path — UI, API, or data
  access. A student calling an admin Edge Function MUST receive `FORBIDDEN_ROLE`.
- RLS MUST be enabled on every table; a table with no policy is unreadable. Client write policies
  exist only for the narrow exceptions the spec names (own cart rows, own notification read flag,
  own chat deletion, and listed `profiles` columns).
- The gating matrix (spec §6.1) MUST be evaluated by one shared server function and mirrored in the
  UI for clarity; the server is the enforcement point.
- Every Edge Function MUST also re-check the caller's `profiles.status`, so a deactivated account
  is refused (`ACCOUNT_NOT_ACTIVE`) even while an old token is still valid.

**Rationale**: The system holds personal borrowing records and controls money and inventory. A
single missing policy exposes private data or lets an unauthorized user alter stock and finances.

### III. Money and Fees Are Auditable (NON-NEGOTIABLE)

Every monetary event MUST leave a traceable, immutable record.

- Membership purchases, premium loan fees, overdue fines, damage fees, and loss fees MUST each
  produce a receipt in the same transaction as the payment (POL-10, FR-RCPT-01).
- Receipts MUST be insert-only. No role may UPDATE or DELETE a receipt; a reversal creates a new
  negative receipt linked to the original. A receipt can be reversed once, fully (FR-RCPT-05/06).
- Receipt numbers MUST be gap-free per year under concurrency (POL-10).
- Fee and fine amounts MUST be derived from stored settings and stored inputs so any charge can be
  recomputed and explained after the fact. Settings changes apply only to future actions.
- Revenue metrics MUST be net of reversals (DEC-41).
- Outstanding charges MUST create a debt hold that blocks new loans until settled (POL-09).

**Rationale**: The library must reconcile takings and defend charges to students. A fee without a
receipt, or a receipt that can be silently edited, is unauditable and erodes trust.

### IV. Test-First for Business Rules (NON-NEGOTIABLE)

Behavior that determines money, eligibility, or inventory state MUST be covered by automated tests.

- At minimum: entitlement resolution, gating, fine calculation and caps, lost conversion and
  resolution, reservation promotion and hold expiry, receipt generation and immutability, and copy
  status transitions MUST have tests.
- Every functional requirement MUST have at least one automated test scenario. The traceability
  matrix (SRS §17) is generated by script, and CI MUST fail if an FR has no scenario.
- Invariants that must never break MUST also be enforced by the database (constraints, triggers,
  RLS) and verified by the nightly reconciliation job (NFR-10).
- Tests MUST fail for the right reason before the implementation satisfies them.

**Rationale**: These rules are expensive to get wrong and hard to notice when they break. Reasonable
UI code is reviewed; fee, queue, and ledger logic must be proven.

### V. Simplicity and Incremental Delivery

Ship the smallest correct slice, then extend it.

- Features MUST be built as independently deliverable, independently testable vertical slices,
  following the build order M0–M11 (SRS §19).
- New dependencies and abstractions MUST be justified; prefer the fixed stack over new technology.
- Capability the spec archives (SRS §20) MUST NOT be built. Archived requirement IDs MUST NOT be
  reused.

**Rationale**: This is a time-boxed course project by a small team. Complexity added early is
carried by every later feature.

### VI. Server-Writes-Only (NON-NEGOTIABLE)

The browser reads; the server writes.

- Protected tables MUST have no INSERT, UPDATE, or DELETE policy for client roles. Only Edge
  Functions, using the service role, write to them (SRS 10.1).
- Every mutating Edge Function MUST run as a single Postgres transaction, MUST accept an
  idempotency key, and MUST follow the fixed lock order and retry rules (SRS 10.7, FR-SYS-02).
- Denormalized counters MUST be maintained by triggers in the same transaction as the change, and
  verified by nightly reconciliation (FR-INV-09).
- Business rules MUST live in pure, environment-agnostic modules that Edge Functions, the web app,
  and tests all import; an Edge Function MUST contain only orchestration.

**Rationale**: A single write path is what makes the audit, idempotency, and concurrency guarantees
possible. Two writers mean two sets of invariants that will drift.

### VII. Configuration Over Hardcoding

Every configurable number MUST live in the `settings` table (key `library`, SRS §4.17).

- Limits, fees, durations, thresholds, and plan prices MUST NOT be hardcoded (SRS agent rule 2).
- Every settings change MUST be recorded in immutable history with actor, old, and new value.
- Membership purchases MUST store a privilege snapshot so later settings changes never
  retroactively alter an existing membership (POL-03).

**Rationale**: Library policy will change. Hardcoded values turn a policy change into a code change
and make historic amounts unexplainable.

### VIII. Spec Fidelity and Recorded Deviations

The specification is the contract.

- Precedence MUST be: (1) SRS §3 Decisions and §4 Policies; (2) the original proposal PA1;
  (3) engineering judgment (SRS precedence rule).
- The spec MUST NOT be changed silently. Where the spec is wrong or incomplete, the deviation MUST
  be recorded in `docs/DECISIONS.md` with the reason, and the most conservative option taken.
- Requirement IDs (FR, DEC, POL, NFR, TS, EC, ASM, RISK) MUST be preserved and never reused.
- Items marked `[CONFIRM]` MUST be built to their default, kept configurable, and surfaced to the
  product owner for sign-off.

**Rationale**: Traceability is what lets the team prove the build matches the requirements. Silent
drift destroys that guarantee and makes the traceability matrix lie.

## Stack & Architectural Constraints

The following stack is fixed for this project; deviations require a constitution amendment, and
MUST be recorded per Principle VIII.

- **Language**: TypeScript (strict) everywhere, plus SQL for the database. Database types are
  generated with `supabase gen types`.
- **Frontend**: React 18+ with Vite; React Router (data router) with role/status guards; TanStack
  Query over `supabase-js`; React Hook Form + Zod; Tailwind CSS + shadcn/ui (Radix); `react-i18next`
  (English only for now); Recharts. Reader and admin are separate lazy-loaded chunks.
- **Backend**: Supabase Edge Functions (Deno, TypeScript), one folder per function, thin handlers.
- **Database**: Supabase Postgres — tables, constraints, triggers, RLS on every table, `pg_cron`,
  `pg_net`, `pgvector`, `pg_trgm`, `unaccent`. Migrations only through `supabase/migrations/*.sql`.
- **Auth**: Supabase Auth. The role lives in `app_metadata.role`, written only by server code.
  Firebase Auth is a fallback only if Supabase Auth proves unsuitable (DEC-54).
- **Files**: Supabase Storage with bucket policies checking role, owner path, content type, and
  size (`covers`, `avatars`, `evidence`, `imports`).
- **Hosting**: a static host (Vercel, Netlify, or Cloudflare Pages) with SPA fallback rewrite.
- **Secrets**: service-role key, database URL, LLM/embedding/email keys, and cron secret MUST exist
  only as Edge Function secrets or in CI — never in the client bundle. The client holds only the
  project URL and the anon key.
- **Regional/runtime**: Postgres region `ap-southeast-1`; business "day" is computed in
  `Asia/Ho_Chi_Minh`; `pg_cron` schedules are declared in UTC with the local time in a comment
  (DEC-55).

## Development Workflow & Quality Gates

- Work proceeds in milestones M0–M11 (SRS §19). Each change traces to a functional requirement and
  its acceptance criterion.
- A change is complete only when: (1) the FR's acceptance criterion passes as an automated test;
  (2) its test scenario passes; (3) loading, empty, error, and cancel states exist; (4) strings are
  in the locale file; (5) accessibility passes; (6) audit entries and notifications exist where the
  spec requires them; (7) no setting is hardcoded; (8) the spec-matrix check passes.
- CI MUST run lint, typecheck, unit, pgTAP, integration against the local Supabase stack,
  Playwright, and the spec-matrix check. The spec-matrix check is a required job.
- API/contract changes MUST update the endpoint documentation and the error contract (SRS §12.5) so
  the web app and Edge Functions agree.
- Reviewers MUST verify Principle II (access control), Principle III (audit), and Principle VI
  (server-writes-only) for any change touching authentication, payments, inventory, or data access.
- Non-functional targets (NFR-01..16) are owned by `specs/000-core/spec.md` and apply in full.

## Governance

This constitution supersedes conflicting practices and ad-hoc conventions. It takes effect on
ratification and is binding on all subsequent work.

**Amendment procedure**:

1. Propose the amendment with its rationale and the principles or sections it affects.
2. Determine the version bump (see versioning policy) and state the reasoning.
3. Record the amendment, then update dependent guidance that references the changed principles.
4. Amendments require team agreement before they take effect.

**Versioning policy** (semantic):

- **MAJOR**: removal or redefinition of a principle or a governance rule in a backward-incompatible way.
- **MINOR**: a new principle or section, or materially expanded guidance.
- **PATCH**: clarifications, wording fixes, and non-semantic refinements.

**Compliance review**: Every change is expected to comply. Where a change must deviate, the deviation
MUST be stated explicitly and justified in the change itself, and recorded per Principle VIII.
Complexity and departures from the fixed stack MUST be justified against the value delivered.

**Version**: 1.0.0 | **Ratified**: 2025-10-25 | **Last Amended**: 2025-10-25
