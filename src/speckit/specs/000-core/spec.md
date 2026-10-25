# ShelfHelp — Shared Core Specification

**Source**: Derived faithfully from `specs/SHELFHELP_FULLSPEC.md` (SRS v1.2, build-ready draft, Supabase platform, reduced scope).

**Version**: 1.2 | **Date**: 2026-10-23

**Status**: Reference (shared context for all feature specs)

---

This document is the shared reference for ShelfHelp. It holds the definitions,
decisions, policies, domain model, non-functional requirements, data model, and
build order that every feature specification depends on. Individual feature specs
live under `specs/0NN-<feature>/spec.md` and cross-reference sections here by ID.

> **Precedence (highest first):** (1) Section 3 Decisions and Section 4 Policies;
> (2) the original proposal PA1; (3) agent judgment, recorded in `docs/DECISIONS.md`.

> **Keywords:** SHALL = mandatory. SHOULD = expected unless there is a recorded
> reason. MAY = optional.

> **ID scheme:** `FR-<GROUP>-<nn>` functional requirement, `POL-<nn>` policy,
> `DEC-<nn>` decision, `NFR-<nn>` non-functional requirement, `TS-<nn>` test
> scenario, `R-<nn>` reader screen, `A-<nn>` admin screen.

---

## 1. Product Overview

### 1.1 Goal
ShelfHelp lets university students discover, borrow, reserve, and pay for library
books online, and lets library staff run the collection, circulation, money,
acquisitions, and reporting. An AI chatbot recommends books the library actually
holds from a plain-language research topic.

### 1.2 Modes
- **Reader Mode** (students), routes under `/`.
- **Admin Mode** (staff), routes under `/admin`.

### 1.3 In scope
Everything in PA1: account and authentication, profile and membership, search and
barcode scan, cart and reservations and simulated payment, loan tracking and fines
and reminders, suggestions and acquisition batches, inventory and circulation,
condition tracking and write-off, receipts, analytics, and the RAG chatbot.

### 1.4 Out of scope
Real payment gateway (an adapter is built, only the simulator is implemented),
procurement and purchasing, integration with the university student information
system, native mobile apps, e-books, inter-library loans, multiple branches, offline
mode, accounting export beyond CSV/PDF/Excel.

### 1.5 Glossary
| Term | Meaning |
|---|---|
| Book | A title-level catalog record (metadata). |
| Copy | One physical item of a Book, with its own barcode, status, and shelf location. |
| Standard / Premium | Collection type of a Book. Standard is free for all. Premium is free for members and fee-based for non-members. |
| Member | Student with an active membership at the current time. |
| Loan Request | Result of one checkout. Groups one or more Loan Items and carries the pickup deadline and payment. |
| Loan Item | One copy lent (or about to be lent) to one student. The unit that has the status shown in My Loans. |
| Reservation | A member's place in the queue for a Book with no available copy. |
| Wishlist | A "notify me when available" subscription. No hold is made. |
| Charge | An amount a student owes (overdue fine, damage fee, loss fee). Unpaid until a Payment settles it. |
| Payment | One attempt or act of paying (online simulated or counter). |
| Receipt | Immutable ledger row created when money moves. |
| Pickup window | Time a held copy waits for the student at the counter (48 h default). |
| Debt hold | Derived block: student has outstanding charges, so new loan requests are blocked. |
| Restricted | Account status set after a loss. Library services are blocked until an admin restores access. |
| Strike | An expired reservation counted against a member. |

---

## 2. Actors, Modes, and Permissions

### 2.1 Roles
| Role | Mode | Description |
|---|---|---|
| `student` | Reader | Registers themselves. Borrows, reserves, pays, suggests, chats. |
| `admin` | Admin | All staff work: catalog, copies, circulation, counter payments, batches, receipts, slips, suggestions, reminders, account lifecycle, restoring access, refunds and receipt reversals, settings. |

There is a single staff role. Staff accounts cannot borrow. A staff member who is
also a student uses a separate student account with a different email. Admin accounts
are created by hand (a seed script using the service role, or the Supabase dashboard).
There is no in-app staff management in the current scope (Section 20 of the SRS).

**Where the role lives:** the Supabase Auth `app_metadata.role` claim is the source
of truth. Row Level Security and Edge Functions read it from the login token.
`profiles.role` is a copy used for lists and display. Both are written together, only
by server code (never by the client), and only in two places: `register-student`
(assigns `student`) and the admin creation script (assigns `admin`). A role change
takes effect when the user's token next refreshes. To cut access immediately, every
Edge Function also loads the caller's `profiles.status`, so a deactivated admin is
refused (`ACCOUNT_NOT_ACTIVE`) even while the old token is still valid. To deactivate
an admin, set `profiles.status` to `inactive` and ban the Auth user. A nightly check
reports any account whose claim and `profiles.role` differ (EC-36).

### 2.2 Routing rules
- After login, `student` goes to `/`, staff go to `/admin`.
- A student opening `/admin/*` sees the 403 page. Staff opening reader routes are redirected to `/admin`.
- Unauthenticated users can open only `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`.

### 2.3 Permission matrix
| Capability | student | admin |
|---|---|---|
| Browse, search, scan, view book detail | Yes | Yes (admin UI) |
| Cart, checkout, renew, reserve, wishlist | Yes (subject to gating 6.1) | No |
| Buy membership | Yes | No |
| Submit and track suggestions | Yes | No |
| Use chatbot | Yes | No |
| Edit own profile, avatar, password | Yes | Yes |
| Add/edit books, copies, bulk import | No | Yes |
| Handover, return, record counter payment | No | Yes |
| Mark loan lost manually | No | Yes |
| Create and complete write-off slips | No | Yes |
| Review suggestions, build batches, receive | No | Yes |
| View receipts, create manual receipts | No | Yes |
| Reverse receipt, refund | No | Yes |
| View dashboard, export reports | No | Yes |
| Send "Remind all" | No | Yes |
| Set student Inactive, restore from Restricted, waive charge | No | Yes |
| Edit settings and plans | No | Yes |

Because there is one staff role, every admin can do every action above, including
money reversals and settings. The two-role design is archived in Section 20 of the SRS.

---

## 3. Decision and Inconsistency Register

Each row is a place where PA1 is inconsistent, ambiguous, or silent. The **Adopted
resolution** is what the build SHALL do. Rows tagged `Confirm` need owner sign-off
but the default is built so work is not blocked.

| ID | Issue found in PA1 | Adopted resolution | Confirm |
|---|---|---|---|
| DEC-01 | PA1 uses "librarian" and "administrator" for staff, and some actions sound privileged. | One staff role, `admin`, covers both. The two-role design is archived. | No |
| DEC-02 | No way to create staff accounts is described. | Admin accounts are created by hand with a script or the Supabase dashboard. No self-registration for staff, no in-app staff management. | Yes |
| DEC-03 | PA1 mentions a whole-degree plan that ends on the expected graduation date. | Removed: no whole-degree plan and no graduation date field. An admin sets the account Inactive when a student leaves. | No |
| DEC-04 | Plans are "for an academic year" but the plan model is not defined. | Plans are fixed-duration (days from start). One plan ships by default (Academic Year, 365 days). Admins can add others. | Yes |
| DEC-05 | Cart lets the student "choose the loan duration" but loan period is fixed per tier. | Student chooses from allowed durations: non-member {7}, member {7, 14} days (settings). Non-member Premium fee is per 7 days. | Yes |
| DEC-06 | Fee on renewal of a Premium book by a non-member is not stated. | Renewal costs another per-book fee, paid before the due date is extended. | Yes |
| DEC-07 | Copy status list has no state for a copy held for pickup. | Added copy status `held`. | No |
| DEC-08 | My Loans statuses mix request and loan states and omit Lost and reservation states. | Loan Item has 9 statuses including `lost`. Reservations have their own 5 statuses. | No |
| DEC-09 | Fines are "charged" but receipts exist only for money moved. Unpaid fines need a home. | Added Charge entity. Receipt is created only when a Payment settles a Charge. | No |
| DEC-10 | Receipt statuses Valid, Voided, Reversed, but receipts "cannot be edited or deleted". | Receipt rows are immutable. Status is derived: Reversed if a reversal receipt links to it; Voided if that reversal has reason code `entry_error`; else Valid. | No |
| DEC-11 | "Simulated payment transaction logged separately as Refunded" implies a Payment distinct from Receipt. | Payment (attempt) and Receipt (ledger) are separate entities. Refund marks Payment `refunded` and creates a reversal Receipt. | No |
| DEC-12 | "Designated for counter payment" has no flow. | Counter option: item stays `awaiting_payment` with a 48 h hold. Staff collects fee at handover and a receipt is created. | Yes |
| DEC-13 | No payment time limit and no definition of Payment Failed. | Online payment window 30 min. A failed attempt moves the item to `payment_failed` and can be retried within the window. Window end sets `expired`. | Yes |
| DEC-14 | The 48 h pickup window start is unclear for paid requests and reservations. | Starts when the item enters `ready_for_pickup` (after payment for paid requests, at promotion for reservations). | Yes |
| DEC-15 | Daily fine rate, grace, and cap are missing. | 2,000 VND per day per book, no grace, capped at the book's replacement price. | Yes |
| DEC-16 | Fines accrue daily and can be paid before return, but the loan stays open until return. | A nightly job keeps one unpaid overdue-fine Charge per overdue item up to date. Paying it while still overdue creates a new Charge next night for further days. Total fines per loan never exceed the replacement price. Final amount fixed at return. | No |
| DEC-17 | Lost recovery says student must "return the book and settle replacement charges", which contradicts itself. | Two paths: (A) return the book: replacement charge is cancelled or refunded, accrued fine stays. (B) pay replacement in full without returning: accrued fine is waived. The system sets `lost_resolved_at` when the loss is settled. Admin verifies by restoring the account (FR-AUTH-08). | Yes |
| DEC-18 | "Inactive", "Restricted", "restricted from new loan requests", and "reservation penalty" are different blocks with similar names. | Account status: `pending_verification`, `active`, `restricted`, `inactive`. Separate derived flags: debt hold and reservation ban. | No |
| DEC-19 | What a Restricted student can still do is unclear. | Can log in and see loans, charges, notifications, profile, and pay charges. Can browse and use chatbot read-only. Cannot add to cart, checkout, reserve, renew, wishlist, suggest, or buy membership. | Yes |
| DEC-20 | Debt hold only blocks "new loan requests". | Also blocks reservations, renewals, and handover until debt is settled. Membership purchase, suggestions, and wishlist stay allowed. | Yes |
| DEC-21 | Admins can mark a copy Lost during audits, but a copy on loan being marked lost is not described. | Marking a copy on loan as Lost triggers the same effects as automatic loss (loan `lost`, student Restricted, replacement charge), after a confirmation dialog. | Yes |
| DEC-22 | "Max books at once" does not say what counts. | Counts Loan Items in `awaiting_payment`, `payment_failed`, `ready_for_pickup`, `borrowed`, `overdue`, plus reservations in `ready_for_pickup`. Waiting reservations and `lost` items do not count. | Yes |
| DEC-23 | After membership expiry the student "cannot borrow beyond the lower non-member limit". | New request allowed only if (current counted items + new items) is at most the non-member limit. | No |
| DEC-24 | Reservation queue is "limited" with no numbers. | Queue length max 5 per book. Max 3 active reservations per member. One active reservation per book per member. | Yes |
| DEC-25 | Strike counting period is not defined. | Rolling 180 days. Strike 1 = warning. Strike 2 within the window = 30-day reservation ban, then strikes reset. | Yes |
| DEC-26 | Promotion rules for ineligible queue members are missing. | Member without active membership, or Restricted or Inactive or in debt hold at promotion time: reservation cancelled with reason, no strike. Member at item limit: skipped but keeps position. | Yes |
| DEC-27 | Wishlist notification rules are missing. | Notify all wishlisters once when a book goes from 0 available copies to at least 1 and no reservation queue exists. Entry stays until removed. Max 50 entries. | Yes |
| DEC-28 | Overdue emails "weekly for up to two weeks", then silence until the 2-month Lost conversion. | Emails at overdue day 7 and 14. Added: final warning email and in-app alert 7 days before the lost threshold. `[+]` | Yes |
| DEC-29 | Email "when the pickup window is close to expiring" has no threshold. | 12 hours before the deadline. | Yes |
| DEC-30 | "Remind all" scope and spam control are missing. | Targets students in the currently filtered due/overdue group. Preview count and confirm. Max one bulk reminder per student per 24 h. | Yes |
| DEC-31 | Suggestion needs "ISBN or link" and "similar requests grouped automatically" with no rules. | Title and author required, at least one of ISBN or link required. Grouping: exact normalized ISBN, else fuzzy title+author similarity at or above 0.85. Admin can merge and split. Max 5 open suggestions per student. | Yes |
| DEC-32 | Approved suggestions are "accepted in the upcoming batch" but the admin also "builds the batch by adding titles". | Approval puts the group in an Approved backlog. The admin adds backlog items (and any other titles) to a Draft batch. Nothing is auto-added. | Yes |
| DEC-33 | Requesters are notified when books arrive and when the batch closes; timing unclear. | Requesters of a title are notified when that title's receipt is saved (idempotent). Closing the batch does not re-notify. | Yes |
| DEC-34 | "Choosing from a library catalog" when adding books is ambiguous. | Means the internal catalog (add copies to an existing title). Metadata autofill uses an external ISBN lookup (Google Books, fallback Open Library). | Yes |
| DEC-35 | "Scan the loaned book's barcode" at return conflicts with ISBN scanning. | Two barcode types: ISBN barcode (title lookup) and copy barcode label (Code 128, unique per copy, used for return and audits). | No |
| DEC-36 | Inventory transaction types differ from filter groupings. | Type enum: `batch_receipt`, `manual_addition` (reason: donation, replacement, purchase_outside_batch, import), `found`, `write_off`, `lost`, `status_change`. | No |
| DEC-37 | Write-off slip can set copies Lost, and Lost is also set automatically. | Slip handles confirmed missing and removal of copies that are not on loan. On-loan copies go through the loan Lost flow. | No |
| DEC-38 | Book condition is recorded but no scale or damage-fee rule exists. | Condition scale: `good`, `fair`, `poor`, `damaged`. Damage fee tiers as percent of replacement price: minor 10, major 30, unusable 100 (or custom amount with reason). | Yes |
| DEC-39 | The AI embedding input mentions "reviewed keywords". | Interpreted as admin-curated keywords on the book record. | Yes |
| DEC-40 | "Receipts cannot be edited or deleted" appears in the analytics section. | Moved to receipt requirements (FR-RCPT-06) and enforced by security rules and functions. | No |
| DEC-41 | Revenue is "computed via receipts" with no mention of reversals. | All revenue metrics are net (signed sum including reversals). | No |
| DEC-42 | Membership purchase while a membership is active, or while Restricted, is not addressed. | Renewal allowed only within 30 days before expiry or after expiry (stacks after current end). Blocked while Restricted. | Yes |
| DEC-43 | Preconditions for Inactive only mention books and debt. | Also requires no open requests and no ready reservations. Side effects: cancel waiting reservations, delete wishlist, end membership with no refund, disable login. | Yes |
| DEC-44 | Search needs relevance sort, fuzzy matching, diacritic-insensitive matching, and filters. | Postgres full-text search plus `pg_trgm` and `unaccent`, exposed through the `search_books` RPC. Availability is read live. | Yes |
| DEC-45 | Scheduled jobs, triggers, and server-side transactions are needed. | Supabase Postgres provides them (`pg_cron`, triggers, ACID transactions) and Edge Functions orchestrate them. No Firebase Blaze plan needed. | Yes |
| DEC-46 | Files need role-based and owner-based access control. | Supabase Storage with policies on `storage.objects` that read the role from the JWT. Private reads use signed URLs requested under the caller's own identity. | Yes |
| DEC-47 | "Day" semantics for due dates and fines are undefined. | Timezone `Asia/Ho_Chi_Minh`. Due at 23:59:59 local on the due date. Fine day = each local calendar day after the due date. | Yes |
| DEC-48 | Rating is allowed only after returning a book; edits and moderation are not described. | One review per student per book (editable). Allowed only if the student has a returned loan of that book. Review moderation is out of scope. | Yes |
| DEC-49 | Cart behavior regarding stock is not stated. | Cart does not hold stock. Stock is validated and held at checkout. | No |
| DEC-50 | Student ID and email are trusted but never verified. | No registrar integration. Email domain allowlist plus email verification. Admin can edit student ID. | Yes |
| DEC-51 | Filters list both "category" and "field". | Two-level taxonomy: `category` (top-level discipline) and `field` (subject within category). | Yes |
| DEC-52 | Renewal is "instant" but renewal for a fee-bearing loan needs payment. | Renewal is instant when free. When a fee is due, the due date extends immediately after payment succeeds. | No |
| DEC-53 | Which membership benefits apply to an existing loan after expiry is unclear. | Existing loans keep due dates. Renewals use current entitlements at the moment of renewal. | No |
| DEC-54 | The team first assumed Firebase Firestore plus Supabase Storage. | Use Supabase for everything: Postgres, Auth, Storage, Edge Functions, `pg_cron`. Supabase Auth because its JWT feeds Row Level Security directly. Firebase Auth remains a fallback only. | Yes |
| DEC-55 | `pg_cron` schedules run in UTC, but all policies are in Vietnam local time (UTC+7, no DST). | Jobs scheduled in UTC with local time in a comment (00:05 local = 17:05 UTC; 08:00 local = 01:00 UTC). Date logic inside jobs uses `Asia/Ho_Chi_Minh`. Jobs process everything due. | No |
| DEC-56 | Vietnamese text is typed with and without diacritics, and users mix both. | Two-tier matching (POL-17): every accent variant is a match, but results that match the typed accents exactly rank first. | No |

---

## 4. Policies

All values below are defaults stored in the `settings` table, key `library`.
`[CONFIRM]` items are in Section 3.

### 4.1 Time, money, language (POL-01)
- Timezone `Asia/Ho_Chi_Minh`. Store timestamps in UTC. Compute "day" in local time.
- Currency VND, integers only, no decimals. Display with thousands separators.
- UI language: English only for now. Text lives in a locale file (i18n structure). Catalog content may be in English or Vietnamese.

### 4.2 Accounts and access (POL-02)
- Registration needs: full name, university email (domain in allowlist), student ID (unique, matches pattern), faculty (from list), phone (optional), password (min 8 chars, at least one letter and one digit), acceptance of terms.
- Email and student ID are unique. Unverified accounts are deleted after 7 days.
- Account status values: `pending_verification`, `active`, `restricted`, `inactive`.
- **Inactive** is set only by an admin and only if: no items in `awaiting_payment`, `payment_failed`, `ready_for_pickup`, `borrowed`, `overdue`, `lost`; no reservation in `ready_for_pickup`; outstanding debt is 0. Effects: waiting reservations cancelled, wishlist cleared, membership ended without refund, Supabase Auth user banned, data retained. Only an admin can reactivate.
- **Restricted** is set automatically when a loan becomes `lost`. It is lifted only by an admin after the checklist in 4.9 passes. The student can press "Request review" to notify admins.

### 4.3 Membership and entitlements (POL-03)
- Plans are prepaid, one-time, non-transferable, renewed manually.
- Defaults: Academic Year plan lasts 365 days from start. Every plan is a fixed number of days. No plan tied to a graduation date.
- Start date is the purchase time, or the day after the current end date when renewing early. Early renewal allowed only within 30 days before expiry, or after expiry.
- Each purchase stores a **snapshot**: plan name, price paid, start, end, and the privileges (max items, loan day options, renewals, can reserve). Later settings changes apply only to new purchases.
- Membership status is computed from dates: `upcoming`, `active`, `expired`, plus `terminated` (admin refund or account inactivation).
- Online purchases are non-refundable. An admin can refund as an exception, which creates a reversal receipt and terminates the membership.
- A reminder email goes out 7 days before expiry, plus an in-app notice.

**Entitlement resolution (FR-MEM-05):** find the membership with start at or before now and end at or after now, not terminated; if found use its snapshot privileges; else use non-member settings.

| | Non-member | Member (default snapshot) |
|---|---|---|
| Standard books | Free | Free |
| Premium books | Fee per book per loan (5,000 VND per 7 days) | Free |
| Max items at once | 3 | 7 |
| Loan day options | 7 | 7 or 14 |
| Renewals per loan | 1 | 2 |
| Reserve unavailable books | No | Yes (48 h hold) |
| Late fine | Yes, same rate | Yes, same rate |

### 4.4 Checkout and loan lifecycle (POL-04)
- The cart does not hold stock. Checkout validates and holds in one transaction: entitlements, item limit, no duplicate active loan of the same book, account gating, debt hold, copy availability.
- Checkout is all-or-nothing. If some lines fail, the response lists each failure, the cart is kept, and the student can remove failed lines and retry.
- One specific copy is chosen per line (lowest copy number among `available`) and set to `held`.
- Free requests (Standard, or Premium for members) go straight to `ready_for_pickup` with a 48 h pickup deadline.
- Paid requests (Premium for non-members): student chooses online or counter payment. Online: `awaiting_payment` with a 30 minute payment deadline. Counter: `awaiting_payment` with a 48 h deadline. Student may switch from online to counter once.
- Cancel is allowed for `awaiting_payment`, `payment_failed`, `ready_for_pickup`. Online-paid cancel or expiry creates a refund (Payment `refunded`, reversal receipt). Held copies are released and the release triggers promotion/wishlist logic.
- Handover requires an admin, the student's pickup code or student ID, an initial condition, debt of 0, account `active`, and a pickup deadline not passed. If the student's membership ended after a free Premium request was made, the per-book fee is collected at the counter before handover.
- Due date = end of day (23:59:59 local) of handover date plus chosen duration.
- Return requires an admin, a returned condition, and calculates fine and damage fee. After return the copy goes to `available` (or `damaged`/`under_repair` per admin), and the promotion/wishlist logic runs.
- A student may not hold two active Loan Items for the same Book.

### 4.5 Premium fees and payment (POL-05)
- Fee per Premium loan for non-members: `premium_fee_per_7_days`, multiplied by (duration / 7).
- Fee is shown in the cart and fixed at checkout (stored on the Loan Item).
- Payment methods: `online` (simulated gateway) and `counter` (staff records it).
- Every payment pays the full amount of each charge, fee, or membership. Partial payments are out of scope.
- One Receipt per paid item or charge. A single Payment covering three charges creates three Receipts that share the `payment_id`.
- The gateway is behind a `PaymentProvider` interface so a real provider can replace the simulator.

### 4.6 Renewal (POL-06)
Renewal is allowed only if: item is `borrowed` (not `overdue`), account `active`, no debt hold, renewals used is below renewals allowed by **current** entitlements, and no waiting reservation exists for that Book. New due date = old due date + loan days of the current entitlement. Premium loans for non-members need a new fee payment first (DEC-06, DEC-52).

### 4.7 Reservations and wishlist (POL-07)
- Only members can reserve, and only when the Book has zero available copies and at least one non-retired, non-lost copy.
- Queue is FIFO by creation time.
- **Promotion trigger:** whenever a copy becomes available (return in good enough condition, batch receipt, manual addition, found, hold released by expiry or cancellation). First eligible member gets the copy: reservation becomes `ready_for_pickup`, copy becomes `held`, 48 h pickup deadline starts, member notified.
- Expiry after 48 h: reservation `expired`, copy released, strike recorded, next member promoted. If queue empty, copy becomes `available` and wishlisters are notified.
- Strike 1: warning notification. Strike 2 within 180 days: `reservation_ban_until = now + 30 days`, strikes reset. A ban blocks only new reservations.
- Member can cancel a waiting or ready reservation at any time with no strike.
- Wishlist: one entry per student per Book, max 50. Wishlist notification fires only when no queue exists (DEC-27).

### 4.8 Fines, lost, and damage (POL-08)
- Overdue days = number of local calendar days after the due date up to and including today.
- Fine = min(overdue days × fine per day, book replacement price). Default 2,000 VND per day, no grace.
- Nightly job (00:05 local) keeps one unpaid `overdue_fine` Charge per overdue item up to date; if the previous was paid it creates a new Charge for additional days. An item may therefore hold several fine Charges over its overdue life. The cap applies to the total of all fine Charges of the loan.
- Each fine Charge stores the overdue days it covers (`days_from`, `days_to`) and the `rate` in force when those days accrued. A `fine_per_day` change starts a new Charge for subsequent days and never reprices days already accrued.
- The final fine of a loan is the sum of `days x rate` over all its overdue days up to the return date, capped at replacement price. At return the system creates a top-up Charge for any missing days (e.g. a missed nightly run) so the sum equals the final fine; it never refunds an automatic payment.
- A paid fine Charge is never changed. The "fine at return" shown to staff is the final fine, with the amount already paid shown next to it.
- **Lost conversion:** at 60 overdue days, job sets Loan Item `lost`, copy `lost`, student `restricted`, freezes the fine, and creates a `loss_fee` Charge equal to replacement price. Final-warning notice goes out 7 days earlier.
- **Lost resolution:** Path A (return book): item `returned`, copy back to `available` (or per condition), unpaid replacement charge waived, paid replacement refunded by reversal receipt if within 90 days of loss. Path B (pay replacement in full): accrued fine is waived. Both paths set `lost_resolved_at`; the account is restored separately by FR-AUTH-08.
- **Damage:** at return, if returned condition is worse than handover condition, admin must choose: no charge (with reason), tier fee, or custom amount (at most replacement price). Result is a `damage_fee` Charge.
- Unpaid damage or loss charges do not keep the loan open. They create debt hold.

### 4.9 Debt hold, restriction, and restoration (POL-09)
- Debt hold = sum of outstanding amounts on the student's charges is above 0.
- Restore checklist (all auto-evaluated, button disabled until all pass): no Loan Item in `lost` with `lost_resolved_at` empty; outstanding debt is 0; no unresolved write-off or dispute flag. Admin confirms and status returns to `active`. Every restore is audit-logged.

### 4.10 Receipts, refunds, ledger (POL-10)
- Receipt number: `RC-<YYYY>-<6 digit sequence>`, allocated inside the payment transaction from the `counters` row `receipt_<YYYY>`, locked with `FOR UPDATE`.
- Receipt types: `membership`, `premium_fee`, `overdue_fine`, `damage_fee`, `loss_fee`, `manual`, `reversal`.
- Amount is signed. Reversal receipts are negative and link to the original through `reverses_receipt_id`.
- A receipt can be reversed once, fully. Partial corrections use a reversal plus a new manual receipt.
- Receipts are never updated or deleted.
- Manual receipts require student, amount, method, type, mandatory reason, optional reference, and are flagged `manual`.

### 4.11 Notifications (POL-11)
See the Notifications feature spec for the full event table (`specs/0NN-notifications/spec.md`).

### 4.12 Suggestions and acquisition (POL-12)
See the Suggestions feature spec (`specs/0NN-suggestions/spec.md`).

### 4.13 Inventory and write-off (POL-13)
See the Inventory feature spec (`specs/0NN-inventory/spec.md`).

### 4.14 Reviews (POL-14)
Rating 1 to 5 required, text optional up to 1,000 characters. One review per student per book, editable. Allowed only after a returned loan of that book. Book rating average counts all reviews.

### 4.15 AI assistant (POL-15)
See the AI Assistant feature spec (`specs/0NN-assistant/spec.md`).

### 4.16 Data retention and privacy (POL-16) `[CONFIRM]`
- Loans, charges, payments, receipts: 7 years. Audit log: 2 years. Suggestions: 2 years. Notifications: 90 days. Chats: 30 days.
- Inactive accounts: personal fields anonymized after 5 years; ledger rows keep a pseudonymous student reference.
- Borrowing history is visible only to the student and to staff with a task need. Staff opening a student detail page is audit-logged.
- Aggregated dashboards contain no personal data.

### 4.17 Settings defaults (`settings` table, key `library`)
| Key | Default |
|---|---|
| `timezone` | `Asia/Ho_Chi_Minh` |
| `email_domain_allowlist` | `["*.edu.vn"]` |
| `student_id_pattern` | `^[A-Za-z0-9]{6,15}$` |
| `unverified_account_ttl_days` | 7 |
| `nonmember.max_items` / `loan_days_options` / `renewals` / `can_reserve` | 3 / [7] / 1 / false |
| `premium_fee_per_7_days` | 5000 |
| `plans[]` | Academic Year (365 days, 150000 VND, member privileges 7 / [7,14] / 2 / true) |
| `plan_renewal_window_days` | 30 |
| `membership_reminder_days` | 7 |
| `fine_per_day` | 2000 |
| `fine_grace_days` | 0 |
| `lost_threshold_days` | 60 |
| `lost_warning_days_before` | 7 |
| `lost_return_refund_window_days` | 90 |
| `default_replacement_price` | 100000 |
| `damage_tiers_percent` | minor 10, major 30, unusable 100 |
| `online_payment_window_min` | 30 |
| `pickup_window_hours` | 48 |
| `pickup_warning_hours` | 12 |
| `due_soon_days` | 2 |
| `overdue_email_days` | [7, 14] |
| `reservation.queue_limit` / `max_active_per_member` | 5 / 3 |
| `reservation.strike_window_days` / `strikes_before_ban` / `ban_days` | 180 / 2 / 30 |
| `wishlist_max` | 50 |
| `suggestion.max_open_per_student` / `similarity_threshold` | 5 / 0.85 |
| `bulk_import_max_rows` | 1000 |
| `export_max_rows` | 20000 |
| `chat.rate_per_hour` / `rate_per_day` / `top_k` / `max_recommendations` | 20 / 100 / 10 / 5 |
| `chat.min_similarity` | tune after evaluation (starting 0.55 cosine) |
| `search.fuzzy_threshold` | 0.3 (`pg_trgm` similarity) |
| `notification_retention_days` | 90 |

### 4.18 Search matching and ranking (POL-17)
See the Catalog & Search feature spec (`specs/002-catalog-search/spec.md`) for the full matching and ranking rules.

### 4.19 Settings timing (POL-18)
A function reads settings once at the start of its transaction (one `settings.version`); a scheduled job reads them once at the start of each run. A change applies to actions that start after it commits; values already written onto a record never change.

| Stored on the record at creation (never changed afterwards) | Read live by later actions |
|---|---|
| Premium fee and duration (loan item), `due_at` | Non-member limits, queue and wishlist limits, suggestion limits |
| `payment_deadline`, `pickup_deadline`, reservation `hold_until` | Pickup and payment window lengths (new items only) |
| Membership snapshot (price, dates, privileges) | Fee for new checkouts; plan list |
| Fine Charge `rate` and days; damage and loss Charge amounts | `fine_per_day` (for days accrued after the change) |
| `reservation_ban_until`; notifications already created | Strike window and threshold (new strikes); chat rate limits |

`lost_threshold_days` is read at each nightly run; lowering it can convert many existing overdue loans in one night, so the settings screen shows a preview count. Renewals use current entitlements (DEC-53).


---

## 5. Domain Model and Lifecycles

### 5.1 Core entities
User, Membership, MembershipPlan, Book, Copy, Review, LoanRequest, LoanItem,
Reservation, WishlistEntry, Charge, Payment, Receipt, Notification, Suggestion,
SuggestionGroup, Batch, BatchLine, BatchExport, InventoryTransaction, WriteOffSlip,
AuditLog, ChatConversation, Settings, StatsDaily. (Attributes in Section 12 of the SRS.)

### 5.2 Loan Item states
| From | Event | To | Actor | Side effects |
|---|---|---|---|---|
| (new) | Checkout, free | `ready_for_pickup` | student | Copy `held`, pickup deadline = now + 48 h |
| (new) | Checkout, paid, online | `awaiting_payment` | student | Copy `held`, payment deadline = now + 30 min |
| (new) | Checkout, paid, counter | `awaiting_payment` | student | Copy `held`, deadline = now + 48 h |
| `awaiting_payment` | Payment succeeds | `ready_for_pickup` | system | Receipt, new pickup deadline |
| `awaiting_payment` | Payment fails | `payment_failed` | system | Failed Payment recorded |
| `payment_failed` | Retry | `awaiting_payment` | student | New Payment, same deadline |
| `awaiting_payment` (counter) | Counter payment recorded | `ready_for_pickup` | staff | Receipt, new pickup deadline |
| `awaiting_payment`, `payment_failed`, `ready_for_pickup` | Deadline passes | `expired` | system | Release copy, refund if paid, promotion logic |
| same three | Cancel | `cancelled` | student | Release copy, refund if paid, promotion logic |
| `ready_for_pickup` | Handover | `borrowed` | staff | Condition out, due date, borrow count +1, copy `borrowed` |
| `borrowed` | Due date passes | `overdue` | system | Notification |
| `borrowed` | Renew | `borrowed` | student | Due date extended, renewals +1 |
| `borrowed`, `overdue` | Return | `returned` | staff | Condition in, fine and damage charge, copy updated, promotion logic |
| `overdue` | Lost threshold | `lost` | system | Copy `lost`, student `restricted`, loss charge |
| `borrowed`, `overdue` | Manual lost | `lost` | staff | Same as above |
| `lost` | Return | `returned` | staff | Resolution path A |

Terminal states: `expired`, `cancelled`, `returned`, and `lost` once `lost_resolved_at` is set. The system sets `lost_resolved_at` when the loss is settled: the book is returned (path A, and the item also moves to `returned`) or the replacement is paid in full (path B, and the item stays `lost`). Settling a loss does not restore the account; that is FR-AUTH-08.

### 5.3 Reservation states
`waiting` → `ready_for_pickup` (promotion) → `fulfilled` (handover) | `expired` (48 h) | `cancelled`. A `waiting` reservation can also go to `cancelled`.
While `ready_for_pickup`, only the Reservation row exists; no Loan Item is created until handover, when the Loan Item is created directly in `borrowed` (`source = reservation`) and the reservation is set `fulfilled`. Ready reservations carry their own pickup code.

### 5.4 Copy states
| From | To | By |
|---|---|---|
| (new) | `available` | batch receipt, manual addition, import |
| `available` | `held` | checkout or promotion |
| `held` | `available` | hold released |
| `held` | `borrowed` | handover |
| `borrowed` | `available`, `damaged`, `under_repair` | return |
| `borrowed` | `lost` | loan lost |
| `available`, `damaged`, `under_repair` | each other | admin status change with reason |
| `available`, `damaged`, `under_repair`, `lost` | `retired` | completed Write-Off Slip |
| `available`, `damaged`, `under_repair` | `lost` | completed Write-Off Slip (confirmed missing), or audit |
| `lost` | `available`, `damaged` | found (inventory type `found`), or return after lost |

`retired` is final.

### 5.5 Other state sets
- **Account:** `pending_verification` → `active` ⇄ `restricted`; `active` → `inactive` → `active` (admin only).
- **Payment:** `created` → `pending` → `succeeded` | `failed` | `cancelled` | `expired`; `succeeded` → `refunded`.
- **Charge:** `unpaid` → `paid`; `unpaid` → `waived` or `cancelled` (admin or system with reason).
- **Suggestion, Batch, Slip:** see POL-12/POL-13. Slip: `draft`, `completed`, `cancelled`. Batch line: `pending`, `partial`, `received`, `not_received`.
- **Membership (derived):** `upcoming`, `active`, `expired`, `terminated`.

---

## 6. Gating Matrix

### 6.1 (Y = allowed, N = blocked)
| Action | Pending verification | Restricted | Debt hold | Reservation ban | Non-member |
|---|---|---|---|---|---|
| Open app features | N (verify screen only) | Y | Y | Y | Y |
| Browse, search, scan | N | Y | Y | Y | Y |
| Chatbot | N | Y (no add to cart) | Y | Y | Y |
| Add to cart and checkout | N | N | N | Y | Y (non-member limits) |
| Reserve | N | N | N | N | N |
| Renew | N | N | N | Y | Y (non-member limits) |
| Wishlist | N | N | Y | Y | Y |
| Buy membership | N | N | Y | Y | n/a |
| Submit suggestion | N | N | Y | Y | Y |
| Pay charges | N | Y | Y | Y | Y |
| Handover (staff) | N | N | N | Y | Y |
| Return (staff) | Y | Y | Y | Y | Y |

Inactive accounts cannot log in. The Non-member column is derived from entitlements (FR-MEM-05), for example `can_reserve = false`; the gating function reads entitlements and must not hard-code a separate non-member rule. The gating decision is made in one shared server
function and mirrored in the UI (UI hides/disables, server enforces).

### 6.2 Global UI components
- Status banner (restricted, debt hold, reservation ban, membership expiring).
- Notification bell with unread count.
- Toasts for success, inline form errors, blocking dialogs for destructive actions.
- Global error boundary, 403, 404, offline banner.

---

## 7. Non-Functional Requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-01 | Performance | Reader initial route: LCP ≤ 2.5 s on mid-range phone over 4G; initial JS ≤ 250 KB gzip; admin code lazy-loaded, never in reader bundle. |
| NFR-02 | Search | `search_books` p95 ≤ 300 ms at DB for 10,000 titles. |
| NFR-03 | Server latency | p95 ≤ 2 s for checkout, handover, return, payment completion, renewal; p95 ≤ 8 s for assistant reply. |
| NFR-04 | Read efficiency | No unbounded Realtime subscriptions or unpaginated queries. Lists paginated. Dashboard RPCs ≤ 1 s p95 at NFR-05 scale. Home ≤ 12 API requests on load. |
| NFR-05 | Scale baseline | 20,000 students, 100,000 copies, 500 concurrent users, 50 checkouts/min at semester start. |
| NFR-06 | Security | Deny-by-default RLS; CAPTCHA on register/login/reset; Zod validation + role/status auth in every Edge Function; no service-role key or DB URL in client; CSP; signed URL TTLs; rate limits on register, resend, chat, payments; dependency scanning; OWASP ASVS Level 2. |
| NFR-07 | Privacy | POL-16. No PII in logs or provider prompts. Staff access to student detail is audit-logged. |
| NFR-08 | Accessibility | WCAG 2.2 AA. Full keyboard, visible focus, 4.5:1 contrast, labels, `aria-live`, 44 px touch targets, reduced motion, camera always has non-camera alternative. |
| NFR-09 | Reliability | Idempotent mutations/jobs, retries with backoff, 99.5% availability, daily backups + PITR, RPO 24 h, RTO 4 h, alerts on job failure and error rate. |
| NFR-10 | Data integrity | Invariants checked by tests and nightly reconciliation (see SRS). |
| NFR-11 | Compatibility | Last two Chrome, Edge, Firefox, Safari; iOS Safari 16+; layouts 360 px to 1920 px. |
| NFR-12 | Internationalization | English-only UI with locale file; locale-aware dates/numbers; diacritic-aware search; Vietnamese-capable PDF font. |
| NFR-13 | Observability | Sentry on web and functions, structured logs with correlation id, `job_runs` visible to admins, alerts on failures. |
| NFR-14 | Maintainability and testing | TS strict, ESLint/Prettier, ≥ 80% line coverage on `domain`/`packages/shared`, pgTAP for constraints/triggers/RLS, local-stack integration tests, Playwright. |
| NFR-15 | Cost control | Spend alerts; monthly cap on LLM/embedding spend with automatic fallback; embeddings recomputed only on content-hash change. |
| NFR-16 | Testability | Injectable clock (`Clock`/`app_now()`), deterministic ID/receipt generators in tests, seed dataset. |

---

## 8. Data Model and Server API (summary)

Full table-by-table detail, constraints, indexes, RLS summary, Edge Functions, RPCs,
and the error contract are in Section 12 of `specs/SHELFHELP_FULLSPEC.md`. Feature
specs reference entities and error reasons by name.

**Error contract (12.5):** Edge Functions return JSON
`{ "error": { "reason", "message", "details" } }` with statuses — 400 `VALIDATION_FAILED`;
401 `UNAUTHENTICATED`; 403 `FORBIDDEN_ROLE`, `ACCOUNT_NOT_ACTIVE`, `ACCOUNT_RESTRICTED`,
`DEBT_HOLD`, `RESERVATION_BAN`, `NOT_MEMBER`; 404 not found; 409 `NOT_AVAILABLE`,
`DUPLICATE_ACTIVE_LOAN`, `QUEUE_FULL`, `WISHLIST_FULL`, `STATUS_CHANGED`, `DUPLICATE`,
`PAYMENT_ALREADY_DONE`; 410 `PAYMENT_EXPIRED`, `DEADLINE_PASSED`; 422 `LIMIT_REACHED`,
`RENEWAL_NOT_ALLOWED`, `PRECONDITION_FAILED`; 429 `RATE_LIMITED`; 500 `INTERNAL`.

---

## 9. Edge Cases (global)

The full edge-case table (EC-01 through EC-36) is in Section 15.2 of
`specs/SHELFHELP_FULLSPEC.md`. Feature specs list the edge cases relevant to them.

---

## 10. Build Order and Definition of Done

| Milestone | Scope (FR groups) | Exit criteria |
|---|---|---|
| M0 Foundations | Repo, CI, Supabase projects, local stack, migration pipeline, shared package, settings loader, clock, i18n, design system, error contract, seed, spec-matrix | CI green; hello-world Edge Function; pgTAP RLS test; Playwright smoke test |
| M1 Accounts | FR-AUTH-01..05, FR-PROF-01..03, FR-SYS-05, FR-GLOB-02 | TS-01..06, TS-41, TS-42, TS-60 |
| M2 Catalog and search | FR-INV-01..04, 07, 09, FR-SRCH-01..05, 07, 08, FR-HOME-01 | TS-08..12, TS-47..49 |
| M3 Membership and money | FR-MEM-01..03, 05, 09, FR-CART-06, FR-RCPT-01, 06, FR-SET-01, FR-SYS-03 | TS-33, TS-34, TS-58 |
| M4 Borrowing and circulation | FR-CART-01..05, 07, 08, FR-CIRC-01..03, 07, FR-COND-01, FR-LOAN-01..03, FR-SYS-02 | TS-14..24, TS-63 |
| M5 Charges, lost, restriction | FR-CIRC-04, 05, FR-LOAN-04..10, FR-AUTH-07, 08, FR-MEM-04, 07, 08, FR-NOTIF-01..03, 05, FR-GLOB-01, FR-SYS-01 | TS-25..32, TS-35, TS-36, TS-61, TS-64, TS-65 |
| M6 Reservations and wishlist | FR-RES-01..05, FR-SRCH-06, FR-NOTIF-04, FR-ANLY-05 | TS-13, TS-37..40, TS-43 |
| M7 Back-office finance and stock | FR-RCPT-02..05, FR-COND-02, 03, FR-INV-05, 06, FR-SET-03 | TS-51..53, TS-59 |
| M8 Suggestions and acquisition | FR-SUGG-01..09 | TS-44..46 |
| M9 Analytics | FR-ANLY-01..04 | TS-54, TS-55, NT-01 |
| M10 Assistant | FR-AI-01..07 | TS-56, TS-57, NT-07 |
| M11 Hardening | NFR-01..16 verification, accessibility pass, load test, security review, backup drill | NT-01..07 green; owner sign-off on `[CONFIRM]` items |

**Definition of done for any task:** (1) the FR's AC passes as an automated test;
(2) its TS scenario passes; (3) loading/empty/error/cancel states exist; (4) strings
are in the locale file; (5) accessibility passes; (6) audit entries and notifications
exist per POL-11 and FR-SYS-03; (7) no setting hardcoded; (8) spec-matrix check passes.

---

## 11. Assumptions, Risks, Open Questions

### Assumptions
| ID | Assumption |
|---|---|
| ASM-01 | One library, one university, one branch, up to 20,000 students. |
| ASM-02 | Payments are simulated; no real money. Counter payments recorded by staff. |
| ASM-03 | Pickup window is wall-clock time (48 h), not counter opening hours. |
| ASM-04 | Student identity relies on university email domain allowlist + email verification, no registrar integration. |
| ASM-05 | Staff use desktop browsers; readers mostly use phones. |
| ASM-06 | Free tiers suffice for pilot; limits must be checked before launch. |
| ASM-07 | LLM and embedding keys with a monthly budget are available. |
| ASM-08 | Book content may be in English or Vietnamese. |
| ASM-09 | Replacement price entered per book; `default_replacement_price` otherwise. |
| ASM-10 | UI English only; strings in locale file for later Vietnamese translation. |

### Risks and open questions
See Section 18.2 and 18.3 of `specs/SHELFHELP_FULLSPEC.md`.

---

## 12. Future Improvements (cut from scope)

Section 20 of the SRS archives the following cut features (do not build now): admin
session timeout, staff management, audit log viewer, archive/restore books, review
moderation, swap/cancel a held copy, pickup QR code, statistics rollup, two staff
roles, partial counter payments, Vietnamese UI language.
