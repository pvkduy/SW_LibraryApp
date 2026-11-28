# Feature Specification: Accounts & Authentication — Admin

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-01 header profile block, A-19; FR-AUTH-07, 08, 11.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Admin (staff)

**Shared context**: `specs/000-core/spec.md` (POL-02 inactive/restore checklists, POL-09, POL-19, gating §6; DEC-57).

## User Scenarios & Testing

### User Story 1 - Account lifecycle administration (Priority: P1)

An admin sets a student Inactive and restores a Restricted account, per checklists.

**Why this priority**: Account access control is security-critical; only admins can gate or restore.

**Independent Test**: Set Inactive when checklist passes; restore Restricted after resolution (TS-32, TS-29, TS-30).

**Acceptance Scenarios** (A-19):

1. **Given** one borrowed book, **Then** the Inactive action is disabled and the checklist shows "1 item not returned".
2. **Given** a passing checklist, **Then** the Auth account is disabled, all active sessions are revoked, and reservations are cancelled.
3. **Given** an unreturned lost book with replacement unpaid, **Then** Restore is disabled.

### User Story 2 - Manage own active sessions (Priority: P2)

A staff member reviews the devices signed in to their own account and remotely signs out ones they no longer trust.

**Why this priority**: Staff accounts can change catalog and money records, so stale sessions are a security risk.

**Independent Test**: Sign in as staff from two devices, verify the list and revoke one (TS-67).

**Acceptance Scenarios** (R-23, `/admin/profile/sessions`):

1. **Given** the admin header profile block, **Then** Active Sessions opens `/admin/profile/sessions`.
2. **Given** two staff devices, **Then** only the caller's sessions show and the current one carries a "This device" badge.
3. **Given** "Sign Out All Other Sessions" and confirmation, **Then** every other session is revoked and the current session stays active.
4. **Given** a request that names another user's session, **Then** it is rejected with `SESSION_NOT_FOUND` and no data is returned.

### Edge Cases

- Deactivated admin with a still-valid token → refused with `ACCOUNT_NOT_ACTIVE` (TS-06).
- Restore decision gated on the auto-evaluated checklist (4.9); "Request review" notifies admins.
- Inactivation with a ready reservation → refused by checklist until resolved (EC-29).
- A staff member manages only their own sessions; account-wide suspension is FR-AUTH-07 (DEC-57).
- Session inventory unavailable → "Active sessions are temporarily unavailable" with Sign Out This Device and Retry (EC-39).

## Requirements

### Functional Requirements

- **FR-AUTH-07** `[PA1 §3.1]` **Set account Inactive.** An admin SHALL set Inactive only when the POL-02 checklist passes; checklist shows each failing condition and a link. Effects per POL-02, including revoking every active session (FR-AUTH-11) and banning the Auth user so no refresh token can renew (cancel reservations, clear wishlist, end membership, retain data).
- **FR-AUTH-08** `[PA1 §3.5]` **Restore a Restricted account.** An admin sees the restore checklist (4.9) auto-evaluated and can restore only when all pass, with a note. Student notified; action audit-logged. Students can send "Request review".
- **FR-AUTH-11** `[+]` **Manage active sessions (staff route).** Staff SHALL use the shared R-23 screen at `/admin/profile/sessions` to list and revoke only their own sessions, per FR-AUTH-11 in `001a-accounts-reader/spec.md`; the admin header profile block links to it. A staff member SHALL NOT see or revoke another user's sessions; account-wide suspension is FR-AUTH-07.

### Key Entities

- **User/Profile**: status (`pending_verification`/`active`/`restricted`/`inactive`).
- **Auth session (derived)**: opaque session ID, device/browser, approximate location, sign-in and last-active times; staff see only their own (DEC-57).

## Success Criteria

- **SC-001**: Account lifecycle (Inactive/Restore) gated by complete checklists with zero bypasses (TS-32, TS-29).
- **SC-002**: Every restore is audit-logged (FR-AUTH-08).
- **SC-003**: Staff see only their own active sessions and no tokens, and inactivation revokes every session (TS-67).

## Assumptions

- Inactive preconditions include no open requests and no ready reservations (DEC-43).
- Staff manage only their own sessions; account-wide suspension is FR-AUTH-07 (DEC-57).

## Test Scenarios

TS-32, TS-29, TS-30, TS-67.
