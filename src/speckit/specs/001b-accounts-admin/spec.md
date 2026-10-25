# Feature Specification: Accounts & Authentication — Admin

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-19; FR-AUTH-07, 08.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Admin (staff)

**Shared context**: `specs/000-core/spec.md` (POL-02 inactive/restore checklists, POL-09, gating §6).

## User Scenarios & Testing

### User Story 1 - Account lifecycle administration (Priority: P1)

An admin sets a student Inactive and restores a Restricted account, per checklists.

**Why this priority**: Account access control is security-critical; only admins can gate or restore.

**Independent Test**: Set Inactive when checklist passes; restore Restricted after resolution (TS-32, TS-29, TS-30).

**Acceptance Scenarios** (A-19):

1. **Given** one borrowed book, **Then** the Inactive action is disabled and the checklist shows "1 item not returned".
2. **Given** a passing checklist, **Then** the Auth account is disabled and reservations are cancelled.
3. **Given** an unreturned lost book with replacement unpaid, **Then** Restore is disabled.

### Edge Cases

- Deactivated admin with a still-valid token → refused with `ACCOUNT_NOT_ACTIVE` (TS-06).
- Restore decision gated on the auto-evaluated checklist (4.9); "Request review" notifies admins.
- Inactivation with a ready reservation → refused by checklist until resolved (EC-29).

## Requirements

### Functional Requirements

- **FR-AUTH-07** `[PA1 §3.1]` **Set account Inactive.** An admin SHALL set Inactive only when the POL-02 checklist passes; checklist shows each failing condition and a link. Effects per POL-02 (cancel reservations, clear wishlist, end membership, disable login, retain data).
- **FR-AUTH-08** `[PA1 §3.5]` **Restore a Restricted account.** An admin sees the restore checklist (4.9) auto-evaluated and can restore only when all pass, with a note. Student notified; action audit-logged. Students can send "Request review".

### Key Entities

- **User/Profile**: status (`pending_verification`/`active`/`restricted`/`inactive`).

## Success Criteria

- **SC-001**: Account lifecycle (Inactive/Restore) gated by complete checklists with zero bypasses (TS-32, TS-29).
- **SC-002**: Every restore is audit-logged (FR-AUTH-08).

## Assumptions

- Inactive preconditions include no open requests and no ready reservations (DEC-43).

## Test Scenarios

TS-32, TS-29, TS-30.
