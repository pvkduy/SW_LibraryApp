# Feature Specification: Cart & Checkout

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Reader screens R-10, R-11, R-13; FR-CART-01..08.

**Created**: 2026-10-23

**Status**: Draft

**Shared context**: `specs/000-core/spec.md` (POL-04, POL-05, DEC-05/12/13/14/49).

## User Scenarios & Testing

### User Story 1 - Add to cart (Priority: P1)

A student collects available books, subject to limits.

**Why this priority**: The start of the borrowing workflow.

**Independent Test**: Add books and exercise limit/duplicate rules (TS-14).

**Acceptance Scenarios** (R-10, FR-CART-01):

1. **Given** a book already in an active loan, **Then** Add to cart is disabled with a reason.
2. **Given** a limit of 3 with 2 counted items, **Then** at most 1 more book can be in the cart.

### User Story 2 - Cart view and fees (Priority: P1)

A student reviews lines, chooses durations, and sees fees.

**Why this priority**: Transparency of cost before checkout.

**Independent Test**: Render member vs non-member fee (TS-14).

**Acceptance Scenarios** (FR-CART-02):

1. **Given** a non-member with a Premium line, **Then** the fee shows 5,000 VND and the total is correct.
2. **Given** a member, **Then** the Premium line fee is 0.
3. **Given** a line whose book became unavailable, **Then** it is flagged and blocks checkout until removed.

### User Story 3 - Checkout with stock hold (Priority: P1)

A student checks out, holding copies atomically.

**Why this priority**: The core transaction; correctness under concurrency is critical.

**Independent Test**: Race two students for the last copy (TS-15).

**Acceptance Scenarios** (FR-CART-03):

1. **Given** two students checking out the last copy at the same time, **Then** exactly one succeeds and the other sees "No longer available".
2. **Given** a repeated call with the same idempotency key, **Then** no second request is created.
3. **Given** any failing line, **Then** the whole checkout is rejected with per-line reasons and the cart is kept.

### User Story 4 - Free path (Priority: P1)

Free items become ready for pickup immediately.

**Why this priority**: The common case (Standard books, members).

**Independent Test**: Checkout a free book (TS-15).

**Acceptance Scenarios** (FR-CART-04):

1. **Given** a Standard book, **Then** after checkout its status is Ready for Pickup and the request page shows the pickup code.

### User Story 5 - Paid path and payment (Priority: P1)

A non-member pays for Premium items online or at the counter.

**Why this priority**: The fee-bearing path.

**Independent Test**: Pay online, fail, and expire (TS-16, TS-17).

**Acceptance Scenarios** (FR-CART-05, FR-CART-06):

1. **Given** a paid item with online selected, **Then** it shows Awaiting Payment with a 30 min countdown.
2. **Given** a mixed cart, **Then** the free item is Ready for Pickup while the paid item is Awaiting Payment.
3. **Given** double-click on Pay, **Then** exactly one Payment succeeds and one receipt per line exists.
4. **Given** the deadline passed, **Then** "Payment window expired" and items are `expired`.

### User Story 6 - Cancel with refund (Priority: P2)

A student cancels an item and, if paid online, is refunded.

**Why this priority**: Recovery from changed circumstances.

**Independent Test**: Cancel a paid item (TS-18).

**Acceptance Scenarios** (FR-CART-07):

1. **Given** a paid item cancelled, **Then** a reversal receipt exists, the Payment is `refunded`, and the copy is `available` or `held` for the next queue member.
2. **Given** a counter-paid fee, **Then** cancellation is not offered online; it directs the student to staff.

### User Story 7 - Pickup code (Priority: P1)

A student sees a pickup code for handover.

**Why this priority**: Required for the handover workflow.

**Independent Test**: Verify ownership-only access (TS-19).

**Acceptance Scenarios** (FR-CART-08):

1. **Given** another student's request URL, **Then** access is denied (403).

### Edge Cases

- Cart does not hold stock (DEC-49); stock validated and held at checkout.
- One copy picked per line (lowest copy number among `available`), row lock with `SKIP LOCKED`.
- Same copy never held twice.
- Student may switch online → counter once.
- Cancel waits for the Payment outcome; a completed payment triggers the normal refund (EC-04).
- Payment completion after window → `PAYMENT_EXPIRED` (EC-05).
- Book switched to Premium between cart and checkout → fee computed at checkout (EC-06).

## Requirements

### Functional Requirements

- **FR-CART-01** `[PA1 §3.4]` **Add to cart.** SHALL allow adding only books with an available copy; hide/disable when already in cart, already actively borrowed/requested, or adding would exceed the item limit (DEC-22).
- **FR-CART-02** `[PA1 §3.4]` **Cart view.** List lines with cover/title/collection, duration selector (limited to allowed options, DEC-05), line fee, total fee, entitlement summary, remove buttons. Unavailable lines flagged and block checkout.
- **FR-CART-03** `[PA1 §3.4]` **Checkout with stock hold.** Call `checkout-cart` (idempotency key) which in one transaction validates gating/debt/entitlements/limits/duplicates/availability, picks one `available` copy per line (row lock `SKIP LOCKED`), sets each `held`, creates the Loan Request + Items, clears the cart. Any failure rejects the whole checkout with per-line reasons.
- **FR-CART-04** `[PA1 §3.4]` **Free path.** Free items become `ready_for_pickup` immediately with 48 h deadline, no payment step.
- **FR-CART-05** `[PA1 §3.4]` **Paid path.** Premium items for non-members start `awaiting_payment`. Online (30 min) or counter (48 h). Free and paid items tracked per item. Switch online → counter once.
- **FR-CART-06** `[PA1 §3.4]` **Simulated payment gateway.** Clearly labelled "Simulated gateway" page; Pay, Simulate failure, Cancel (failure control only when `VITE_PAYMENT_SIMULATOR_CONTROLS=true`). `complete-simulated-payment` is idempotent, checks ownership and deadline. Success creates one receipt per paid line and moves items to `ready_for_pickup` (fresh 48 h). Failure moves to `payment_failed` (Retry / counter / Cancel).
- **FR-CART-07** `[PA1 §3.4]` **Cancel with refund.** Cancel any `awaiting_payment`/`payment_failed`/`ready_for_pickup` item (or whole request) after confirmation. Paid online cancel refunds (Payment `refunded`, reversal receipt) and releases the copy. Expiry does the same automatically.
- **FR-CART-08** `[+]` **Pickup code.** 6-digit code visible only to the owner. Staff find the request by code or student ID.

### Key Entities

- **LoanRequest**: uid, created at, idempotency key, pickup code hash, payment id.
- **LoanItem**: request id, uid, book, copy, source (cart/reservation), status, is_premium, fee, duration, payment/pickup deadlines, due date, renewals used.
- **Payment**: uid, purpose, amount, method, status, provider, deadline, idempotency key.

## Success Criteria

- **SC-001**: No copy is ever held twice, even under concurrency (TS-15, NFR-10).
- **SC-002**: Checkout commits atomically; failed lines leave the cart intact (FR-CART-03).
- **SC-003**: Every paid item produces exactly one receipt per line, idempotently (TS-16).
- **SC-004**: p95 ≤ 2 s for checkout and payment completion (NFR-03).
- **SC-005**: Cancel/expiry of a paid item always refunds exactly once (TS-18).

## Assumptions

- Payments simulated only (ASM-02).
- Fee is fixed at checkout and stored on the Loan Item (POL-05).
- Partial payments out of scope (POL-05).

## Test Scenarios

TS-14, TS-15, TS-16, TS-17, TS-18, TS-19.
