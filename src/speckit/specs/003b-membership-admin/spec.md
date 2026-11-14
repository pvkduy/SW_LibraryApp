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

### User Story 2 - Membership tier policy configuration (Priority: P2)

An admin edits the policies of the two fixed membership tiers.

**Why this priority**: Tier policies drive pricing and entitlements without code changes.

**Independent Test**: Change the yearly Premium price and verify it appears for new purchases (TS-34).

**Acceptance Scenarios** (FR-MEM-09):

1. **Given** the yearly Premium price changed from 150,000 to 180,000 VND, **Then** new purchases use 180,000 VND and existing memberships keep their snapshot.
2. **Given** an attempt to add or deactivate a plan, **Then** the option is unavailable (the tier set is fixed to Standard and yearly Premium).

### Edge Cases

- Membership terminated via receipt reversal (FR-RCPT-05).
- Existing loans keep due dates on termination (DEC-53).
- Plans only affect new purchases (snapshot model).
- The Standard (unpaid) rank cannot be deactivated; the yearly Premium cannot be deactivated.

## Requirements

### Functional Requirements

- **FR-MEM-07** `[PA1 §3.2]` **Membership exceptions.** An admin SHALL refund/terminate a membership through receipt reversal (FR-RCPT-05). Student reverts to non-member entitlements immediately; existing loans keep due dates. No transfer.
- **FR-MEM-09** `[PA1 §3.2]` **Membership tier policy configuration.** Admin SHALL edit the policies of the two fixed tiers — the Standard (unpaid) rank and the yearly Premium membership (price, duration, privileges) — without code changes. Admins SHALL NOT create new plans or deactivate either tier. Premium titles set per book (FR-INV-03) and in bulk.

### Key Entities

- **MembershipPlan**: name, price, duration days, privileges, tier (`standard` or `yearly_premium`).

## Success Criteria

- **SC-001**: Membership refund/termination reverts entitlements immediately with no loan due-date change (TS-36).
- **SC-002**: Policy edits affect only new purchases, never existing snapshots (FR-MEM-09, TS-34).

## Assumptions

- The membership model is fixed to two tiers: Standard (unpaid) and yearly Premium (DEC-04).
- Membership non-transferable (POL-03).

## Test Scenarios

TS-36, TS-34.
