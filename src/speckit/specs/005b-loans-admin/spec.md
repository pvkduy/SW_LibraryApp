# Feature Specification: Loans, Fines & Conditions — Admin

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-08; FR-CIRC-03, 04, 05; FR-COND-01.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Admin (staff)

**Shared context**: `specs/000-core/spec.md` (POL-04 return, POL-08, DEC-21/38).

## User Scenarios & Testing

### User Story 1 - Return and charges (Priority: P1)

An admin records a return, finalizing fines and damage fees.

**Why this priority**: Closes the loan lifecycle and settles money.

**Independent Test**: Return on-time and late with damage (TS-24, TS-25, TS-26).

**Acceptance Scenarios** (FR-CIRC-03, FR-CIRC-04, FR-COND-01):

1. **Given** a copy returned late by 3 days, **Then** a 6,000 VND fine Charge is finalized.
2. **Given** a returned copy with a waiting reservation, **Then** the copy becomes `held` for the first eligible member instead of `available`.
3. **Given** condition worsened to `damaged` with 30% tier on a 100,000 VND book, **Then** a 30,000 VND Charge is created.
4. **Given** charges left unpaid, **Then** the loan is `returned` and the student has a debt hold.
5. **Given** handover without a condition, **Then** Confirm is disabled.

### User Story 2 - Mark as lost (Priority: P1)

An admin marks a copy lost, with consequences.

**Why this priority**: Manual loss handling for audits.

**Independent Test**: Mark a borrowed copy lost (TS-31).

**Acceptance Scenarios** (FR-CIRC-05):

1. **Given** manual lost on a borrowed copy, **Then** the loan is `lost`, the student is `restricted`, and a `loss_fee` Charge exists.

### Edge Cases

- Return scanned for a copy not on loan → clear error with current status (EC-14).
- Return at 00:00:01 next day counts as 1 day overdue (EC-31).
- Student Restricted while holding ready items → handover blocked, items expire normally (EC-18).
- `lost` copy scanned → return-after-lost flow (POL-08).

## Requirements

### Functional Requirements

- **FR-CIRC-03** `[PA1 §3.7]` **Return.** Scan copy barcode or open active loan; show borrower/due/overdue/fine/condition out; require condition in; choose copy next status; confirm sets `returned`, writes copy status, finalizes charges, runs promotion/wishlist, invites rating. Not-on-loan copy → error. `lost` copy → return-after-lost flow.
- **FR-CIRC-04** `[PA1 §3.7]` **Charges at return.** Compute overdue fine per POL-08, require damage decision when worsened, create `damage_fee` Charges, show total, collect now (counter) or leave unpaid (debt hold).
- **FR-CIRC-05** `[PA1 §3.7]` **Mark as lost manually.** Mark a copy lost; if on loan, confirmation states consequences (loan `lost`, student Restricted, replacement charge) and requires reason.
- **FR-COND-01** `[PA1 §3.8]` **Record condition.** Require condition (`good`/`fair`/`poor`/`damaged`) with optional note and up to 3 photos at handover and return. Admin MAY correct with reason (audit-logged, no auto charge change).

### Key Entities

- **LoanItem**: condition in/out, status `returned`/`lost`.
- **Charge**: `overdue_fine`, `damage_fee`, `loss_fee`.
- **Copy**: post-return status (`available`/`damaged`/`under_repair`).

## Success Criteria

- **SC-001**: No loan closed without a librarian-confirmed physical return (FR-CIRC-03).
- **SC-002**: Damage decision forced when condition worsens; fee tiers per DEC-38 (TS-26).
- **SC-003**: Manual loss carries the same effects as automatic loss (TS-31).

## Assumptions

- Condition scale `good`/`fair`/`poor`/`damaged`; damage tiers 10/30/100% (DEC-38).
- Replacement price capped custom amount (POL-08).

## Test Scenarios

TS-24, TS-25, TS-26, TS-31, TS-29.
