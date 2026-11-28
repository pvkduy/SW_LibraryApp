# Feature Specification: Loans, Fines & Ratings — Reader

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Reader R-12, R-17, R-21; FR-LOAN-01..10.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Reader (student)

**Shared context**: `specs/000-core/spec.md` (POL-04, POL-06, POL-08, POL-09, DEC-15..17).

## User Scenarios & Testing

### User Story 1 - My Loans list (Priority: P1)

A student sees everything borrowed or requested, split into Ongoing and History.

**Why this priority**: The central view of the reader's borrowing state.

**Independent Test**: Verify status labels, split, filters, pagination (TS-22).

**Acceptance Scenarios** (R-12, FR-LOAN-01):

1. **Given** an item that turned overdue overnight, **Then** it shows Overdue in Ongoing after refresh with the accrued fine.
2. **Given** a returned item, **Then** it is in History only.
3. **Given** a stale action, **Then** a "status changed" message shows and the view refreshes.

### User Story 2 - Renew (Priority: P1)

A student extends a borrowed loan's due date.

**Why this priority**: Core lending convenience.

**Independent Test**: Renew allowed and blocked cases (TS-23).

**Acceptance Scenarios** (FR-LOAN-03):

1. **Given** a member with 2 renewals allowed and 2 used, **Then** Renew is disabled with "Renewal limit reached".
2. **Given** a waiting reservation by another member, **Then** Renew is disabled with "Another member is waiting".
3. **Given** a successful renewal, **Then** due date = old due date + 14 days.
4. **Given** a non-member Premium renewal, **Then** payment is required first (DEC-52).

### User Story 3 - Pickup countdown (Priority: P2)

A student sees an accurate countdown to the pickup deadline.

**Why this priority**: Correct time handling for pickup.

**Independent Test**: Verify server-time skew correction (TS-19).

**Acceptance Scenarios** (FR-LOAN-02):

1. **Given** a device clock 10 minutes fast, **Then** the countdown still matches the server deadline within 5 s.

### User Story 4 - Fines and payment (Priority: P1)

A student sees overdue fines and pays them.

**Why this priority**: Financial correctness for the library and student.

**Independent Test**: Compute fine and pay it (TS-25).

**Acceptance Scenarios** (FR-LOAN-05, FR-LOAN-06, FR-LOAN-10):

1. **Given** due date Monday and today Thursday, **Then** 3 days and 6,000 VND show.
2. **Given** 60 days overdue, **Then** the fine is capped at the replacement price.
3. **Given** two unpaid charges paid online, **Then** two receipts exist and the debt hold clears if outstanding is 0.
4. **Given** a failed payment, **Then** charges stay unpaid and a retry is offered.
5. **Given** a refunded fee, **Then** both the original and the reversal show, the original with status Reversed.

### User Story 5 - Rating and review (Priority: P2)

A student rates and reviews a returned book.

**Why this priority**: Feeds popularity and recommendation.

**Independent Test**: Rate a returned loan; verify gating (TS-24).

**Acceptance Scenarios** (FR-LOAN-04):

1. **Given** a returned loan, **Then** the rating dialog is offered once.
2. **Given** a student who never returned the book, **Then** the rating control is not shown.
3. **Given** an edited rating, **Then** the average is recomputed.

### Edge Cases

- Fine cap reached before day 60 → fine stops growing; loan stays `overdue` (EC-15).
- Student pays fine while still overdue → paid Charge stays paid; new Charge next night (EC-16).
- Book returned after Lost beyond 90 days → admin decides refund (EC-17).

## Requirements

### Functional Requirements

- **FR-LOAN-01** `[PA1 §3.5]` **My Loans list.** Split Ongoing (`awaiting_payment`, `payment_failed`, `ready_for_pickup`, `borrowed`, `overdue`, unresolved `lost`, waiting/ready reservations) and History (`returned`, `expired`, `cancelled`, resolved `lost`). Exact labels. Rows show cover/title/status/date/fee-or-fine/actions. Newest first, 20/page, filterable.
- **FR-LOAN-02** `[PA1 §3.5]` **Pickup countdown.** Countdown to server deadline (client skew corrected), emphasis under 12 h, "Expired" only after server confirms.
- **FR-LOAN-03** `[PA1 §3.5]` **Renew.** Enabled only when POL-06 allows; disabled shows reason (overdue, limit, queue, debt). New due date immediately. Fee-bearing renewal through payment first (DEC-52).
- **FR-LOAN-04** `[PA1 §3.5]` **Rating and review.** After return, invite 1-5 stars + optional review (≤1,000 chars). One per student per book, editable. Skip allowed. Updates average/popularity.
- **FR-LOAN-05** `[PA1 §3.5]` **Fine display.** Show days overdue, the running fine, its replacement-price cap, the lost-conversion date, and total outstanding. Where a loan holds multiple fine Charges (paid then top-up), staff see the final fine with the amount already paid shown next to it.
- **FR-LOAN-06** `[PA1 §3.5]` **Pay fines and fees.** Pay whole charges online (simulated) or "Pay at counter" (amounts + reference). Payment creates receipts and updates charges/debt hold immediately.
- **FR-LOAN-07** `[PA1 §3.5]` **(System) Debt hold.** Keep `profiles.debt_outstanding` equal to sum of outstanding charges, updated in the same transaction, enforcing gating 6.1.
- **FR-LOAN-08** `[PA1 §3.5]` **(System) Overdue and lost automation.** Nightly job marks overdue, keeps unpaid overdue-fine Charge current, sends final warning at day 53, converts to `lost` at day 60 (copy `lost`, student `restricted`, frozen fine, loss Charge).
- **FR-LOAN-09** `[PA1 §3.5]` **(System) Lost resolution.** Implement paths A and B of POL-08 (waive/refund replacement), leave restore decision to FR-AUTH-08.
- **FR-LOAN-10** `[+]` **Payment history.** List the student's receipts (number, date, type, amount, status) with printable view.

### Key Entities

- **LoanItem**: request, uid, book, copy, status, fee, duration, due, return, renewals, condition in/out, lost timestamps.
- **Charge**: uid, type (`overdue_fine`/`damage_fee`/`loss_fee`), loan item id, amount, status, paid at, frozen; fine Charges also carry `days_from`, `days_to`, and `rate`.

## Success Criteria

- **SC-001**: Fine, cap, and lost conversion deterministic per POL-08 (TS-25, TS-27, TS-28).
- **SC-002**: Debt hold cleared the instant outstanding reaches 0 (FR-LOAN-07).
- **SC-003**: p95 ≤ 2 s for renewal (NFR-03).

## Assumptions

- Fine 2,000 VND/day, no grace, capped at replacement price (DEC-15).
- Lost threshold 60 days, warning 7 days before (POL-08).
- Timezone `Asia/Ho_Chi_Minh`; due 23:59:59 local (DEC-47).

## Test Scenarios

TS-22, TS-23, TS-19, TS-25, TS-24, TS-27, TS-28, TS-64.
