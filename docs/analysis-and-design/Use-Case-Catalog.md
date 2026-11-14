# ShelfHelp Use-Case Catalogue

**Status:** Diagram-oriented draft
**Sources:** [ShelfHelp Vision Document](./Vision-Document.md) and [ShelfHelp Full Specification](../../../../src/speckit/specs/SHELFHELP_FULLSPEC.md)
**Purpose:** Provide a concise, goal-level use-case inventory for UML diagrams. Detailed rules and acceptance criteria remain in the source documents.
**Diagrams:** [PA3 use-case diagrams](../management/PA3/use-case-diagrams/Use-Case-Diagrams.md)

## Modeling scope and conventions

- The system boundary is the **ShelfHelp web application and its backend services**.
- A use case represents a goal an actor achieves with ShelfHelp. A feature may map to multiple use cases, and a use case may realize multiple features.
- Background jobs and internal mechanics (for example, fine accrual, reservation promotion, receipt creation, and access-control checks) are not separate diagram use cases.
- Use-case names use an actor goal (verb + object). The summaries are intentionally brief; detailed rules, alternate flows, and acceptance criteria remain in the source requirements.
- **Student** and **Librarian (Admin)** are the primary human actors. Supporting actors are external services that interact with ShelfHelp.
- The `<<include>>` and `<<extend>>` relationships below are candidates for diagrams, not a substitute for validating UML relationships against the final flows.

## Actors

| Actor | Kind | Interaction with ShelfHelp |
|---|---|---|
| Student (Reader) | Primary human actor | Registers, discovers books, manages membership and borrowing, reserves titles, pays charges, submits suggestions and reviews, and uses the research assistant. |
| Librarian (Admin) | Primary human actor | Maintains the catalog and inventory, handles circulation, manages acquisitions and receipts, and reviews operational reports. |
| Authentication and email service | Supporting external actor | Verifies accounts, supports credential recovery, and delivers email notifications. |
| Payment provider / simulator | Supporting external actor | Processes online payment attempts and reports their outcomes. |
| AI provider | Supporting external actor | Supports semantic recommendations and conversational responses. |

The university board, procurement department, and auditors are stakeholders or recipients of exported information; the Vision Document does not describe them as direct interactive actors in the application.

## Student use cases

| ID | Use case | Primary actor | Goal / scope | Source features |
|---|---|---|---|---|
| UC-01 | Register for library access | Student | Create an account with institutional identity details and verify the account. | FEAT-01 |
| UC-02 | Sign in and sign out | Student; Librarian (Admin) | Start or end an authenticated session with access appropriate to the user's role. | FEAT-01 |
| UC-03 | Recover account credentials | Student | Request and complete password recovery using the registered email. | FEAT-01 |
| UC-04 | Manage personal profile | Student; Librarian (Admin) | Update contact details, password, and profile avatar. | FEAT-02 |
| UC-05 | Manage membership | Student | Browse plans, purchase or renew a membership, and see the resulting borrowing privileges. | FEAT-03 |
| UC-06 | Discover and inspect books | Student | Search, filter, sort, and view book details, availability, reviews, and shelf location. | FEAT-04, FEAT-05 |
| UC-07 | Find a book by barcode | Student | Scan a book's ISBN barcode and open its catalog record. This is an alternate entry point to book discovery. | FEAT-06 |
| UC-08 | Manage a book wishlist | Student | Add or remove unavailable titles from a personal availability-notification list. | FEAT-07 |
| UC-09 | Manage borrowing cart | Student | Add available titles, select loan durations, and review cart items and applicable fees. | FEAT-08 |
| UC-10 | Check out books | Student | Submit selected cart items as a borrowing request and obtain the appropriate pickup/payment status. | FEAT-08, FEAT-09 |
| UC-11 | View loans, charges, and payment history | Student | Review current and historical loans, statuses, deadlines, pickup details, charges, and receipts. | FEAT-10; FR-LOAN-10 |
| UC-12 | Renew a loan | Student | Extend an eligible loan's due date within the applicable renewal rules. | FEAT-11 |
| UC-13 | Pay a charge | Student; Librarian (Admin) | Settle a fee or fine online or at the service desk. | FEAT-09, FEAT-13, FEAT-14, FEAT-21, FEAT-24 |
| UC-14 | Reserve an unavailable book | Student | Join the reservation queue for a title that has no available copy. | FEAT-16 |
| UC-15 | Rate and review a returned book | Student | Submit a rating and optional review after returning a book. | FEAT-12 |
| UC-16 | Manage book suggestions | Student | Submit suggestions, review their status and decision history, and withdraw eligible requests. | FEAT-18; FR-SUGG-01, FR-SUGG-02 |
| UC-17 | Get research recommendations | Student | Describe a research topic and receive relevant catalog recommendations with availability and borrowing actions. | FEAT-26 |
| UC-18 | Resolve a lost-book case | Student; Librarian (Admin) | Resolve a lost loan by returning the book or settling the replacement charge, with staff verification where required. | FEAT-14, FEAT-21, FEAT-24 |
| UC-28 | View notifications | Student; Librarian (Admin) | Review notifications, follow relevant links, and manage read status. | FR-NOTIF-01 |

## Librarian use cases

| ID | Use case | Primary actor | Goal / scope | Source features |
|---|---|---|---|---|
| UC-19 | Maintain catalog and copies | Librarian (Admin) | Add or update book records and physical copies, and manage inventory status and location. | FEAT-05, FEAT-22 |
| UC-20 | Hand over requested books | Librarian (Admin) | Locate a pickup request, verify the borrower and copy, record outgoing condition, and confirm the loan. | FEAT-09, FEAT-21, FEAT-22 |
| UC-21 | Process a book return | Librarian (Admin) | Identify the copy, record its returned condition, settle return outcomes, update availability, and complete the return. | FEAT-12, FEAT-13, FEAT-16, FEAT-21, FEAT-22, FEAT-23, FEAT-24 |
| UC-22 | Assess damage and write off copies | Librarian (Admin) | Record damage and applicable fees, or document and retire copies through a formal write-off. | FEAT-22, FEAT-23, FEAT-24 |
| UC-23 | Manage receipts and reversals | Librarian (Admin) | Review financial receipts and process permitted manual receipts, refunds, or corrections through reversal records. | FEAT-09, FEAT-24 |
| UC-24 | Plan book acquisitions | Librarian (Admin) | Review and approve suggestions, organize titles into acquisition batches, and export purchase orders. | FEAT-18, FEAT-19 |
| UC-25 | Receive an acquisition shipment | Librarian (Admin) | Receive shipment lines against a batch, add catalog copies, and notify requesters. | FEAT-20, FEAT-22 |
| UC-26 | Review inventory history | Librarian (Admin) | Inspect recorded copy changes and their operators, timestamps, and references for operational or audit purposes. | FEAT-22 |
| UC-27 | Review analytics and export reports | Librarian (Admin) | Review collection, circulation, revenue, and demand metrics, and export reports. | FEAT-25 |
| UC-29 | Oversee reservation queues | Librarian (Admin) | Review queue order and pickup deadlines, and cancel a reservation with a reason when needed. | FR-RES-05 |
| UC-30 | Review due items and send reminders | Librarian (Admin) | Review loans grouped by due or overdue period and send individual or bulk reminders. | FEAT-15; FR-ANLY-05, FR-NOTIF-04 |
| UC-31 | Manage student accounts | Librarian (Admin) | Find and review student records, apply eligible account-status changes, and restore eligible restricted accounts. | FR-SET-03, FR-AUTH-07, FR-AUTH-08, FR-MEM-07 |
| UC-32 | Configure library policies and membership tier policies | Librarian (Admin) | **Retired (spec v1.3)** — the Settings screen was cut; policies are hardcoded defaults and the two tiers are fixed. | — (was FR-SET-01, FR-MEM-09) |

## Candidate UML relationships

Use these as initial diagram annotations; confirm the relationship semantics while writing full use-case flows.

| Relationship | Candidate interpretation |
|---|---|
| UC-07 `<<extend>>` UC-06 | Scanning an ISBN is an optional way to enter book discovery. |
| UC-09 precedes UC-10 | The student assembles a cart before checking it out. This is a sequence between goals, not necessarily an `<<include>>` relationship. |
| UC-13 `<<extend>>` UC-18 | Paying the replacement charge is one alternative for resolving a lost-book case; returning the book is the other. |

## Feature-to-use-case traceability

| Feature | Use cases |
|---|---|
| FEAT-01 | UC-01, UC-02, UC-03 |
| FEAT-02 | UC-04 |
| FEAT-03 | UC-05 |
| FEAT-04 | UC-06 |
| FEAT-05 | UC-06, UC-19 |
| FEAT-06 | UC-07 |
| FEAT-07 | UC-08 |
| FEAT-08 | UC-09, UC-10 |
| FEAT-09 | UC-10, UC-13, UC-20, UC-23 |
| FEAT-10 | UC-11 |
| FEAT-11 | UC-12 |
| FEAT-12 | UC-15, UC-21 |
| FEAT-13 | UC-13, UC-21 |
| FEAT-14 | UC-13, UC-18, UC-31 |
| FEAT-15 | UC-30 |
| FEAT-16 | UC-14, UC-21, UC-29 |
| FEAT-17 | UC-14, UC-29 |
| FEAT-18 | UC-16, UC-24 |
| FEAT-19 | UC-24 |
| FEAT-20 | UC-25 |
| FEAT-21 | UC-13, UC-18, UC-20, UC-21 |
| FEAT-22 | UC-19, UC-20, UC-21, UC-22, UC-25, UC-26 |
| FEAT-23 | UC-21, UC-22 |
| FEAT-24 | UC-05, UC-13, UC-18, UC-21, UC-22, UC-23 |
| FEAT-25 | UC-27 |
| FEAT-26 | UC-17 |

## Suggested diagram slices

To keep diagrams readable, consider creating separate diagrams with the same system boundary and actor definitions:

1. **Reader services:** UC-01 through UC-18, and UC-28.
2. **Circulation and inventory:** UC-19 through UC-23, UC-26, UC-29, and UC-30.
3. **Acquisition and administration:** UC-24, UC-25, UC-27, and UC-31. (UC-32 is retired in spec v1.3.)
