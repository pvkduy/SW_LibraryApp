# Feature Specification: Suggestions — Reader

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Reader R-19; FR-SUGG-01, 02.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Reader (student)

**Shared context**: `specs/000-core/spec.md` (POL-12, DEC-31).

## User Scenarios & Testing

### User Story 1 - Submit a suggestion (Priority: P1)

A student requests a book the library doesn't carry.

**Why this priority**: Channels unmet demand into acquisitions.

**Independent Test**: Submit a suggestion with validation and grouping (TS-44).

**Acceptance Scenarios** (FR-SUGG-01):

1. **Given** an ISBN already in the catalog, **Then** the form shows the book and warns before submit.
2. **Given** 5 open suggestions, **Then** submit is blocked with the limit message.
3. **Given** a valid submission, **Then** a Suggestion with status `submitted` exists and is attached to a group.

### User Story 2 - Track suggestions (Priority: P2)

A student follows their suggestion's status timeline.

**Why this priority**: Transparency about request outcomes.

**Independent Test**: Track and withdraw (TS-44).

**Acceptance Scenarios** (FR-SUGG-02):

1. **Given** a rejection with reason `already_in_catalog`, **Then** the entry links to the book.
2. **Given** a withdraw on a `submitted`/`under_review` suggestion, **Then** it is withdrawn.

### Edge Cases

- Suggestion matches a book added later → groups linked and requesters notified (EC-24).

## Requirements

### Functional Requirements

- **FR-SUGG-01** `[PA1 §3.6]` **Submit a suggestion.** Form with title, author (required), ISBN or link (≥1; ISBN checksum validated; link http/https), reason (10-500 chars). Show matching catalog books and open groups as the student types; allow attaching to existing group. Max 5 open per student.
- **FR-SUGG-02** `[PA1 §3.6]` **Track suggestions.** List with status timeline, rejection reason, Withdraw button for `submitted`/`under_review`.

### Key Entities

- **Suggestion**: requester, title, author, ISBN norm, link, reason, status, group id.

## Success Criteria

- **SC-001**: Submission validation (title/author/ISBN/link/reason) is complete and client+server (TS-44).
- **SC-002**: Withdraw works only for `submitted`/`under_review` (FR-SUGG-02).

## Assumptions

- Title and author required; ISBN or link required (DEC-31).
- Max 5 open suggestions per student (DEC-31).

## Test Scenarios

TS-44.
