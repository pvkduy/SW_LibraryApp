# Team HCD (Group 7) - VNUHCM University of Science

# ShelfHelp: Smart Library Management System

## Use-Case Diagrams: PA3

**Date:** 13/Nov/2026
**Performed by:** Lê Văn Vĩ | **Reviewed by:** Nguyễn Anh Khôi | **Edited by:** Lê Văn Vĩ

---

## 1. Actors

| Actor | Kind | Primary / Secondary | Use cases |
| :--- | :--- | :--- | :--- |
| Student (Reader) | Human | Primary, active | UC-01 to UC-18, UC-28 |
| Librarian (Admin) | Human | Primary, active | UC-02, UC-04, UC-13, UC-18, UC-19 to UC-27, UC-28 to UC-32 |
| Authentication and email service | Non-human | Secondary, passive | UC-01, UC-02, UC-03, UC-25, UC-28, UC-30, UC-31 |
| Payment provider / simulator | Non-human | Secondary, passive | UC-05, UC-10, UC-13 |
| AI provider | Non-human | Secondary, passive | UC-17 |

## 2. Diagram 1 — Account, membership, and notifications

Scope: creating and maintaining an identity, buying or renewing a membership,
and reading notifications.

```mermaid
---
config:
  theme: neutral
  look: classic
  layout: elk
---
usecase-beta
direction LR
actor Student
actor Librarian("Librarian (Admin)")
actor Auth("Authentication and email service") <<system>>
actor Pay("Payment provider") <<system>>

systemBoundary "ShelfHelp: Smart Library Management System"
  UC01("UC-01 Register for library access")
  UC02("UC-02 Sign in and sign out")
  UC03("UC-03 Recover account credentials")
  UC04("UC-04 Manage personal profile")
  UC05("UC-05 Manage membership")
  UC28("UC-28 View notifications")
end

Student -- UC01
Student -- UC02
Student -- UC03
Student -- UC04
Student -- UC05
Student -- UC28
Librarian -- UC02
Librarian -- UC04
Librarian -- UC28
UC01 -- Auth
UC02 -- Auth
UC03 -- Auth
UC05 -- Pay
UC28 -- Auth
```

| Use case | Primary actor | Supporting actor |
| :--- | :--- | :--- |
| UC-01 Register for library access | Student | Authentication and email service |
| UC-02 Sign in and sign out | Student, Librarian | Authentication and email service |
| UC-03 Recover account credentials | Student | Authentication and email service |
| UC-04 Manage personal profile | Student, Librarian | — |
| UC-05 Manage membership | Student | Payment provider |
| UC-28 View notifications | Student, Librarian | Authentication and email service |

UC-02 and UC-04 are shared by both human actors. Actor generalization is not
used, because the two roles do not form a generalisation hierarchy in the
requirements.

## 3. Diagram 2 — Discovery and selection

Scope: finding titles worth borrowing and assembling a borrowing intent.

```mermaid
---
config:
  theme: neutral
  look: classic
  layout: elk
  themeVariables:
    noteBkgColor: "#fffdf5"
    noteBorderColor: "#5a5a5a"
    noteTextColor: "#111111"
---
usecase-beta
direction LR
actor Student
actor AI("AI provider") <<system>>

systemBoundary "ShelfHelp: Smart Library Management System"
  UC06("`UC-06 Discover and inspect books
extension points: barcode scan`")
  UC07("UC-07 Find a book by barcode")
  UC08("UC-08 Manage a book wishlist")
  UC09("UC-09 Manage borrowing cart")
  UC14("UC-14 Reserve an unavailable book")
  UC16("UC-16 Manage book suggestions")
  UC17("UC-17 Get research recommendations")
end

Student -- UC06
Student -- UC07
Student -- UC08
Student -- UC09
Student -- UC14
Student -- UC16
Student -- UC17
UC17 -- AI
UC07 ..> : extend UC06

note for UC07 "`Condition: the student scans an ISBN barcode instead of searching the catalogue.
Extension point: barcode scan (UC-06).`"
```

| Use case | Primary actor | Relationship |
| :--- | :--- | :--- |
| UC-06 Discover and inspect books | Student | Base use case; extension point *barcode scan* |
| UC-07 Find a book by barcode | Student | `<<extend>>` UC-06 |
| UC-08 Manage a book wishlist | Student | — |
| UC-09 Manage borrowing cart | Student | — |
| UC-14 Reserve an unavailable book | Student | — |
| UC-16 Manage book suggestions | Student | — |
| UC-17 Get research recommendations | Student | AI provider participates |

UC-07 extends UC-06: scanning a barcode is an optional entry point into
discovery, next to searching or browsing.

## 4. Diagram 3 — Checkout, payment, and loans

Scope: turning a selection into a loan, paying what is owed, and resolving a
lost copy.

```mermaid
---
config:
  theme: neutral
  look: classic
  layout: elk
  themeVariables:
    noteBkgColor: "#fffdf5"
    noteBorderColor: "#5a5a5a"
    noteTextColor: "#111111"
---
usecase-beta
direction LR
actor Student
actor Librarian("Librarian (Admin)")
actor Pay("Payment provider / simulator") <<system>>

systemBoundary "ShelfHelp: Smart Library Management System"
  UC10("UC-10 Check out books")
  UC11("UC-11 View loans, charges and payment history")
  UC12("UC-12 Renew a loan")
  UC13("UC-13 Pay a charge")
  UC15("UC-15 Rate and review a returned book")
  UC18("`UC-18 Resolve a lost-book case
extension points: replacement fee payment`")
end

Student -- UC10
Student -- UC11
Student -- UC12
Student -- UC13
Student -- UC15
Student -- UC18
Librarian -- UC13
Librarian -- UC18
UC10 -- Pay
UC13 -- Pay
UC13 ..> : extend UC18

note for UC13 "`Condition: the student settles the replacement fee instead of returning the lost copy.
Extension point: replacement fee payment (UC-18).`"
```

| Use case | Primary actor | Relationship |
| :--- | :--- | :--- |
| UC-10 Check out books | Student | Payment provider participates |
| UC-11 View loans, charges and payment history | Student | — |
| UC-12 Renew a loan | Student | — |
| UC-13 Pay a charge | Student, Librarian | `<<extend>>` UC-18; payment provider participates |
| UC-15 Rate and review a returned book | Student | — |
| UC-18 Resolve a lost-book case | Student, Librarian | Base use case; extension point *replacement fee payment* |

UC-13 extends UC-18: settling the replacement fee is one of two ways to close a
lost-book case, the other being the physical return of the copy. Paying a charge
is also a goal in its own right, so it is a use case and not a step of the
lost-book flow.

## 5. Diagram 4 — Desk circulation and inventory

Scope: the staff work performed at the service desk and in the stacks.

```mermaid
---
config:
  theme: neutral
  look: classic
  layout: elk
---
usecase-beta
direction LR
actor Librarian("Librarian (Admin)")
actor Auth("Authentication and email service") <<system>>

systemBoundary "ShelfHelp: Smart Library Management System"
  UC19("UC-19 Maintain catalog and copies")
  UC20("UC-20 Hand over requested books")
  UC21("UC-21 Process a book return")
  UC22("UC-22 Assess damage and write off copies")
  UC23("UC-23 Manage receipts and reversals")
  UC26("UC-26 Review inventory history")
  UC29("UC-29 Oversee reservation queues")
  UC30("UC-30 Review due items and send reminders")
end

Librarian -- UC19
Librarian -- UC20
Librarian -- UC21
Librarian -- UC22
Librarian -- UC23
Librarian -- UC26
Librarian -- UC29
Librarian -- UC30
UC30 -- Auth
```

| Use case | Primary actor | Supporting actor |
| :--- | :--- | :--- |
| UC-19 Maintain catalog and copies | Librarian | — |
| UC-20 Hand over requested books | Librarian | — |
| UC-21 Process a book return | Librarian | — |
| UC-22 Assess damage and write off copies | Librarian | — |
| UC-23 Manage receipts and reversals | Librarian | — |
| UC-26 Review inventory history | Librarian | — |
| UC-29 Oversee reservation queues | Librarian | — |
| UC-30 Review due items and send reminders | Librarian | Authentication and email service |

All eight use cases are distinct goals of the same actor, and no relationship is
drawn between them.

## 6. Diagram 5 — Acquisitions, analytics, and administration

Scope: buying stock, reporting on operations, and administering accounts and
policy.

```mermaid
---
config:
  theme: neutral
  look: classic
  layout: elk
---
usecase-beta
direction LR
actor Librarian("Librarian (Admin)")
actor Auth("Authentication and email service") <<system>>

systemBoundary "ShelfHelp: Smart Library Management System"
  UC24("UC-24 Plan book acquisitions")
  UC25("UC-25 Receive an acquisition shipment")
  UC27("UC-27 Review analytics and export reports")
  UC31("UC-31 Manage student accounts")
  UC32("UC-32 Configure library policies")
end

Librarian -- UC24
Librarian -- UC25
Librarian -- UC27
Librarian -- UC31
Librarian -- UC32
UC25 -- Auth
UC31 -- Auth
```

| Use case | Primary actor | Supporting actor |
| :--- | :--- | :--- |
| UC-24 Plan book acquisitions | Librarian | — |
| UC-25 Receive an acquisition shipment | Librarian | Authentication and email service |
| UC-27 Review analytics and export reports | Librarian | — |
| UC-31 Manage student accounts | Librarian | Authentication and email service |
| UC-32 Configure library policies | Librarian | — |

**Scope note on UC-32.** Membership plans, prices, durations, and privilege tiers
are fixed system policy configured at deployment (Vision Document v2.0,
FEAT-03). Staff do not create, edit, deactivate, or re-price plans at runtime,
so plan administration is not drawn as a use case.

## 7. Coverage

| Diagram | Use cases | Count |
| :--- | :--- | :--- |
| 1. Account, membership, and notifications | UC-01 to UC-05, UC-28 | 6 |
| 2. Discovery and selection | UC-06 to UC-09, UC-14, UC-16, UC-17 | 7 |
| 3. Checkout, payment, and loans | UC-10 to UC-13, UC-15, UC-18 | 6 |
| 4. Desk circulation and inventory | UC-19 to UC-23, UC-26, UC-29, UC-30 | 8 |
| 5. Acquisitions, analytics, and administration | UC-24, UC-25, UC-27, UC-31, UC-32 | 5 |
| **Total** | **UC-01 to UC-32, no gaps, no duplicates** | **32** |

The diagrams are split across five views for readability. All five share the same
boundary label, actor names, and notation, and together they cover every use case
in the Use-Case Catalogue exactly once.

## 8. References

- `docs/analysis-and-design/Use-Case-Catalog.md` — use-case IDs, names, actors, and candidate extend relationships.
- `docs/management/PA3/vision-document/Vision-Document.md` — feature scope, including the fixed membership policy that limits UC-32.
- `docs/management/PA3/UseCase/UC*.md` — detailed description of each use case.
- `mermaid/*.mmd` — diagram sources; `mermaid/*.png` — rendered images for the report.
