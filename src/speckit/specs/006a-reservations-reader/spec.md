# Feature Specification: Reservations & Wishlist — Reader

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Reader R-14, R-09; FR-RES-01, 02, 03, 04; FR-SRCH-06.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Reader (student)

**Shared context**: `specs/000-core/spec.md` (POL-07, DEC-24..27).

## User Scenarios & Testing

### User Story 1 - Reserve an unavailable book (Priority: P1)

An eligible member joins a queue for a book with no available copies.

**Why this priority**: Members expect priority access to popular, unavailable titles.

**Independent Test**: Reserve and enforce limits (TS-37).

**Acceptance Scenarios** (FR-RES-01):

1. **Given** a book with 5 waiting members, **Then** the 6th member sees "Queue is full".
2. **Given** a member under a reservation ban, **Then** Reserve is disabled with the ban end date.
3. **Given** a member at item limit, **Then** Reserve is disabled with a reason.
4. **Given** a member who already has the book on loan or on request, **Then** Reserve returns `DUPLICATE_ACTIVE_LOAN` and shows "You already have this book".

### User Story 2 - Promotion engine (Priority: P1)

When a copy becomes available, it is held for the first eligible member.

**Why this priority**: The core queue-correctness behavior.

**Independent Test**: Return a copy and verify promotion rules (TS-37).

**Acceptance Scenarios** (FR-RES-02):

1. **Given** a returned copy with queue [A (membership expired), B (eligible)], **Then** A is cancelled with reason, B gets the copy, and no strike is recorded.
2. **Given** a copy available with no eligible member, **Then** it stays `available` and wishlisters are notified.
3. **Given** a promotion, **Then** checks run in fixed order: account status/debt/membership first, then duplicate active loan, then item limit (skip), then promote.
4. **Given** a ready reservation, **Then** no Loan Item exists until handover, when it is created directly in `borrowed` and the reservation is set `fulfilled`.

### User Story 3 - Hold expiry and strikes (Priority: P2)

Ready reservations expire after 48 h, recording strikes.

**Why this priority**: Prevents dead holds and enforces accountability.

**Independent Test**: Simulate expiry and strike escalation (TS-38).

**Acceptance Scenarios** (FR-RES-03):

1. **Given** a first expiry, **Then** a warning notification exists and strikes = 1.
2. **Given** a second expiry within 180 days, **Then** `reservation_ban_until` is 30 days ahead and strikes reset.
3. **Given** expiry at 48 h 10 min, **Then** it is processed in the next run.

### User Story 4 - Cancel reservation (Priority: P2)

A member cancels a reservation without penalty.

**Why this priority**: Member control over their queue position.

**Independent Test**: Cancel waiting and ready reservations (TS-39).

**Acceptance Scenarios** (FR-RES-04):

1. **Given** a ready reservation cancelled, **Then** the next waiting member is promoted within one function execution and receives a notification.

### User Story 5 - Wishlist (Priority: P2)

A student subscribes to a "notify me when available" notification.

**Why this priority**: Keeps students informed when a book returns.

**Independent Test**: Wishlist then trigger availability (TS-13).

**Acceptance Scenarios** (FR-SRCH-06):

1. **Given** a wishlisted book whose copy is returned with no queue, **Then** one in-app and one email notification are created; a job retry creates none.

### Edge Cases

- Queue vs wishlisters both exist → queue first; wishlisters only if queue empties (EC-02).
- Membership ended / Restricted / debt hold at promotion → cancelled with reason, no strike (DEC-26).
- Member at item limit at promotion → skipped but keeps position (DEC-26).
- Reservation for a book whose copy becomes available between load and click → server rejects `NOT_AVAILABLE` (EC-33).
- Book becomes non-circulating (all copies retired/lost) → every `waiting` reservation cancelled with reason `book_not_circulating`, no strike, members notified (POL-07). A `ready_for_pickup` reservation expires normally instead.

## Requirements

### Functional Requirements

- **FR-RES-01** `[PA1 §3.4]` **Reserve an unavailable book.** Eligible member joins the queue of a Book with zero available copies; show position; enforce POL-07 limits (queue 5, 3 active, one per book, no ban, no debt hold, active membership). A member cannot reserve a Book they already hold as an active Loan Item or open request (`DUPLICATE_ACTIVE_LOAN`). Non-members see why and a link to Membership.
- **FR-RES-02** `[PA1 §3.4]` **(System) Promotion engine.** Whenever a copy becomes available, run promotion per POL-07 in one transaction, holding the copy for the first eligible member, or leaving it `available` and notifying wishlisters. Promotion applies a fixed check order (account/debt/membership → duplicate active loan → item limit → promote).
- **FR-RES-03** `[PA1 §3.4]` **(System) Hold expiry and strikes.** A 15-minute job expires ready reservations past 48 h, applies strike rules, releases the copy, promotes.
- **FR-RES-04** `[PA1 §3.4]` **Cancel reservation.** Member cancels waiting/ready reservation with no strike; ready cancellation releases the copy to the next eligible member. A ready reservation has no Loan Item yet; it is materialised only at handover.
- **FR-SRCH-06** `[PA1 §3.3]` **Wishlist.** Toggle "Notify me" on unavailable book (max 50), list entries, notify per POL-07 when available with no queue.

### Key Entities

- **Reservation**: uid, book, status, created at, copy, hold until, `pickup_code_hash`, outcome.
- **WishlistEntry**: uid, book, created at, last notified at.
- **ReservationStrike**: uid, at (rolling 180-day window).

## Success Criteria

- **SC-001**: Promotion always holds a copy for the first eligible member with no deadlocks (TS-37).
- **SC-002**: Strike/ban rules deterministic per DEC-25 (TS-38).
- **SC-003**: Wishlist notifications fire exactly once and only when no queue remains (TS-13).
- **SC-004**: Queue limits enforced server-side (FR-RES-01).

## Assumptions

- Reservation is member-only, 48 h hold (POL-07).
- Strike window 180 days, strike 2 → 30-day ban (DEC-25).
- Queue FIFO by creation time.

## Test Scenarios

TS-13, TS-37, TS-38, TS-39.
