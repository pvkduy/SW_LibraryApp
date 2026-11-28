# Feature Specification: Notifications — Reader

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Reader R-18; FR-NOTIF-01, 02, 03, 05.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Reader (student)

**Shared context**: `specs/000-core/spec.md` (POL-11, DEC-28/29).

## User Scenarios & Testing

### User Story 1 - Notification center (Priority: P1)

A student sees and manages notifications with a real-time unread badge.

**Why this priority**: Keeps students informed about due dates, pickups, and account status.

**Independent Test**: Verify badge, mark read, mark all read (TS-43).

**Acceptance Scenarios** (FR-NOTIF-01):

1. **Given** a new notification while the app is open, **Then** the badge increments without reload.
2. **Given** Mark all read, **Then** the badge shows 0.
3. **Given** a notification opened, **Then** it is marked read.

### User Story 2 - Scheduled email and in-app reminders (Priority: P1)

The system sends due-date, overdue, membership, pickup, and lost warnings on schedule.

**Why this priority**: Helps students avoid fines and missed pickups (core value).

**Independent Test**: Simulate schedule and verify dedupe (TS-27).

**Acceptance Scenarios** (FR-NOTIF-02, FR-NOTIF-03):

1. **Given** a loan due today, **Then** one email is sent at 08:00 local and a rerun sends none.
2. **Given** a loan due in 2 days, **Then** one notification exists after the daily job.

### User Story 3 - Event notifications (Priority: P1)

Event-driven notifications fire on status changes.

**Why this priority**: Immediate feedback on the events that matter.

**Independent Test**: Trigger events and verify notifications (TS-13, TS-45).

**Acceptance Scenarios** (FR-NOTIF-05):

1. **Given** a loan request becoming ready, **Then** an in-app notification and an email are created once.

### Edge Cases

- Retried jobs never send twice (dedupe_key) (POL-11).
- In-app notifications live 90 days (POL-11).
- Email provider outage → in-app still created; email retried; failures visible to admins (EC-23).

## Requirements

### Functional Requirements

- **FR-NOTIF-01** `[PA1 §3.5]` **Notification center.** List newest first (30/page), emphasize unread, mark one read on open, Mark all read, deep-link to related screen, real-time unread badge.
- **FR-NOTIF-02** `[PA1 §3.5]` **(System) Scheduled email reminders.** Send POL-11 emails (due date, overdue day 7/14, membership expiring, pickup ending, lost final warning), each with a `dedupe_key`.
- **FR-NOTIF-03** `[PA1 §3.5]` **(System) In-app schedule.** Create in-app notifications 2 days before due, on due date, on becoming overdue, and on pickup deadlines.
- **FR-NOTIF-05** `[PA1 §3.5]` **(System) Event notifications.** Create event-driven notifications per POL-11 (ready pickup, reservation events, wishlist, account status, charges, suggestion/batch events), once (dedupe_key).

### Key Entities

- **Notification**: uid, type, title, body, link, read, dedupe key, created/expires at.
- **EmailOutbox**: to, template, payload, status, attempts, next attempt, dedupe key.

## Success Criteria

- **SC-001**: No notification or email sent twice for the same event (POL-11).
- **SC-002**: Critical reminders fire on schedule (TS-27).
- **SC-003**: Unread badge updates in real time (FR-NOTIF-01).

## Assumptions

- Email via `EmailProvider` abstraction (POL-11).
- In-app notifications retained 90 days (POL-11).

## Test Scenarios

TS-13, TS-27, TS-43, TS-45.
