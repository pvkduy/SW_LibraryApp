# Feature Specification: Receipts & Money

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-16..A-18; FR-RCPT-01..06.

**Created**: 2026-10-23

**Status**: Draft

**Shared context**: `specs/000-core/spec.md` (POL-05, POL-10, DEC-09..11/40/41).

## User Scenarios & Testing

### User Story 1 - Receipt generation (Priority: P1)

Every monetary event creates an immutable receipt.

**Why this priority**: The ledger is the source of truth for all money; must be airtight.

**Independent Test**: Pay and verify receipt count and numbering (TS-16, TS-18).

**Acceptance Scenarios** (FR-RCPT-01):

1. **Given** any successful payment, **Then** the receipt count increases by the number of paid lines and numbers are gap-free per year under concurrency.

### User Story 2 - Receipt log and detail (Priority: P2)

Staff browse and inspect receipts.

**Why this priority**: Reconciliation and audit access.

**Independent Test**: Filter and drill into receipts (TS-53).

**Acceptance Scenarios** (FR-RCPT-02, FR-RCPT-03):

1. **Given** filter status Reversed, **Then** only receipts with a linked reversal show.
2. **Given** a receipt from a Premium loan fee, **Then** the link opens that Loan Item.

### User Story 3 - Manual receipt (Priority: P2)

Staff create a manual receipt for unmodeled transactions.

**Why this priority**: Covers edge money cases the automated flows don't handle.

**Independent Test**: Create a manual receipt with/without reason (TS-53).

**Acceptance Scenarios** (FR-RCPT-04):

1. **Given** an empty reason, **Then** submit is blocked.
2. **Given** submit, **Then** the receipt shows the Manual flag and the admin's name.

### User Story 4 - Reversal and refund (Priority: P1)

An admin reverses a receipt (entry error, refund, lost-return, cancellation).

**Why this priority**: Error correction and refunds must be controlled and audit-safe.

**Independent Test**: Reverse receipts of each type; verify single-reversal rule (TS-53, TS-36).

**Acceptance Scenarios** (FR-RCPT-05):

1. **Given** a reversed receipt, **Then** a second reversal is rejected.
2. **Given** a membership receipt reversal, **Then** the membership status is `terminated` and non-member rules apply.
3. **Given** a premium-fee reversal when the item is `borrowed`/`overdue`, **Then** it is refused (use manual receipt).

### User Story 5 - Immutability (Priority: P1)

Receipts cannot be edited or deleted.

**Why this priority**: Guarantees ledger integrity.

**Independent Test**: Attempt update/delete at every privilege level (TS-53).

**Acceptance Scenarios** (FR-RCPT-06):

1. **Given** a client attempting to update/delete a receipt, **Then** the database rejects it.
2. **Given** a refund, **Then** a new reversal receipt is the only change.

### Edge Cases

- Receipt number allocation under concurrency → counter row `FOR UPDATE`, no gaps/duplicates (EC-25).
- Reversal of a receipt whose loan is already `borrowed` → refused; use manual receipt (EC-26).
- A single Payment covering multiple charges → multiple receipts sharing `payment_id` (POL-05).

## Requirements

### Functional Requirements

- **FR-RCPT-01** `[PA1 §3.9]` **Receipt generation.** Every monetary event (membership, premium fee, overdue fine, damage fee, loss fee, manual) SHALL create a receipt in the same transaction as the Payment, with number, student, signed amount, method, type, reference, creator, timestamp.
- **FR-RCPT-02** `[PA1 §3.9]` **Receipt log.** List receipts with filters (date range, student, type, method, status) and search by number; exportable.
- **FR-RCPT-03** `[PA1 §3.9]` **Receipt detail.** Show number, student, amount, method, type, status, creator, timestamp, reference link, reversal link, printable view.
- **FR-RCPT-04** `[PA1 §3.9]` **Manual receipt.** Form (student, amount, method, type, mandatory reason, optional reference) creating a receipt flagged `manual` with the creating admin.
- **FR-RCPT-05** `[PA1 §3.9]` **Reversal and refund.** Reverse a receipt fully with reason code (`entry_error`, `refund_exception`, `lost_returned`, `cancellation`). Effects: reversal receipt (negative) linked to original; charge payments return to unpaid unless "waive"; membership terminated; premium fee only when not `borrowed`/`overdue`; online payment → `refunded`. Reversed once.
- **FR-RCPT-06** `[PA1 §3.10]` **Receipt immutability.** Insert-only: a trigger raises on UPDATE/DELETE, no role holds those privileges, no client write policy.

### Key Entities

- **Receipt**: number (unique `RC-<YYYY>-<6digit>`), uid, signed amount, method, type, ref type/id, payment id, reverses receipt id, reason code, manual flag, creator, timestamp.
- **Payment**: (see Cart & Checkout feature).
- **Charge**: paid state updated when a receipt settles it.

## Success Criteria

- **SC-001**: Receipt numbers are unique and gap-free per year under concurrency (POL-10, EC-25).
- **SC-002**: A receipt can be reversed exactly once, fully (FR-RCPT-05).
- **SC-003**: No receipt can ever be updated or deleted (FR-RCPT-06).
- **SC-004**: Revenue metrics are net (signed sum including reversals) (DEC-41).

## Assumptions

- Receipts immutable; status derived (Valid/Reversed/Voided) (DEC-10).
- Payment (attempt) and Receipt (ledger) are separate entities (DEC-11).
- Refund marks Payment `refunded` and creates a reversal Receipt (DEC-11).

## Test Scenarios

TS-16, TS-18, TS-36, TS-53.
