# Feature Specification: Membership — Admin

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-19; FR-MEM-07, 10.

**Created**: 2026-10-23

**Status**: Draft (v1.3 — tier policy config removed)

**Side**: Admin (staff)

**Shared context**: `specs/000-core/spec.md` (POL-03, FR-MEM-05, FR-RCPT-05).

## User Scenarios & Testing

### User Story 1 - Membership exceptions (Priority: P2)

An admin refunds or terminates a membership.

**Why this priority**: Exceptional admin capability for refunds.

**Independent Test**: Reverse a membership receipt and verify termination (TS-36).

**Acceptance Scenarios** (FR-MEM-07):

1. **Given** a reversed membership receipt, **Then** membership is `terminated`, the student has non-member entitlements, and existing loans keep their due dates.
2. **Given** a membership refund, **Then** the student reverts to non-member rules immediately.
3. **Given** any student, **Then** no transfer option exists.

### User Story 2 - Register or renew membership (Priority: P2)

An admin registers a new membership or renews an existing one at the counter.

**Why this priority**: Staff-assisted membership purchase/renewal.

**Independent Test**: Counter purchase creates a snapshot and receipt (TS-33).

**Acceptance Scenarios** (FR-MEM-10):

1. **Given** a counter purchase, **Then** a membership snapshot and a receipt exist and the student's entitlements update immediately.
2. **Given** the plan price and effective start/end dates, **Then** they are shown for confirmation before collecting payment.

### Edge Cases

- Membership terminated via receipt reversal (FR-RCPT-05).
- Existing loans keep due dates on termination (DEC-53).
- The membership model is fixed to two tiers: Standard (unpaid) and yearly Premium (DEC-04); tier policies are hardcoded defaults (no policy editor).

## Requirements

### Functional Requirements

- **FR-MEM-07** `[PA1 §3.2]` **Membership refund/termination.** An admin SHALL refund/terminate a membership through receipt reversal (FR-RCPT-05). Student reverts to non-member entitlements immediately; existing loans keep due dates. No transfer.
- **FR-MEM-10** `[+]` **Register or renew membership (counter).** An admin SHALL register/renew a membership at the counter as a counter transaction, showing eligibility and effective start/end dates, collecting exact payment, creating the membership snapshot, and issuing a receipt.

### Key Entities

- **MembershipPlan**: name, price, duration days, privileges, tier (`standard` or `yearly_premium`).

## Success Criteria

- **SC-001**: Membership refund/termination reverts entitlements immediately with no loan due-date change (TS-36).
- **SC-002**: Counter purchase/renewal creates a snapshot and receipt (TS-33).

## Assumptions

- The membership model is fixed to two tiers: Standard (unpaid) and yearly Premium (DEC-04).
- Membership non-transferable (POL-03).

## Test Scenarios

TS-36, TS-33.
