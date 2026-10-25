# Feature Specification: Circulation (Handover & Counter)

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-08; FR-CIRC-01, 02, 07.

**Created**: 2026-10-23

**Status**: Draft

**Shared context**: `specs/000-core/spec.md` (POL-04 handover/return, POL-05 counter payment, gating §6).

## User Scenarios & Testing

### User Story 1 - Circulation list (Priority: P1)

Staff see loans across tabs and search by student/copy/pickup code.

**Why this priority**: The counter staff's primary working view.

**Independent Test**: Search across tabs (TS-63).

**Acceptance Scenarios** (FR-CIRC-01):

1. **Given** a student ID search, **Then** only that student's items show across tabs.
2. **Given** tabs (Ready for pickup, Awaiting payment, On loan, Overdue, Lost, History), **Then** each lists its items correctly.

### User Story 2 - Handover (Priority: P1)

Staff hand a book to the student at the counter.

**Why this priority**: The moment a request becomes an active loan; correctness is critical.

**Independent Test**: Handover with and without debt/deadline violations (TS-20).

**Acceptance Scenarios** (FR-CIRC-02):

1. **Given** a student with debt, **Then** Confirm is disabled with "Settle outstanding charges first".
2. **Given** a 14-day member loan on 2026-11-01, **Then** due date is 2026-11-15 23:59:59 local.
3. **Given** a double click on Confirm, **Then** one handover happens.
4. **Given** a subset handover, **Then** the rest stay ready until their deadline.

### User Story 3 - Counter payment (Priority: P1)

Staff record a payment taken in person.

**Why this priority**: Enables the counter payment path for fees, memberships, and charges.

**Independent Test**: Record a counter payment, verify full-amount rule (TS-21).

**Acceptance Scenarios** (FR-CIRC-07):

1. **Given** a 6,000 VND fine paid at the counter, **Then** the charge is `paid`, a 6,000 VND receipt exists, and the debt hold clears if nothing else is owed.
2. **Given** an amount different from the amount owed, **Then** the payment is rejected.

### Edge Cases

- Handover and hold expiry race at deadline → re-read deadline in transaction; first commit wins, other gets `STATUS_CHANGED` (EC-03).
- Two staff confirm same handover/return → one commits, other gets `STATUS_CHANGED` (EC-19).
- Handover refused when account not `active`, debt > 0, or deadline passed.
- Item expiring while open → stale action returns `STATUS_CHANGED` and refreshes.

## Requirements

### Functional Requirements

- **FR-CIRC-01** `[PA1 §3.7]` **Circulation list.** List loans with borrower name, student ID, borrow/due/return dates, status; tabs (Ready for pickup, Awaiting payment, On loan, Overdue, Lost, History); searchable by student ID, name, copy barcode, or pickup code.
- **FR-CIRC-02** `[PA1 §3.7]` **Handover.** Find request, see student's standing (status/debt/membership), check each item against the physical copy (scan copy barcode), record condition out, collect counter fee, confirm. Confirmation sets `borrowed`, due date per POL-04, copy `borrowed` in one transaction. Subset handover allowed. Refused when not `active`, debt > 0, or deadline passed.
- **FR-CIRC-07** `[PA1 §3.4]` **Record counter payment.** Record a counter payment for a Premium fee, membership, or charges: full amount, method `counter`, optional note. Creates Payment + Receipt(s), updates item/charge state in one transaction, shows printable receipt.

### Key Entities

- **LoanItem**: status transitions `ready_for_pickup` → `borrowed` (handover).
- **Copy**: `held` → `borrowed` (handover).
- **Payment/Receipt**: counter payment records (see Receipts feature).

## Success Criteria

- **SC-001**: Handover commits once per confirm, even on double-click (TS-20).
- **SC-002**: No handover occurs with debt, inactive account, or passed deadline (FR-CIRC-02).
- **SC-003**: Counter payments rejected unless the full amount owed (TS-21).
- **SC-004**: Due dates are computed deterministically in local time (TS-20).
- **SC-005**: p95 ≤ 2 s for handover (NFR-03).

## Assumptions

- Counter payments recorded by staff after taking cash/card elsewhere (ASM-02).
- Partial payments out of scope (POL-05).

## Test Scenarios

TS-20, TS-21, TS-63.
