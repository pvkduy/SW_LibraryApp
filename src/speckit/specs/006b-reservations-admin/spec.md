# Feature Specification: Reservations — Admin

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-09/A-10; FR-RES-05.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Admin (staff)

**Shared context**: `specs/000-core/spec.md` (POL-07, DEC-26).

## User Scenarios & Testing

### User Story 1 - Queue oversight (Priority: P2)

Staff view queues and cancel reservations with reason.

**Why this priority**: Operational control over holds.

**Independent Test**: Staff cancel a ready reservation (TS-40).

**Acceptance Scenarios** (FR-RES-05):

1. **Given** a staff cancel of a ready reservation, **Then** the copy is promoted to the next member and the student is notified with the reason.
2. **Given** the queue view, **Then** queue order, ready holds with deadlines, and each student's strikes/ban end are shown.

### Edge Cases

- Staff cannot reorder the queue (FR-RES-05).
- Staff cancel carries no strike (POL-07).

## Requirements

### Functional Requirements

- **FR-RES-05** `[+]` **Queue oversight.** List books with waiting/ready reservations, queue order, ready holds with deadlines, strikes, and ban end. Staff MAY cancel with reason (no strike, student notified). Cannot reorder.

### Key Entities

- **Reservation**: status, queue position, hold deadline.

## Success Criteria

- **SC-001**: Staff cancellation promotes the copy to the next eligible member deterministically (TS-40).

## Assumptions

- Staff cancellation uses the same promotion engine as automatic expiry (FR-RES-02).

## Test Scenarios

TS-40.
