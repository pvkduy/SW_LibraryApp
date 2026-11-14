# ShelfHelp — Admin UI Master Design

**Status:** Screen specification, admin side only
**Audience:** Frontend implementers, AI code-generation agents
**Sibling reference:** Student side is specified visually in [`UI Prototypes - Student/`](./UI%20Prototypes%20-%20Student/). This file covers the librarian/desktop (Admin) experience only.
**Design-token source:** [`shelfhelp-ui-master-design-system.md`](./shelfhelp-ui-master-design-system.md) (Sections 2–3: colors, typography, spacing, elevation, navigation, status badges). This file **does not redefine** tokens — it references them by name.
**Feature/behavior source of truth:** `../../src/speckit/specs/SHELFHELP_FULLSPEC.md` §8 ("Admin Mode: screens, flows, and features"), §4 (policies), and the per-feature spec modules. Every screen below cites its route (`A-xx`) and the functional requirements (`FR-*`) and acceptance criteria it implements.
**PA3 use-case coverage:** [`../management/PA3/UseCase/`](../management/PA3/UseCase/) is cross-referenced in §1 for staff-facing screens and workflows only; student-facing screens are outside this prototype's scope.

---

## 0. How to read this file

- The Admin side is organized into **9 top-level destinations**, not a flat list of 20 screens.
- Each destination is either a **single page** (Dashboard, Reports) or a **tabbed page** (everything else) over one underlying entity.
- **Tabs are view state, not resources.** They map to URL query parameters (`?tab=…`) over a flat route, so the 20 canonical spec routes (`A-01`…`A-20`) remain addressable and traceable.
- **Work happens in panels/drawers, not in extra sidebar items.** Handover, return, damage assessment, manual receipt, reversal, title-editing are all *detail panels inside* a destination.
- Every screen lists: **Route · Tabs · Master list · Detail panel · Actions · Outbound links · Status badges · Empty/error/loading states.**

---

## 1. Information architecture (the sidebar)

The sidebar replaces the four loosely-described groups in `shelfhelp-ui-master-design-system.md` §3.1 with a concrete, spec-anchored map.

```
┌─ ShelfHelp Admin ──────────────────────────────────────┐
│  Dashboard                    ⌂  (A-02)                │
│  Circulation                  ⇄  (A-08)                │
│  Books                        ▤  (A-04)                │
│  Acquisitions                 ⇥  (A-11)                │
│  Queues                       ▦  (A-09 + A-10)         │
│  People                       👤 (A-19)                │
│  Money                        ¤  (A-16)                │
│  Reports                      ▥  (A-03)                │
└─────────────────────────────────────────────────────────┘
```

**Shell (A-01):** sticky left sidebar (250 px, `color-bg-surface`) and a header whose right side holds only a **notification bell** and a **profile block** (avatar + admin ID). There is **no top-level universal search bar** — search and filtering live inside each screen's own list. The **Settings** destination is removed (policy values are hardcoded defaults; the two tiers are the Standard unpaid rank and the yearly Premium membership).

- **Admin entry and session states (UC-02):** prototype the shared sign-in entry, successful route into Admin Mode, access-denied/unavailable-account feedback, session-expired notice, and Sign Out entry in the account menu. Authentication implementation and student sign-in flows are specified elsewhere.
- **Admin profile (UC-04):** the account menu links to `/admin/profile`, a non-sidebar page. Show full name and staff ID as read-only; allow phone and faculty/department edits with inline validation. Include Change Password (current/new/confirm), avatar upload with client-side crop, and camera capture where available. Show field-level failures and save confirmation.
- **Notifications (UC-28):** the bell shows a live unread count and the five newest notifications. "View all" opens `/notifications` in the Admin shell: newest-first, 30 per page, All/Unread filters, unread state, individual and Mark all as read actions, and live badge updates. Notifications **carry no deep links** — they simply announce a feature/event. Provide loading, empty, and recoverable error states.

All admin lists are **server-paginated, 25 per page**, with sort, search, and CSV export of the visible filter set (spec §8 preamble). The Notification Center uses UC-28's 30-item page size.

### Sidebar → screen → spec route map

| Sidebar item | Screen | Route(s) | Spec refs |
|---|---|---|---|
| Dashboard | §2 | `/admin` | A-02; FR-ANLY-01..02 |
| Circulation | §3 | `/admin/circulation` | A-08; FR-CIRC-01..05, FR-CIRC-07, FR-COND-01 |
| Books | §4 | `/admin/books` + `/:id` + `/import` + `/inventory-history` + `/writeoffs` | A-04..07, A-14, A-15; FR-INV-01..07, FR-COND-02,03 |
| Acquisitions | §5 | `/admin/suggestions`, `/admin/batches`, `/admin/batches/:id` | A-11..13; FR-SUGG-03..05, FR-SUGG-07..08 |
| Queues | §6 | `/admin/reservations`, `/admin/reminders` | A-09, A-10; FR-RES-05, FR-ANLY-05, FR-NOTIF-04 |
| People | §7 | `/admin/students`, `/admin/students/:uid` | A-19; FR-SET-03, FR-AUTH-07, FR-MEM-07 |
| Money | §8 | `/admin/receipts`, `/admin/receipts/:id`, `/admin/receipts/new` | A-16..18; FR-RCPT-02..05 |
| Reports | §9 | `/admin/reports` | A-03; FR-ANLY-04 |

### PA3 admin use-case coverage

These are the 18 PA3 use cases that name a Librarian (Admin) as a primary actor, plus UC-05's staff-operated counter purchase/renewal flow. Coverage here is limited to the librarian-facing screens and interactions.

| PA3 use case | Admin workflow covered |
|---|---|
| UC-02 — Sign in and sign out | Admin access and session states in the shell below |
| UC-04 — Manage personal profile | Admin profile and password/avatar actions in the account menu below |
| UC-05 — Manage membership | Librarian-assisted counter purchase/renewal from Student detail |
| UC-13 — Pay a charge | Counter payment in Circulation; receipt and debt status in Money |
| UC-18 — Resolve a lost-book case | Lost-copy resolution in Books › Copies (status change); reversal in Money; account restoration in People |
| UC-19 — Maintain catalog and copies | Books |
| UC-20 — Hand over requested books | Circulation › Handover |
| UC-21 — Process a book return | Circulation › Return |
| UC-22 — Assess damage and write off copies | Circulation condition assessment; Books › Write-offs and History |
| UC-23 — Manage receipts and reversals | Money |
| UC-24 — Plan book acquisitions | Acquisitions › Suggestions and Batches |
| UC-25 — Receive an acquisition shipment | Acquisitions › Batch detail and receive |
| UC-26 — Review inventory history | Books › History |
| UC-27 — Review analytics and export reports | Dashboard and Reports |
| UC-28 — View notifications | Header bell and Notification Center below |
| UC-29 — Oversee reservation queues | Queues › Reservation backlog |
| UC-30 — Review due items and send reminders | Queues › Due & overdue reminders |
| UC-31 — Manage student accounts | People |
| UC-32 — Configure library policies and membership tier policies | **Retired (spec v1.3)** — Settings removed; policies hardcoded |

### Cross-link matrix (outbound deep links)

Each "signal card" and each row action lands on a **filtered view elsewhere** via query params. This is the connective tissue the previous flat design lacked.

| From | Deep-link target |
|---|---|
| Dashboard · top suggestion group | `/admin/suggestions?group=<id>` |
| Dashboard · "queue ≥ 3" book | `/admin/reservations?book=<id>` |
| Dashboard · "top wishlist" title | `/admin/books?tab=catalog&q=<title>` |
| Dashboard · any KPI | `/admin/reports?report=<type>&range=<r>` |
| Circulation row (student) | `/admin/students/<uid>` |
| Circulation handover → counter payment → receipt | `/admin/receipts/<id>` |
| Circulation return → condition/damage | (same panel; charge → `/admin/receipts/<id>`) |
| Books · catalog row | `/admin/books/<id>` (title drawer) |
| Books · inventory-history row | `/admin/batches/<id>`, copy history |
| Books · write-off slip | `/admin/inventory-history?slip=<id>` |
| Acquisitions · suggestion approve | `/admin/batches?add=<title>` |
| Acquisitions · batch line receive | `/admin/books?tab=copies&batch=<id>` |
| Queues · reservation cancel | (dialog) |
| People · student loan | `/admin/circulation?student=<uid>` |
| People · charge/receipt | `/admin/receipts/<id>` |
| Money · receipt reference link | originating loan / charge / slip / batch |
| Notification Center · actionable notification | target admin screen with relevant record/filter focused |

---

## 2. Dashboard — `/admin` (A-02)

**Kind:** single page, no tabs. **Purpose:** state of the library at a glance, for a selectable range.

### Range selector
Persistent segmented control: **Today / 7 days / 30 days / Custom**. The chosen range carries into Reports (`?range=`).

### KPI strip
Eight metric cards (FR-ANLY-01): on loan vs total stock · overdue count · damaged copies · Premium-loan revenue · fines collected · lost copies · membership revenue · active reservations. Each card shows the value for the range. **Empty-state rule:** no data in range → zero + "No activity in this range", never an error.

### Chart and top titles
- Top 10 borrowed titles (FR-ANLY-02).
- Monthly loans trend per category (line/bar).

There are **no least-borrowed rankings and no demand-signal cards**.

**States:** loading = skeleton cards; a failed KPI query shows that card's Retry while others still render (mirrors reader `FR-HOME-01` isolation).

---

## 3. Circulation — `/admin/circulation` (A-08)

**Kind:** master–detail, one entity. **Purpose:** the counter — line up pending work and process each transaction in place. This collapses the three phantom screens (`SCR-A01`, `SCR-A02`, `SCR-A03`) from the old design into one page.

### Tabs = status filters over the Loan Item table
FR-CIRC-01 specifies the buckets. All tabs are **one** server-side query filtered by `status`, addressable as `?status=`.

| Tab | Underlying status(es) | Meaning |
|---|---|---|
| Ready for pickup | `ready_for_pickup` (Loan Items + Reservations) | someone is coming for a book |
| Awaiting payment | `awaiting_payment`, `payment_failed` | fee owed before release |
| On loan | `borrowed` | in the patron's hands |
| Overdue | `overdue` | past due, accruing fine |
| Lost | `lost` (unresolved) | needs resolution |
| History | `returned`, `expired`, `cancelled`, resolved `lost`, finished reservations | read-only |
| Counter payments | all open charges (any patron) | settle a charge in place |

→ **Recommendation:** render these as a **status chip row** over one table (not six literal tab panels). History is a chip too. Deep-linkable, one component, no tab-state duplication.

> **Important union rule (spec §4.7):** while a reservation is `ready_for_pickup`, **only the Reservation row exists — no Loan Item yet.** The **Ready for pickup** tab must therefore union `ready_for_pickup` Loan Items **and** `ready_for_pickup` Reservations. To a desk worker they are identical work and must appear in the same list.

### Master list columns
Borrower name · student ID · book title · copy barcode · relevant date (pickup deadline / due date / borrow date) · charge/fine · status badge. Global **search**: student ID / name / copy barcode / pickup code, filtered across all tabs (FR-CIRC-01).

### Detail panels (the actual work)

Selecting a row fills the right-side inspection panel. Each panel is a "workspace", not a route.

| Panel | Triggered from | Contents | Completing it |
|---|---|---|---|
| **Handover** (FR-CIRC-02, FR-CIRC-07, FR-COND-01) | Ready for pickup | Student standing (status, debt, membership) · checklist against physical copies · **scan copy barcode per item** · record **condition out** (good/fair/poor/damaged + optional note + ≤3 photos) · collect counter fee if membership lapsed (§4.4) · Confirm | Item → `borrowed`, copy → `borrowed`, due date set. On double-click, exactly one handover (idempotency). |
| **Counter payment** (UC-13, FR-CIRC-07) | Counter payments tab / student detail | A single settle panel: optional note, input **amount collected**, the panel **auto-shows the change**, and a **Confirm settlement** button closes the charge (`paid`) and auto-produces the receipt. | Charge closed, one receipt produced, debt hold cleared if nothing else owed. No grouping/auditing multi-step flow. |
| **Return** (FR-CIRC-03,04, FR-COND-01) | On loan / Overdue | Borrower · due date · overdue days · accrued fine · condition **out** → require condition **in** · next copy status · charges computed (fine + damage decision) · collect-now or leave-unpaid · Confirm | Item → `returned`, copy → `available`/`damaged`/`under_repair`/`held`, charges finalized, promotion + wishlist logic runs, invite student to rate. |
| **Mark lost manually** (UC-22, FR-CIRC-05) | On loan (manual trigger) | Confirmation dialog stating consequences (loan/copy `lost`, student `restricted`, replacement charge, overdue fine frozen) + required reason | Converts loan to `lost`; notify student. |

### Disabled-reason text (must be surfaced, not silent)
- Handover Confirm disabled when: account not `active`; debt > 0 ("Settle outstanding charges first"); pickup deadline passed; no condition recorded.
- Return requires a condition **in** before Confirm.
- Scanning a copy not on loan → "Not on loan". A `lost` copy is resolved in the Books → Copies pane (FR-INV-07), not here.

**Outbound links:** student → People · receipt → Money · copy history → Books › History.

---

## 4. Books — `/admin/books` (A-04..07, A-14, A-15)

**Kind:** one entity (the catalog) with five sub-views. **Purpose:** inventory management — metadata, physical copies, how they entered, and how they leave.

### Tabs

| Tab | Content | Leads to |
|---|---|---|
| **Catalog** (A-04) | Title grid: title/author, ISBN, call number, collection (Standard/Premium), available/total, shelf. Search + multi-attribute filters. Bulk "Set collection". CSV export. | Title drawer (`/admin/books/:id`) |
| **Copies** (A-07) | Flat cross-title copy table: barcode, title, status, shelf, condition, source. **This is the single copy-edit surface:** clicking a row opens a detail pane to change status (`available`/`damaged`/`under_repair`/`found`) with a **mandatory reason** (FR-INV-07). There is no separate resolve-lost flow — a `lost` copy is resolved here. Print label-sheet PDF for selected copies. | Copy history → History |
| **Import** (A-06) | CSV template download · upload (≤2 MB, ≤1,000 rows). The system previews **only the erroneous rows** with per-row reasons; valid rows are ingested in the background. | → Catalog (grown) |
| **History** (A-14) | Immutable inventory transactions. Quick filters: Batch receipts · Manual additions · Stock reductions (incl. auto-flagged) · Status changes. Search by book, date range. | → batch detail · copy history · write-off slip |
| **Write-offs** (A-15, UC-22) | Slip list + new slip (reason code, eligible copies w/ target `retired`/`lost`). Drafts can be saved, edited, and cancelled; completion is immutable. **A slip is the only way to retire a copy.** Block `borrowed`/`held` copies with the conflicting loan/hold identified. | → History (transactions) |

### Title drawer (`/admin/books/:id`)
Overlay, deep-linkable. Metadata form (title, authors, publisher, year, language, category, field, description, ToC, keywords, collection, replacement price, default shelf, cover upload) — FR-INV-03. Three add modes (FR-INV-01): pick existing title & add copies · ISBN autofill via `lookupIsbn` (Google Books → Open Library) · manual entry. Duplicate ISBN offers "Add copies to existing book". Collection change applies to **new checkouts only** (existing loans keep stored fee).

**Badge note:** copy-condition badges must use the real copy states — `available`, `held`, `borrowed`, `damaged`, `under_repair`, `retired`, `lost` (spec §4.7), not the loose "Maintenance/Damaged/Written-Off" labels in the old taxonomy table.

---

## 5. Acquisitions — `/admin/suggestions` · `/admin/batches` · `/admin/batches/:id` (A-11..13)

**Kind:** a three-stage pipeline as tabs. **Purpose:** turn student demand into stock, end to end.

| Tab | Content | Leads to |
|---|---|---|
| **Suggestions** (A-11) | Groups of student suggestions; the view shows the patron justifications. Each suggestion has a **rejection justification** box + **Reject** button, and a **target batch selector** (a quantity stepper) + **Add to batch** button. No pricing, no provider lookup, no approval backlog. | → Batches (add line) |
| **Batches** (A-12) | Hand-created named entry list + create (editable name + expected fulfillment date). Each title is added directly from student suggestions with a set quantity. Kept as `draft` until marked `ordered`. | → Batch detail |
| **Batch detail** (`/admin/batches/:id`, A-13) | Table–detail panel: each row lists a title and its expected quantity with a delivered state. Mark a title received (with optional staging location + discrepancy note); the activity history records who marked which title received. The batch closes automatically when all rows are received. No export-version screen (the generic `batch export` button covers tabular views). | → Books › Copies (new copies) |

**Spec note:** a "batch" is now a tracking checklist (`Batch`, `BatchLine`, `batch_activity`) — no provider, price, partial-shipment, or export-version records. There is no separate receiving-backlog screen.

---

## 6. Queues — `/admin/reservations` · `/admin/reminders` (A-09, A-10)

**Kind:** read-mostly oversight. **Purpose:** things you monitor and nudge, not things you transact.

### Tab A — Reservation backlog (A-09, FR-RES-05)
Books with `waiting` or `ready` reservations: queue order, ready holds with deadlines, each student's strikes and `reservation_ban_until`. Staff may **cancel a reservation with a reason** (no strike, student notified). **Staff cannot reorder the queue** — no drag-and-drop (this overturns the old design's "drag-and-drop priority" claim).

### Tab B — Due & overdue reminders (A-10, FR-ANLY-05, FR-NOTIF-04)
Loans due/overdue grouped by **day or week** (toggle), counts + expandable student lists. **"Remind all"**: confirmation states the recipient count **excluding students bulk-reminded in the last 24 h**; on confirm, sends and shows sent/skipped. Individual **Remind** per student. Bulk throttle = one per student per 24 h.

---

## 7. People — `/admin/students` · `/admin/students/:uid` (A-19)

### Directory (FR-SET-03)
Student grid: name, ID, department, membership tier, status (Active / Restricted). Master table–detail panel; filters: status, membership. CSV export.

### Student detail (`/admin/students/:uid`)
**Opening this page is audit-logged** (`view_student`, FR-SET-03). The detail panel shows: profile · current status · membership · and a **simplified history** (only tier changes, account status, strikes, and timestamps — nothing else). There are no summary figures and **no dedicated receipts tab** (all receipts are on the Money screen).

**Four actions:**
- **Set Inactive** (FR-AUTH-07) — sets `inactive` only when the POL-02 checklist passes (each failing condition shown with a link).
- **Restore** (FR-AUTH-08) — restores `restricted` → `active` only when the §4.9 restore checklist auto-passes, with a verification note.
- **Membership refund / termination** (FR-MEM-07) — via reversal receipt; reverts to non-member entitlements immediately, existing loans keep due dates, **no transfer option**.
- **Register / renew membership** (FR-MEM-10) — counter purchase/renewal: select plan, show eligibility and effective start/end dates, collect exact counter payment, issue a receipt.


---

## 8. Money — `/admin/receipts` · `/:id` · `/new` (A-16..18)

**Kind:** the ledger of record for every monetary event. **Purpose:** reconcile, inspect, reverse.

| Tab | Content |
|---|---|
| **Receipts** (A-16, FR-RCPT-02) | Log: number, date, student, type, method, amount, status. Filters: date range, student, type, method, status. Search by number. Export. |
| **Receipt detail** (`/:id`, A-17, FR-RCPT-03) | Number, student, amount, method, type, status, creator (student/admin/system), timestamp, **reference link**, **reversal link**, printable view. |
| **Manual** (`/new`, A-18, FR-RCPT-04) | Student, amount, method, type, **mandatory reason**, optional loan/slip reference → flagged "manual". |
| **Reversals** (FR-RCPT-05) | Filtered log (status Reversed) + reversal action: full reversal with reason code (`entry_error`, `refund_exception`, `lost_returned`, `cancellation`). **One reversal max** per receipt. |

Receipt types: `membership`, `premium_fee`, `overdue_fine`, `damage_fee`, `loss_fee`, `manual`, `reversal`. Receipts are **immutable**; status is **derived** — `Reversed` if a reversal links to it, `Voided` if that reversal is `entry_error`, else `Valid` (DEC-10).

**Seam to Circulation:** a counter payment completes by printing a receipt that is then discoverable here.

---

## 9. Reports — `/admin/reports` (A-03, FR-ANLY-04)

**Kind:** leaf page, simplified. Exactly **three preset report modules — Circulation, Fines & Revenues, Inventory** — selectable, with the only customizable option being a **date range**. There is **no table preview and no other filters**. Export to CSV/PDF/XLSX. **Exports > 20,000 rows are refused** with "narrow your date range". PDFs embed a Vietnamese-supporting font.

*Option:* fold Reports into Dashboard as a second tab if sidebar width is a concern — it has no row-level detail and no deep-link target, so it's the cheapest merge.

---

## 10. Settings — removed

**Cut from scope (v1.3).** The Settings screen (formerly A-20) is removed. All policy values are **hardcoded defaults** (per spec §4.17); the two membership tiers are the Standard (unpaid) rank and the yearly Premium membership with their default perks. There is no policy editor, no membership-tier editor, and no Premium-titles bulk-tab in Settings (bulk "Set collection" remains in Books › Catalog). See spec §20.12.

---

## 11. Deleted / replaced screens (migration from the old document)

These screens in `shelfhelp-ui-master-design-system.md` §5 have **no route in the spec** and are superseded. Do not re-implement them as top-level items.

| Old screen | Resolution |
|---|---|
| SCR-A01 Master Circulation Desk Dashboard | Replaced by **Circulation** (A-08). "A-01" in the spec is the *shell only*, no feature content. |
| SCR-A02 Return Processing & Damage Assessment | A **Return panel** inside Circulation (FR-CIRC-03/04, FR-COND-01). |
| SCR-A03 Lost Book Case Resolution | **Removed as a dedicated flow.** Lost copy resolution happens in Books › Copies (FR-INV-07 status change with reason). Account restore in People. |
| SCR-A04 Catalog & Physical Copy Maintenance | Split: Books › Catalog + Title drawer (A-04/05) + Copies (A-07). |
| SCR-A05 Receipts, Payments, and Reversals Ledger | Split into Money › Receipts / Detail / Manual / Reversals (A-16..18). |
| SCR-A06 Acquisition Planning & Suggestion Review | Split: Acquisitions › Suggestions (A-11) + Batches (A-12). |
| SCR-A07 Shipment Receiving & Barcode Intake | Acquisitions › Batch detail › Receive (A-13). |
| SCR-A08 Inventory Log & Audit Trail | Books › History (A-14). |
| SCR-A09 Analytics Dashboard & Report Generator | Split: Dashboard (A-02) + Reports (A-03). |
| SCR-A10 Reservation Queue Supervision | Queues › Reservation backlog (A-09). |
| SCR-A11 Overdue Management & Reminder Dispatch | Queues › Due & overdue (A-10). |
| SCR-A12 Student & Patron Account Administration | People (A-19). |
| SCR-A13 Policy Configuration & Membership Tier Editor | **Cut from scope** (Settings removed, v1.3). Policy values are hardcoded defaults (spec §20.12). |
| SCR-A14 Admin Notification & System Alert Inbox | Header bell dropdown (notifications), internal alerts surface on Dashboard. |
| SCR-A15 Bulk Export & Data Exchange Center | Export buttons on Reports / Books / Money / History. **No separate screen.** |
| SCR-A16 Admin Staff Authorization & Session Management | **Cut from scope** (spec §20.1–20.3: staff invites, audit viewer, session timeout are "do not build"). |

---

## 12. Implementation rules for AI agents (admin-specific)

1. **Viewport:** desktop landscape `1920 × 1080` reference. Admin code is **lazy-loaded and never in the reader bundle** (NFR-01). Include `@media (max-width: 768px)` graceful degradation only where a screen actually needs mobile reachability (desk/floor checks); do not invent tablet-specific layouts beyond the spec.
2. **Tokens:** reference `color-*`, `radius-*`, `space-*`, `shadow-*`, `color-status-*` from `shelfhelp-ui-master-design-system.md` §2 only. No arbitrary hex.
3. **Badges:** render status via the real entity state enums (Loan Item 9 statuses, copy states, receipt derived status, suggestion/batch states), not the loose labels in the old taxonomy table.
4. **Lists:** server-paginated, 25/page, sortable, searchable, CSV export of the visible filter.
5. **Panels not routes:** handover, return, damage, manual receipt, reversal, title edit are detail panels, never new sidebar entries.
6. **Every destructive action** has a confirm dialog; every gated action shows its **disabled reason** (not silent).
7. **Empty / loading / error:** skeletons (never a blank page), inline Retry on failed panels with the rest still rendering, empty state = explanation + next action.
8. **Traceability:** every screen cites its `A-xx` route and the `FR-*`/`AC` it satisfies, matching `SHELFHELP_FULLSPEC.md` §8.

---
