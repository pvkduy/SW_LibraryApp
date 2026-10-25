# Feature Specification: Membership — Reader

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Reader R-16; FR-MEM-01..05, 08.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Reader (student)

**Shared context**: `specs/000-core/spec.md` (POL-03, DEC-03/04/42/53).

## User Scenarios & Testing

### User Story 1 - View plans (Priority: P1)

A student sees available membership plans and their privileges.

**Why this priority**: Understanding entitlements is the precondition to buying.

**Independent Test**: Render plans from settings and verify price reflects changes (TS-33).

**Acceptance Scenarios** (R-16, FR-MEM-01):

1. **Given** a settings price change, **Then** the page shows the new price for new purchases.
2. **Given** a plan comparison, **Then** member vs non-member rules are shown side by side.

### User Story 2 - Buy or renew a plan (Priority: P1)

A student purchases a membership via the simulated payment.

**Why this priority**: Membership is the key revenue and entitlement driver.

**Independent Test**: Purchase with successful and failed payment (TS-33, TS-34).

**Acceptance Scenarios** (R-16, FR-MEM-02):

1. **Given** a successful purchase, **Then** membership `start`, `end`, `price_paid`, plan name, and privileges are stored and a receipt exists.
2. **Given** a later settings price change, **Then** the existing membership shows the original price paid (snapshot).
3. **Given** an active membership with 100 days left, **Then** renewal is blocked with the earliest renewal date.
4. **Given** a failed payment, **Then** nothing is created.

### User Story 3 - Membership status (Priority: P2)

A student sees their status, expiry, privileges, and history.

**Why this priority**: Transparency about current entitlements.

**Independent Test**: View status across active/expired states (TS-33).

**Acceptance Scenarios** (FR-MEM-03):

1. **Given** a membership ended yesterday, **Then** status is Expired and non-member rules are displayed.

### User Story 4 - Expiry handling (Priority: P1)

When a membership ends, existing loans keep due dates and reminders are sent.

**Why this priority**: Expiry has cross-cutting effects on borrowing and fees.

**Independent Test**: Simulate expiry with loans on hand and verify reminders (TS-35).

**Acceptance Scenarios** (FR-MEM-04, FR-MEM-08):

1. **Given** a membership ending in 7 days, **Then** one email is sent; a rerun sends none.
2. **Given** a member with 5 items whose membership expires, **Then** a new request is refused until at most 2 items remain counted.
3. **Given** a ready Premium reservation after expiry, **Then** handover requires the 5,000 VND fee.
4. **Given** a waiting reservation at expiry, **Then** it is cancelled with notice.

### Edge Cases

- Renewal while Restricted → blocked.
- Renewal outside the 30-day window → blocked with earliest renewal date.
- Renewal inside window → new membership starts day after current end (EC-09).
- Membership ended after a free Premium request → fee collected at counter at handover (EC-08).

## Requirements

### Functional Requirements

- **FR-MEM-01** `[PA1 §3.2]` **View plans.** SHALL show available plans (from settings) with price, duration, privileges table, and comparison to non-member rules.
- **FR-MEM-02** `[PA1 §3.2]` **Buy or renew a plan.** SHALL show price/start/end preview, run `purchase-membership` through simulated payment. Success creates membership with snapshot and receipt, notifies. Failure creates nothing. Blocked when Restricted or outside renewal window. Double submit safe.
- **FR-MEM-03** `[PA1 §3.2]` **Membership status.** SHALL show status, expiry, days left, exact snapshot privileges, purchase history with receipt links.
- **FR-MEM-04** `[PA1 §3.2]` **(System) Expiry reminder.** Scheduled job SHALL send email + in-app notice 7 days before end, once per membership.
- **FR-MEM-05** `[PA1 §3.2]` **(System) Entitlement resolution.** One shared function SHALL return current entitlements (POL-03) and be the only source for cart, checkout, renewal, reservation, and UI.
- **FR-MEM-08** `[PA1 §3.2]` **(System) Expiry with books on loan.** When membership ends: existing loans keep due dates, no retroactive fee, new requests respect non-member limit (DEC-23), waiting reservations cancelled with notice, ready reservations honored with fee at handover if Premium.

### Key Entities

- **Membership**: uid, plan name, price paid, start/end, privileges snapshot, receipt id, terminated flag.
- **MembershipPlan**: name, price, duration days, privileges, active flag.

## Success Criteria

- **SC-001**: Every purchase stores an immutable snapshot; later setting changes never alter it (TS-34).
- **SC-002**: Entitlement resolution single-source; returns non-member values the day after expiry (FR-MEM-05).
- **SC-003**: Expiry reminders fire exactly once per membership (FR-MEM-04, TS-35).

## Assumptions

- Plans are fixed-duration, prepaid, manually renewed (DEC-04).
- Membership non-transferable; no whole-degree plan (DEC-03).
- Online purchases non-refundable except admin exception (POL-03).

## Test Scenarios

TS-33, TS-34, TS-35.
