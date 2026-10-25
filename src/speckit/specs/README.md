# ShelfHelp Spec Split — Index

The single build-ready SRS `specs/SHELFHELP_FULLSPEC.md` (v1.2) is split into a
shared core plus per-feature specifications, each in the Spec Kit `spec.md` template
structure. The original SRS remains the authoritative source of truth; these files
are a faithful re-organization of its contents for per-feature planning.

## Naming convention: side letters + tags

A domain split across both sides keeps **one number** and is differentiated by a
letter **and** a side tag:

- `NNNa-<domain>-reader` (suffix `a` + `-reader`) — serves **students** (Reader Mode, routes `/`, screens `R-*`).
- `NNNb-<domain>-admin` (suffix `b` + `-admin`) — serves **staff** (Admin Mode, routes `/admin`, screens `A-*`).

Single-side domains keep just the number with no letter or tag (e.g.
`002-catalog-search`, `007-circulation`).

## Directory

```
specs/
  000-core/                     shared reference (not a single side)
  001a-accounts-reader/         register, verify, login, profile, avatar
  001b-accounts-admin/          set Inactive, restore Restricted
  002-catalog-search/           home, search, browse, detail, scan, wishlist
  003a-membership-reader/       view plans, buy/renew, status, expiry
  003b-membership-admin/        refund/terminate, plan/Premium config
  004-cart-checkout/            cart, checkout, payment, cancel, pickup code
  005a-loans-reader/            my loans, renew, fines/pay, rating, history
  005b-loans-admin/             return, charges, mark lost, condition
  006a-reservations-reader/     reserve, promotion, expiry, cancel, wishlist
  006b-reservations-admin/      queue oversight
  007-circulation/              circulation list, handover, counter payment
  008-inventory/                books, copies, import, write-off
  009-receipts/                 receipt log/detail, manual, reversal
  010a-suggestions-reader/      submit, track suggestions
  010b-suggestions-admin/       grouping, review queue, batches
  011-analytics/                dashboard, reports, due/overdue grouping
  012-assistant/                AI chat recommendations
  013a-notifications-reader/    notification center, scheduled/event delivery
  013b-notifications-admin/     "Remind all" bulk reminders
  014-platform/                 settings, student directory, jobs, audit, files
  SHELFHELP_FULLSPEC.md         original source (unchanged)
```

## How the split maps to the source (by FR group)

| FR group | Reader (a) | Admin (b) | System |
|---|---|---|---|
| FR-AUTH-* | 001a-accounts-reader (01..05) | 001b-accounts-admin (07, 08) | (05 System) |
| FR-PROF-* | 001a-accounts-reader | — | — |
| FR-GLOB-* | 001a-accounts-reader | — | — |
| FR-SRCH-* | 002-catalog-search | — | (08 System) |
| FR-HOME-01 | 002-catalog-search | — | — |
| FR-MEM-* | 003a-membership-reader (01..05, 08) | 003b-membership-admin (07, 09) | (04, 05, 08 System) |
| FR-CART-* | 004-cart-checkout | — | — |
| FR-LOAN-* | 005a-loans-reader | — | (07..09 System) |
| FR-CIRC-* | — | 005b-loans-admin (03/04/05), 007-circulation (01/02/07) | — |
| FR-COND-* | — | 005b-loans-admin (01), 008-inventory (02/03) | — |
| FR-RES-* | 006a-reservations-reader (01, 04) | 006b-reservations-admin (05) | (02, 03 System) |
| FR-INV-* | — | 008-inventory | (09 System) |
| FR-RCPT-* | — | 009-receipts | (01, 06 System) |
| FR-SUGG-* | 010a-suggestions-reader (01, 02) | 010b-suggestions-admin (03..08) | (09 System) |
| FR-ANLY-* | — | 011-analytics | — |
| FR-AI-* | 012-assistant | — | (02..04, 06, 07 System) |
| FR-NOTIF-* | 013a-notifications-reader (01) | 013b-notifications-admin (04) | (02, 03, 05 System) |
| FR-SET-* | — | 014-platform | — |
| FR-SYS-* | — | — | 014-platform |

## Coverage

107 functional requirements are distributed across 20 feature specs (10 reader,
9 admin, 1 admin+system, plus the shared core). The shared core holds the 56
decisions, 18 policies, domain model, gating matrix, NFRs, data model, edge cases,
and build order. Each feature spec lists the test scenarios (TS-*) that cover it,
matching the SRS traceability matrix (Section 17).

## Notes

- IDs are preserved verbatim (FR, DEC, POL, NFR, TS, EC, ASM, RISK) so cross-references
  to the original SRS remain valid.
- Sections 20 (future/cut features) are referenced but not re-specified.
- Full data-model detail (12.1-12.5), architecture (10.x), and the complete edge-case
  and traceability tables remain only in `specs/SHELFHELP_FULLSPEC.md`.
