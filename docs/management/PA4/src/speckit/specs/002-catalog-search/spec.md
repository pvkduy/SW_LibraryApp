# Feature Specification: Catalog & Search

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Reader screens R-05..R-09; FR-SRCH-01..08; FR-HOME-01.

**Created**: 2026-10-23

**Status**: Draft

**Shared context**: `specs/000-core/spec.md` (POL-17 search matching, POL-14 reviews, glossary §1.5).

## User Scenarios & Testing

### User Story 1 - Home dashboard (Priority: P1)

A student opens one place showing what needs attention and what is new.

**Why this priority**: The landing view anchors the reader experience.

**Independent Test**: Render home with mixed data and a failing section (TS-07).

**Acceptance Scenarios** (R-05):

1. **Given** a student with 2 pickups ready, **Then** 2 cards show with countdowns.
2. **Given** the Top books query fails, **Then** other sections still render and that section shows a retry link.

### User Story 2 - Search (Priority: P1)

A student finds a book by title, author, ISBN, or keyword and narrows results.

**Why this priority**: Discovery is the primary reader value; diacritic-correct Vietnamese matching is core.

**Independent Test**: Search the `hóa`/`hoa`/`họa` seed set (TS-08).

**Acceptance Scenarios** (R-06, FR-SRCH-01):

1. **Given** books A "Hóa học", B "Họa tiết", C "Hoa văn": query `hóa` returns A first, then B and C; query `hoa` returns C first, then A and B; query `họa` returns B first, then A and C.
2. **Given** query `hoá` (other tone placement), **Then** A still ranks first.
3. **Given** `HÓA` or NFD input, **Then** results equal those for `hóa`.
4. **Given** a 13-digit ISBN with hyphens, **Then** that book is first.
5. **Given** a one-letter typo in a title word, **Then** the book still appears.

### User Story 3 - Filters and sorting (Priority: P2)

A student refines results by category, field, year, language, collection, and sorts them.

**Why this priority**: Helps narrow large result sets.

**Independent Test**: Apply combined filters and each sort (TS-09).

**Acceptance Scenarios** (FR-SRCH-02, FR-SRCH-03):

1. **Given** category Computer Science and collection Premium, **Then** every result matches both.
2. **Given** sort by rating, **Then** average rating is non-increasing down the list.
3. **Given** page 2, **Then** no result from page 1 repeats.

### User Story 4 - Barcode scan (Priority: P2)

A student scans an ISBN barcode on a shelf to open the book instantly.

**Why this priority**: Fast mobile access to physical books.

**Independent Test**: Scan a known and unknown ISBN (TS-11).

**Acceptance Scenarios** (R-07):

1. **Given** a known ISBN, **Then** its detail page opens within 2 s of a clear read.
2. **Given** permission denied, **Then** manual entry is shown and works.
3. **Given** modal closed, **Then** the camera indicator turns off.

### User Story 5 - Book detail and wishlist (Priority: P1)

A student sees full details and the correct action for a book.

**Why this priority**: The decision point for every available action; must show live state.

**Independent Test**: View detail with live availability and toggle wishlist (TS-12, TS-13).

**Acceptance Scenarios** (R-09):

1. **Given** available copies drop to 0 while open, **Then** Add to cart is replaced by Reserve or Notify me without reload.
2. **Given** a student at item limit, **Then** Add to cart is disabled with reason "You have reached your limit of N items".
3. **Given** a wishlisted book whose copy is returned with no queue, **Then** one in-app and one email notification are created; a job retry creates none.
4. **Given** the 51st wishlist entry, **Then** a clear limit message shows.

### Edge Cases

- Empty result → "No books match", chips to remove filters, links to assistant and suggestion form.
- Failed search → "Search is temporarily limited" notice with Retry; exact-ISBN lookup still works.
- Draft book → 404 to students (RLS excludes it).
- No new books in 90 days → "Nothing new yet" with link to Top books.
- ISBN with checksum error → rejected by scanner validation.

## Requirements

### Functional Requirements

- **FR-HOME-01** `[+]` **Home dashboard.** SHALL show: status banners, up to 4 Ready-for-pickup cards with countdown, up to 4 Due-soon/overdue cards, membership badge with expiry, New arrivals row, Top books row, search bar with scan button, assistant entry. Each section loads independently.
- **FR-SRCH-01** `[PA1 §3.3]` **Keyword search.** Search title, author, ISBN (10 or 13 digits, hyphens ignored), and keywords per POL-17: case-insensitive, every accent variant matches, accent-exact ranks first, typo tolerance, debounced 250 ms, query in URL, exact ISBN first.
- **FR-SRCH-02** `[PA1 §3.3]` **Filters.** Filter by category, field (depends on category), publication year range, language, collection type, plus "Available now" `[+]`. Active filters appear as removable chips with Clear all.
- **FR-SRCH-03** `[PA1 §3.3]` **Sorting.** Sort by relevance (default with query), recency, rating (ties by count), popularity (loans in 90 days). Paginated, 20 per page.
- **FR-SRCH-04** `[PA1 §3.3]` **Browse views.** New arrivals (first copy received in 90 days, newest first) and Top books (by popularity) as a paginated grid (24 per page).
- **FR-SRCH-05** `[PA1 §3.3]` **Book detail.** Show cover, title, authors, ISBN, publisher, year, language, category/field, description, TOC, collection badge with non-member fee, live availability, shelf location, rating average/distribution, paginated reviews. Show exactly the allowed action (Add to cart, Reserve, Notify me) or a plain-language reason when blocked. Availability updates in real time. Draft books return 404.
- **FR-SRCH-06** `[PA1 §3.3]` **Wishlist.** Toggle "Notify me when available" on an unavailable book (max 50), list entries, notify per POL-07 when available with no queue.
- **FR-SRCH-07** `[PA1 §3.3]` **ISBN barcode scan.** Open camera (permission only on tap), decode EAN-13 ISBN (978/979 prefix), validate checksum, open detail. Unknown ISBN shows "Not in the catalog" with suggestion form prefilled. Permission denied / no camera / not HTTPS → manual ISBN field. Camera stops on close/navigation.
- **FR-SRCH-08** `[PA1 §3.3]` **Search freshness.** `books.search_vector` is a generated column; a created/edited book is searchable as soon as its transaction commits. Draft books excluded by RLS.

### Key Entities

- **Book**: title, authors, ISBN (10/13), publisher, year, language, category, field, description, TOC, keywords, collection, replacement price, shelf location, cover, status (active/draft), denormalized counters (total/available copies, queue length, wishlist count, borrow count, rating avg/count, popularity).
- **Review**: rating (1-5), text, per-student-per-book, editable (POL-14).

## Success Criteria

- **SC-001**: Search returns diacritically correct results per POL-17 for `hóa`/`hoa`/`họa` (TS-08).
- **SC-002**: New/edited books are searchable immediately; drafts never appear to students (FR-SRCH-08, TS-08).
- **SC-003**: `search_books` p95 ≤ 300 ms at 10,000 titles (NFR-02).
- **SC-004**: Every blocking state shows a plain-language reason, not a dead button (FR-SRCH-05).
- **SC-005**: Known ISBN opens detail within 2 s (FR-SRCH-07).

## Assumptions

- Catalog content may be English or Vietnamese (ASM-08).
- Availability is read live; counters are denormalized and reconciled nightly (FR-INV-09).
- Review moderation is out of scope (DEC-48).

## Test Scenarios

TS-07, TS-08, TS-09, TS-10, TS-11, TS-12, TS-13.
