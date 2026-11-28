# Feature Specification: Suggestions & Acquisition — Admin

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-11..A-13; FR-SUGG-03, 04, 05, 07, 08, 09.

**Created**: 2026-10-23

**Status**: Draft (v1.3 — checklist batch, no backlog/pricing/export-versions)

**Side**: Admin (staff)

**Shared context**: `specs/000-core/spec.md` (POL-12, DEC-31..33).

## User Scenarios & Testing

### User Story 1 - Grouping and review (Priority: P1)

Staff see suggestions grouped by demand, view their justifications, and either reject a suggestion or add it to a batch.

**Why this priority**: Turns individual requests into actionable acquisition titles.

**Independent Test**: Group by ISBN and review a group (TS-44, TS-45).

**Acceptance Scenarios** (FR-SUGG-03, FR-SUGG-04):

1. **Given** two suggestions with the same ISBN, **Then** they share one group whose view lists each patron's justification.
2. **Given** a suggestion rejected, **Then** a rejection justification is required and all requesters are notified.
3. **Given** a suggestion added to a batch, **Then** its title becomes a line with the chosen quantity.

### User Story 2 - Batches (Priority: P1)

Staff create and order hand-made batches, then mark each title received.

**Why this priority**: The acquisition workflow from suggestion to shelf.

**Independent Test**: Full batch lifecycle (TS-46).

**Acceptance Scenarios** (FR-SUGG-05, 07, 08):

1. **Given** a batch saved as draft, **Then** it is stored and editable (name + expected fulfillment date).
2. **Given** a title added with quantity 3, **Then** the batch shows that title with expected quantity 3.
3. **Given** an `ordered` batch, **Then** line quantities are locked.
4. **Given** a line marked received, **Then** its title's copies become `available` and the activity history records the operator and time.
5. **Given** all rows marked received, **Then** the batch status becomes `closed`.

### Edge Cases

- A title with no Book yet → admin completes the Book editor first (POL-12).
- Marking a line received records who marked it and the time; target shelf staging location and optional discrepancy note captured.
- Receipt saved twice → requesters notified once (DEC-33, FR-SUGG-09).

## Requirements

### Functional Requirements

- **FR-SUGG-03** `[PA1 §3.6]` **Automatic grouping.** Group on creation: normalized ISBN, else accent-insensitive title+author similarity ≥ threshold. Grouped titles contribute all members' justifications. Demand = distinct students.
- **FR-SUGG-04** `[PA1 §3.6]` **Review a suggestion.** View patron justifications; offer a rejection justification box + Reject, or a target batch selector (quantity stepper) + Add to batch.
- **FR-SUGG-05** `[PA1 §3.6]` **Create and build a batch.** Hand-made named entry (editable name) with an expected fulfillment date; each title added directly from student suggestions with a set quantity, or removed. Draft until marked `ordered` (lines locked).
- **FR-SUGG-07** `[PA1 §3.6]` **Receive a line.** Track which title is delivered; mark a line received with a target shelf staging location and optional discrepancy note; copies become `available` via `batch_receipt` transactions; activity history records who marked it received.
- **FR-SUGG-08** `[PA1 §3.6]` **Batch detail and close.** Table–detail panel: each row lists a title and its expected quantity with a received state; closed automatically when every row is received.
- **FR-SUGG-09** `[PA1 §3.6]` **(System) Requester notifications.** Notify every requester at each decision (rejected, in batch, received), once per event.

### Key Entities

- **SuggestionGroup**: canonical fields, demand, status, book id.
- **Batch**, **BatchLine** (expected quantity, received state, staging location, discrepancy note), **BatchActivity** (who marked which title received).

## Success Criteria

- **SC-001**: Automatic grouping produces correct demand by ISBN and fuzzy similarity (TS-44).
- **SC-002**: Every decision notifies all requesters exactly once per event (FR-SUGG-09, TS-45).
- **SC-003**: Batch lifecycle is traceable — each received line records who marked it and when (TS-46).
- **SC-004**: Receiving creates copies and inventory transactions correctly (TS-46).

## Assumptions

- Grouping threshold 0.85 (DEC-31).
- A batch is a tracking checklist; titles are added directly from student suggestions (DEC-32).

## Test Scenarios

TS-44, TS-45, TS-46.
