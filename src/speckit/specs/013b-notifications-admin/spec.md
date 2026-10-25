# Feature Specification: Notifications — Admin (Reminders)

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-10; FR-NOTIF-04.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Admin (staff)

**Shared context**: `specs/000-core/spec.md` (DEC-30, POL-11).

## User Scenarios & Testing

### User Story 1 - Bulk reminder ("Remind all") (Priority: P2)

Staff remind selected students in bulk with throttle.

**Why this priority**: Operational efficiency for overdue/due groups.

**Independent Test**: Preview and send bulk reminders (TS-43).

**Acceptance Scenarios** (FR-NOTIF-04):

1. **Given** 10 students of whom 3 were reminded 2 hours ago, **Then** the confirmation says 7 will be sent and 3 skipped.
2. **Given** a confirm, **Then** in-app notifications are sent and the result (sent, skipped) is shown.

### Edge Cases

- One bulk reminder per student per 24 h (DEC-30).
- Individual Remind per student still available (FR-NOTIF-04).

## Requirements

### Functional Requirements

- **FR-NOTIF-04** `[PA1 §3.5]` **Remind all.** "Remind all" for the current group/filter; confirmation with recipient count (excluding students bulk-reminded in last 24 h); sends in-app and shows sent/skipped. Individual Remind per student.

### Key Entities

- **Notification**: bulk in-app reminders (dedupe key).

## Success Criteria

- **SC-001**: Bulk reminders respect the 24 h throttle (TS-43, DEC-30).
- **SC-002**: Preview count is accurate before sending (FR-NOTIF-04).

## Assumptions

- Bulk reminders are in-app only (POL-11).
- "Remind all" targets the currently filtered due/overdue group (DEC-30).

## Test Scenarios

TS-43.
