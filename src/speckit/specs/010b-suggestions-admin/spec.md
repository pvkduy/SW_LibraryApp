# Feature Specification: Suggestions & Acquisition — Admin

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-11..A-13; FR-SUGG-03..09.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Admin (staff)

**Shared context**: `specs/000-core/spec.md` (POL-12, DEC-31..33).

## User Scenarios & Testing

### User Story 1 - Automatic grouping and review (Priority: P1)

Staff see suggestions grouped by demand and decide on them.

**Why this priority**: Turns individual requests into actionable procurement signals.

**Independent Test**: Group by ISBN and review a group (TS-44, TS-45).

**Acceptance Scenarios** (FR-SUGG-03, FR-SUGG-04):

1. **Given** two suggestions with the same ISBN, **Then** they share one group with demand 2.
2. **Given** a rejected group of 3 requesters, **Then** 3 notifications and emails are created and all requests show the reason.
3. **Given** opening a group, **Then** `submitted` requests move to `under_review`.

### User Story 2 - Batches (Priority: P1)

Staff build, export, order, and receive acquisition batches.

**Why this priority**: The acquisition workflow from approval to shelf.

**Independent Test**: Full batch lifecycle (TS-46).

**Acceptance Scenarios** (FR-SUGG-05..08):

1. **Given** a backlog group added with quantity 3, **Then** its suggestions become `in_batch`.
2. **Given** an `ordered` batch, **Then** line quantities cannot be edited.
3. **Given** two exports, **Then** both versions are listed and re-downloadable, differing if lines changed.
4. **Given** a line ordered 3 with receipt of 2, **Then** line is `partial`, 2 copies exist, and 2 transactions link to the batch.
5. **Given** close with a pending line, **Then** the dialog lists it and its suggestions return to the backlog.

### Edge Cases

- A title with no Book yet → admin forced through Book editor first (POL-12).
- Receiving more than ordered → allowed with mandatory note (POL-12).
- Receipt saved twice → requesters notified once (DEC-33, FR-SUGG-09).

## Requirements

### Functional Requirements

- **FR-SUGG-03** `[PA1 §3.6]` **Automatic grouping.** Group on creation: normalized ISBN, else accent-insensitive title+author similarity ≥ threshold. Staff MAY merge/split. Demand = distinct students.
- **FR-SUGG-04** `[PA1 §3.6]` **Review queue.** List groups by demand; approve (Approved backlog) or reject (reason required). Each decision notifies all requesters. Opening moves `submitted` → `under_review`.
- **FR-SUGG-05** `[PA1 §3.6]` **Create and build a batch.** Named batch in `draft`; add lines from Approved backlog or any title with quantity; edit/remove while `draft`; mark `ordered` (lines locked).
- **FR-SUGG-06** `[PA1 §3.6]` **Export with versions.** Export CSV/PDF/Excel; store immutable versions (v1, v2, ...) with who/when/format/snapshot.
- **FR-SUGG-07** `[PA1 §3.6]` **Receive and close.** Record receipts per line (quantity/date/note) creating copies with barcodes and `batch_receipt` transactions; partial/over-receipt; force Book creation first; close batch (remaining lines `not_received`, POL-12).
- **FR-SUGG-08** `[PA1 §3.6]` **Batch detail.** Show ordered vs received per line, export versions, receipt records, activity log.
- **FR-SUGG-09** `[PA1 §3.6]` **(System) Requester notifications.** Notify every requester at each decision (approved, rejected, in batch, received, delayed), once per event.

### Key Entities

- **SuggestionGroup**: canonical fields, demand, status, book id.
- **Batch**, **BatchLine** (qty ordered/received, status), **BatchExport** (version, format, snapshot), **BatchActivity**.

## Success Criteria

- **SC-001**: Automatic grouping produces correct demand by ISBN and fuzzy similarity (TS-44).
- **SC-002**: Every decision notifies all requesters exactly once per event (FR-SUGG-09, TS-45).
- **SC-003**: Batch lifecycle fully traceable with immutable export versions (TS-46).
- **SC-004**: Receiving creates copies and inventory transactions correctly (TS-46).

## Assumptions

- Grouping threshold 0.85 (DEC-31).
- Approved groups enter a backlog; nothing auto-added (DEC-32).

## Test Scenarios

TS-44, TS-45, TS-46.
