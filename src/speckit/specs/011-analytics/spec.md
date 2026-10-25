# Feature Specification: Analytics & Reports

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Admin A-02, A-03; FR-ANLY-01..05.

**Created**: 2026-10-23

**Status**: Draft

**Shared context**: `specs/000-core/spec.md` (DEC-41 net revenue).

## User Scenarios & Testing

### User Story 1 - Dashboard KPIs (Priority: P1)

Staff see library state at a glance for a selectable range.

**Why this priority**: The primary admin landing view.

**Independent Test**: Verify KPIs equal direct recount (TS-54).

**Acceptance Scenarios** (FR-ANLY-01):

1. **Given** a fee of 5,000 VND paid and later reversed, **Then** Premium-loan revenue is 0 for that item (net).
2. **Given** no data in range, **Then** zeros show with an empty-state note, not errors.
3. **Given** a day's activity, **Then** the dashboard totals equal a direct recount.

### User Story 2 - Rankings and trends (Priority: P2)

Staff see most/least borrowed titles and category trends.

**Why this priority**: Informs purchasing and weeding decisions.

**Independent Test**: Verify least-borrowed includes zero-loan titles (TS-54).

**Acceptance Scenarios** (FR-ANLY-02):

1. **Given** a title with no loans in range, **Then** it can appear in the least-borrowed list.

### User Story 3 - Demand signals (Priority: P2)

Staff see suggestion groups, reservation queues, and wishlists ranking demand.

**Why this priority**: Data-driven acquisition.

**Independent Test**: Verify demand ranking (TS-54).

**Acceptance Scenarios** (FR-ANLY-03):

1. **Given** a group with 12 requesters, **Then** it ranks above a group with 4.

### User Story 4 - Report export (Priority: P2)

Staff export reports to CSV, PDF, and Excel.

**Why this priority**: Official reporting and procurement.

**Independent Test**: Export identical rows across formats (TS-55).

**Acceptance Scenarios** (FR-ANLY-04):

1. **Given** a filter returning 120 rows, **Then** CSV, PDF, and XLSX each contain 120 rows and correct Vietnamese characters.
2. **Given** 25,000 rows, **Then** export is blocked with an explanation.

### User Story 5 - Due/overdue grouping (Priority: P2)

Staff see loans due or overdue grouped by day or week.

**Why this priority**: Daily operational awareness for reminders.

**Independent Test**: Group loans by day/week (TS-27).

**Acceptance Scenarios** (FR-ANLY-05):

1. **Given** 4 loans due Friday, **Then** the Friday group shows 4.

### Edge Cases

- Revenue net of reversals (DEC-41).
- Export over 20,000 rows refused (settings `export_max_rows`).
- PDF embeds a Vietnamese-capable font (NFR-12).
- Dashboard RPCs use indexes and stay under 1 s p95 (NFR-04).

## Requirements

### Functional Requirements

- **FR-ANLY-01** `[PA1 §3.10]` **Dashboard KPIs.** For a selectable range (today/7 days/30 days/custom): items on loan vs total stock, overdue count, fines collected, membership revenue, Premium-loan revenue, damaged copies, lost copies. On loan = `borrowed` + `overdue`; total stock = copies not `retired`/`lost`; revenue = net signed sums by type (DEC-41). SQL RPCs over indexed tables.
- **FR-ANLY-02** `[PA1 §3.10]` **Rankings and trends.** 10 most and 10 least borrowed titles (least includes zero-loan), monthly loans trend per category.
- **FR-ANLY-03** `[PA1 §3.10]` **Demand signals.** Top suggestion groups, books with queue ≥ 3, top wishlist counts, each linking to the relevant admin screen.
- **FR-ANLY-04** `[PA1 §3.10]` **Report export.** Pick report (loans, overdue, fines, revenue, inventory, suggestions, demand), date/category filters, preview, export to CSV/PDF/Excel. Header with generator/time/filters. Over 20,000 rows refused. PDF embeds Vietnamese font.
- **FR-ANLY-05** `[PA1 §3.5]` **Due and overdue grouping.** Loans due or overdue grouped by day or week (toggle), with counts and expandable student lists.

### Key Entities

- **Receipt** (revenue input, signed sum).
- **LoanItem** (on loan/overdue counts).
- **StatsDaily** (future rollup, deferred — Section 20 of SRS).

## Success Criteria

- **SC-001**: Dashboard KPIs equal a direct recount of raw data (TS-54).
- **SC-002**: Revenue is always net of reversals (DEC-41).
- **SC-003**: Exports are row-identical across CSV/PDF/XLSX with correct Vietnamese text (TS-55).
- **SC-004**: Dashboard RPCs ≤ 1 s p95 at scale (NFR-04).

## Assumptions

- Reports export beyond CSV/PDF/Excel is out of scope.
- Statistics rollup (`stats_daily`) deferred (FR-SYS-04 archived).

## Test Scenarios

TS-54, TS-55, TS-27 (grouping).
