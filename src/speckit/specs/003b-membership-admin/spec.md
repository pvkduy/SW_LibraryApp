# Feature Specification: Membership — Admin

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-19/A-20; FR-MEM-07, 09.

**Created**: 2026-10-23

**Status**: Draft

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

### User Story 2 - Plans and Premium configuration (Priority: P2)

An admin creates, edits, and deactivates membership plans.

**Why this priority**: Plans drive pricing and entitlements without code changes.

**Independent Test**: Add a plan and verify it appears for new purchases (TS-34).

**Acceptance Scenarios** (FR-MEM-09):

1. **Given** a new plan with price 90,000 VND, **Then** it appears on R-16 for new purchases and old memberships are unchanged.

### Edge Cases

- Membership terminated via receipt reversal (FR-RCPT-05).
- Existing loans keep due dates on termination (DEC-53).
- Plans only affect new purchases (snapshot model).

## Requirements

### Functional Requirements

- **FR-MEM-07** `[PA1 §3.2]` **Membership exceptions.** An admin SHALL refund/terminate a membership through receipt reversal (FR-RCPT-05). Student reverts to non-member entitlements immediately; existing loans keep due dates. No transfer.
- **FR-MEM-09** `[PA1 §3.2]` **Plans and Premium configuration.** Admin SHALL create/edit/deactivate plans (name, price, duration, privileges) without code changes. Premium titles set per book (FR-INV-03) and in bulk.

### Key Entities

- **MembershipPlan**: name, price, duration days, privileges, active flag.

## Success Criteria

- **SC-001**: Membership refund/termination reverts entitlements immediately with no loan due-date change (TS-36).
- **SC-002**: Plan edits affect only new purchases, never existing snapshots (FR-MEM-09, TS-34).

## Assumptions

- Membership non-transferable (POL-03).

## Test Scenarios

TS-36, TS-34.
