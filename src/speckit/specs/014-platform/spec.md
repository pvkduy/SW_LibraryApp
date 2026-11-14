# Feature Specification: Settings, Platform & System

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-19, System §9; FR-SET-03; FR-SYS-01..03, 05.

**Created**: 2026-10-23

**Status**: Draft (v1.3 — policy settings removed)

**Side**: Admin (FR-SET-03, A-19) + System-wide (FR-SYS-*)

**Shared context**: `specs/000-core/spec.md` (POL-16, §4.17 settings, NFRs).

## User Scenarios & Testing

### User Story 1 - Student directory (Priority: P1)

Staff search and inspect students, with audit-logged access.

**Why this priority**: Operational access to student accounts; privacy-sensitive.

**Independent Test**: Search/filter students and open detail (TS-59).

**Acceptance Scenarios** (FR-SET-03):

1. **Given** a detail view, **Then** an audit entry "view_student" exists.
2. **Given** filters (status, membership), **Then** results match.
3. **Given** a detail panel, **Then** it exposes four actions — Set Inactive, Restore, Membership refund/termination, Register/renew membership — and a history of tier changes, status, and strikes with timestamps.

### User Story 3 - Scheduled jobs registry (Priority: P1)

The system has idempotent scheduled jobs for all automation.

**Why this priority**: Fines, reminders, expiry, and cleanup all depend on reliable jobs.

**Independent Test**: Run each job twice; verify no duplication (TS-65).

**Acceptance Scenarios** (FR-SYS-01, FR-SYS-02):

1. **Given** any job run twice for the same window, **Then** no duplicate side effects exist.
2. **Given** the project unavailable for 3 days then resumed, **Then** the next runs process every overdue item exactly once.
3. **Given** the same idempotency key sent twice concurrently, **Then** one effect and the same response are returned.

### User Story 4 - Audit logging (Priority: P1)

All sensitive actions are audited immutably.

**Why this priority**: Accountability for money, status, and privacy-sensitive access.

**Independent Test**: Trigger listed actions and verify audit rows (TS-58).

**Acceptance Scenarios** (FR-SYS-03):

1. **Given** any listed action, **Then** an entry with actor, entity, before, after, and time exists.

### User Story 5 - File handling (Priority: P2)

Uploads and downloads obey role/owner/size/type policies.

**Why this priority**: Security of user-uploaded files.

**Independent Test**: Upload to wrong path and oversized files (TS-42).

**Acceptance Scenarios** (FR-SYS-05):

1. **Given** a student uploading to another student's avatar path, **Then** Storage denies it.
2. **Given** a 10 MB file, **Then** it is rejected before stored.

### Edge Cases

- Database paused / jobs missed → maintenance page; jobs catch up (EC-35).
- Idempotency: client timeout → retry with same key returns stored response (EC-34).
- Deactivated admin with valid token → refused by `profiles.status` check (TS-06).
- File size/type enforced at bucket level before storage (FR-SYS-05).

## Requirements

### Functional Requirements

- **FR-SET-03** `[+]` **Student directory and detail.** Search/filter students (status, membership); master table + detail panel showing profile, current status, membership, and a simplified history (tier changes, account status, strikes, timestamps). Four actions: Set Inactive, Restore, Membership refund/termination, Register/renew membership. Opening detail is audit-logged.
- **FR-SYS-01** `[+]` **Scheduled jobs registry.** Jobs exist as `pg_cron` schedules in UTC (DEC-55), idempotent, recording a run in `job_runs`: `nightly-loans`, `due-notifications`, `hold-expiry` (15 min), `payment-expiry` (5 min), `membership-reminders`, `pickup-warnings` (30 min), `email-outbox` (1 min), `embed-queue` (5 min), `unverified-cleanup` (daily), `ttl-cleanup` (daily), `reconcile` (nightly). Pure SQL jobs inside Postgres; external-service jobs as Edge Functions via `pg_net` with a secret header. Each job processes everything due.
- **FR-SYS-02** `[+]` **Idempotency and concurrency.** All mutating Edge Functions SHALL accept an idempotency key, run one Postgres transaction following the lock order and retry rules (10.7), and be safe to retry.
- **FR-SYS-03** `[+]` **Audit logging.** Write immutable audit entries for status changes, money actions, role changes, restore/inactivation, condition corrections, and staff views of student detail.
- **FR-SYS-05** `[+]` **File handling.** Uploads and private downloads use Storage buckets with policies checking role, owner path, content type, and size (avatars 300 KB, covers 1 MB, evidence 2 MB each, CSV 2 MB).

### Key Entities

- **AuditLog**: at, actor, action, entity type/id, before, after (insert only).
- **JobRuns**: run records for scheduled jobs.

## Success Criteria

- **SC-001**: Every job is idempotent and catches up missed work (FR-SYS-01, TS-65).
- **SC-002**: Every mutating Edge Function is retry-safe via idempotency key (FR-SYS-02).
- **SC-003**: All listed sensitive actions are audit-logged immutably (FR-SYS-03, TS-58).
- **SC-004**: File policies deny cross-user and oversized uploads (FR-SYS-05, TS-42).

## Assumptions

- `pg_cron` schedules run in UTC with local-time comments (DEC-55).
- No in-app audit viewer in current scope; entries read via database (Section 20 of SRS).
- Storage buckets: `covers`, `avatars`, `evidence`, `imports` (10.5).

## Test Scenarios

TS-42, TS-58, TS-59, TS-65, TS-66.
