# Feature Specification: Inventory & Write-off

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-04..A-07, A-14, A-15; FR-INV-01..07, 09; FR-COND-02, 03.

**Created**: 2026-10-23

**Status**: Draft

**Shared context**: `specs/000-core/spec.md` (POL-13, DEC-34..38).

## User Scenarios & Testing

### User Story 1 - Add and edit books (Priority: P1)

Staff add books by ISBN autofill, manual entry, or adding copies to existing titles.

**Why this priority**: The catalog is the foundation of all discovery and borrowing.

**Independent Test**: Add via ISBN, manual, and edit metadata (TS-47).

**Acceptance Scenarios** (FR-INV-01, FR-INV-03):

1. **Given** a known ISBN, **Then** fields are prefilled and editable.
2. **Given** a duplicate ISBN, **Then** the form offers "Add copies to existing book".
3. **Given** lookup timeout, **Then** the manual form stays usable without losing typed data.
4. **Given** a change from Standard to Premium, **Then** a non-member's next checkout shows a fee and an existing borrowed loan is unchanged.

### User Story 2 - Bulk import (Priority: P2)

Staff import books via CSV.

**Why this priority**: Efficient catalog loading.

**Independent Test**: Import a mixed-validity file (TS-48).

**Acceptance Scenarios** (FR-INV-02):

1. **Given** 100 rows with 5 invalid, **Then** 95 import, 5 are reported with reasons, and the report downloads.
2. **Given** a file of 1,001 rows, **Then** it is rejected before upload.
3. **Given** a network drop mid-commit, **Then** re-running with "skip duplicates" completes the rest with no duplicates.

### User Story 3 - Copies and labels (Priority: P1)

Staff manage per-copy records, barcodes, and labels.

**Why this priority**: Physical inventory tracking depends on unique copies.

**Independent Test**: Create copies, print labels, change status (TS-49).

**Acceptance Scenarios** (FR-INV-04, FR-INV-07):

1. **Given** a new copy, **Then** a unique barcode is assigned and scanning it finds the copy.
2. **Given** a copy set to `damaged`, **Then** available count decreases and a `status_change` transaction exists.
3. **Given** a `lost` copy marked found, **Then** a `found` transaction exists and the copy is `available`.
4. **Given** an attempt to set `held` or `borrowed` manually, **Then** it is rejected.

### User Story 4 - Inventory history (Priority: P2)

Staff review the full transaction log.

**Why this priority**: Audit trail for stock movement.

**Independent Test**: Verify transactions reconcile (TS-51, TS-28).

**Acceptance Scenarios** (FR-INV-05, FR-INV-06):

1. **Given** any copy addition, status change, or loss, **Then** exactly one matching transaction exists.
2. **Given** filter Stock reductions, **Then** manual write-offs and automatic lost flags both appear.
3. **Given** a batch receipt row, **Then** its link opens the batch detail.

### User Story 5 - Write-off slips (Priority: P2)

Staff create and complete write-off slips for damaged/missing/obsolete copies.

**Why this priority**: Asset control and accountability for removals.

**Independent Test**: Complete a multi-copy slip and test rules (TS-52).

**Acceptance Scenarios** (FR-COND-02, FR-COND-03):

1. **Given** a slip with 2 copies completed, **Then** both copies have the target status, 2 transactions link to the slip, and histories remain intact.
2. **Given** a borrowed copy in the slip, **Then** Complete is refused.
3. **Given** damage-beyond-repair without a photo, **Then** Complete is refused.
4. **Given** a completed slip, **Then** edit controls are absent and the API rejects edits.

### Edge Cases

- Held copy in a slip → refused until hold released (EC-13).
- Book with all copies retired/lost/damaged → not reservable; "Not currently circulating" (EC-27).
- A `found` copy restores a lost copy (DEC-36).
- Copies never hard-deleted; books never hard-deleted (POL-13).

## Requirements

### Functional Requirements

- **FR-INV-01** `[PA1 §3.7]` **Add a book.** Three ways: (1) pick existing title + add copies; (2) scan/type ISBN to autofill via `lookupIsbn` then review/save; (3) manual entry. Adding copies creates Copy records with barcodes and `manual_addition` transactions. ISBN unique. Failed lookup falls back to manual entry.
- **FR-INV-02** `[PA1 §3.7]` **CSV import.** Offer template; accept UTF-8 up to 2 MB and 1,000 rows; validate every row client+server; preview with per-row errors; duplicate-ISBN action (skip/add copies/update metadata). Commit in chunks of 200, each independent, with a downloadable report. Re-run with "skip" creates nothing new.
- **FR-INV-03** `[PA1 §3.7]` **Edit metadata and collection.** Edit title, authors, publisher, year, language, category, field, description, TOC, keywords, collection, replacement price, default shelf location, cover (to `covers` bucket). Saving queues re-embedding when an embedded field changed; search vector updates automatically. Collection change applies only to new checkouts. Bulk "Set collection" available.
- **FR-INV-04** `[PA1 §3.7]` **Copy records and labels.** Every copy has a unique barcode (Code 128), status, shelf location, condition, acquisition source, full history. Print label sheet PDF. Shelf location shown to staff and students.
- **FR-INV-05** `[PA1 §3.7]` **Inventory transactions.** Record a transaction (timestamp, operator/`system`, book, delta, type per DEC-36, reason, reference) for every copy-count or status change. Immutable.
- **FR-INV-06** `[PA1 §3.7]` **Inventory history log.** Quick filters (Batch receipts, Manual additions, Stock reductions, Status changes), search by book/date, drill-down to copy history, links to reference, CSV/PDF/Excel export.
- **FR-INV-07** `[PA1 §3.7]` **Copy status changes.** Change among `available`/`damaged`/`under_repair` (and `found` for `lost`) with mandatory reason; write transaction each time. Cannot set `borrowed`/`held` manually, and cannot set a `held` copy to `lost` directly (release the hold first per POL-13; on-loan losses use FR-CIRC-05). A change to `available` triggers promotion/wishlist.
- **FR-INV-09** `[PA1 §3.7]` **Denormalized counters.** Book carries `total_copies`, `available_copies`, `queue_length`, `wishlist_count`, `borrow_count`, `rating_avg`, `rating_count`, `popularity_score`, maintained by triggers in the same transaction and verified by nightly reconciliation.
- **FR-COND-02** `[PA1 §3.8]` **Create and complete a slip.** Create draft with reason code, notes, multiple copies each with target status (`retired`/`lost`), evidence photos, creator; complete sets copies, writes transactions, releases/blocks per POL-13, never deletes records.
- **FR-COND-03** `[PA1 §3.8]` **Slip rules.** Block completion when a copy is `borrowed`/`held` (message names the copy and fix); require a photo for `damaged_beyond_repair`; completed slips immutable; only drafts cancellable.

### Key Entities

- **Book**: catalog metadata + denormalized counters + embedding.
- **Copy**: book, barcode (unique), status, shelf location, condition, source, held info.
- **InventoryTransaction**: at, actor, book, copy, delta, type, reason, reference (immutable).
- **WriteOffSlip**: number, status, reason, notes, photos, creator, completed at; WriteOffSlipCopy rows.

## Success Criteria

- **SC-001**: Never hard-delete a copy or book (POL-13).
- **SC-002**: Denormalized counters match actual counts after any operation sequence (FR-INV-09, TS-66).
- **SC-003**: Every copy/status change leaves exactly one immutable transaction (FR-INV-05).
- **SC-004**: Write-off slips enforce all POL-13 rules with zero bypass (TS-52).
- **SC-005**: Bulk import is idempotent under re-run (TS-48).

## Assumptions

- ISBN lookup via Google Books, fallback Open Library (DEC-34).
- Two barcode types: ISBN (title) and copy Code 128 label (DEC-35).
- Condition scale `good`/`fair`/`poor`/`damaged`; damage tiers 10/30/100% (DEC-38).

## Test Scenarios

TS-47, TS-48, TS-49, TS-51, TS-52, TS-66.
