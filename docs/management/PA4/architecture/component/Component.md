# ShelfHelp: Smart Library Management System
# PA4 Software Architecture — C4 Level 3 (Component Diagrams)

**Version:** 1.8

---

## Revision History

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 24/Nov/2026 | 1.0 | Initial component views for the Web Application and ShelfHelp API | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.1 | Split reader components, merged transaction and persistence, aligned external containers | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.2 | Aligned container types, removed L3 Sentry, documented TypeScript/SQL rule parity and test strategy, and clarified atomic audit logging | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.3 | Component diagrams rendered as two panels each (Web Application by mode; ShelfHelp API by entry path) so the C4 layout stays readable | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.4 | Catalogues gained a Panel column so each component maps to its diagram panel | Nguyễn Anh Khôi |
| 27/Nov/2026 | 1.5 | Aligned Web App and API components, command map (`list-sessions`, `revoke-session`, `revoke-other-sessions`), and traceability (UC-01–UC-32) with PA4 UC-02 and UC-32 | Nguyễn Anh Khôi |
| 28/Nov/2026 | 1.6 | Updated Edge Function count to 24, corrected command names (`send-reminders`, `submit-book-review`, `inventory-history`), and aligned §7.1/§8 with `src/supabase/functions/` | Nguyễn Anh Khôi |
| 28/Nov/2026 | 1.7 | Clarified §4.1 and §5 — reader/admin code-splitting is a PA5 target; routes are currently separate trees but share one bundle | Nguyễn Anh Khôi |
| 28/Nov/2026 | 1.8 | Removed inline implementation-status labels from prose and diagrams; the docs now present the PA1–PA5 target architecture uniformly, with status consolidated in §1.2 and §12 | Nguyễn Anh Khôi |

---

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Why these two containers](#2-why-these-two-containers)
- [3. Web Application — component diagram](#3-web-application--component-diagram)
  - [3.1 Reader Mode](#31-reader-mode)
  - [3.2 Admin Mode](#32-admin-mode)
- [4. Web Application — component catalogue](#4-web-application--component-catalogue)
- [5. Web Application — design notes](#5-web-application--design-notes)
- [6. ShelfHelp API — component diagram](#6-shelfhelp-api--component-diagram)
  - [6.1 Request path (business commands)](#61-request-path-business-commands)
  - [6.2 Scheduled-job path (pg_cron)](#62-scheduled-job-path-pg_cron)
- [7. ShelfHelp API — component catalogue](#7-shelfhelp-api--component-catalogue)
- [8. ShelfHelp API — business command map](#8-shelfhelp-api--business-command-map)
- [9. ShelfHelp API — interactions and design notes](#9-shelfhelp-api--interactions-and-design-notes)
- [10. Shared code and cross-cutting concerns](#10-shared-code-and-cross-cutting-concerns)
- [11. Traceability](#11-traceability)
- [12. Implementation status](#12-implementation-status)
- [13. Deliberate omissions](#13-deliberate-omissions)

---

## 1. Introduction

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

### 1.1 Purpose

This document is the **C4 Level 3 (Component) view** of ShelfHelp. It opens the two core application containers from the Container view and shows the modules inside them, their responsibilities, and their collaborations.

A *component* is a group of related code with a clear responsibility inside its container. Components are not separately deployed: they are compiled into the React bundle or the Edge Function bundle.

### 1.2 Scope

The view documents the components inside the two core application containers for the features from PA1 through PA4, and carries the forward design for PA5 alongside them. It shows the structure the system is designed to have at the end of PA5, so an element may appear here before the code that implements it exists. §12 lists what is implemented today and what the final release still adds, and the current code remains the authority on what runs. Some diagram elements group related functions conceptually rather than corresponding to a single module.

The inline Mermaid diagrams and linked `.mmd` files are authoritative.

### 1.3 References

| ID | Document | Use in this document |
| :--- | :--- | :--- |
| R1 | `Container.md` | Container responsibilities and runtime flows |
| R2 | `System-Context.md` | Actors, external systems, and platform description |
| R3 | `SHELFHELP_FULLSPEC.md` | Screens, functions, RPCs, and data model |
| R4 | Use-Case-Diagrams.md | UC-01 to UC-32 |

---

## 2. Why these two containers

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

The Web Application and the ShelfHelp API carry almost all product behaviour. The Web Application is where Reader and Admin experiences differ; the API is where every command, job, and provider adapter runs.

PostgreSQL is not decomposed here because its components are tables, constraints, indexes, policies, triggers, and RPCs, which are documented in the specification and migrations. Auth, Storage, and
Realtime are managed services with no team-owned internal modules.

---

## 3. Web Application — component diagram

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

The view is drawn as two panels, one per operating mode. Reader Mode and Admin Mode share the same
App Shell, the same Data Access & Realtime Client, and the same backend services, so each panel shows
only the feature components that mode actually mounts. Read together, the two panels cover every
component and relationship of the container. The data-access box groups direct `supabase-js` calls and the API helper conceptually; it is not a single gateway used by every feature.

### 3.1 Reader Mode

<details>
<summary>Mermaid source — Reader Mode</summary>

```mermaid
C4Component
    title Component diagram — ShelfHelp Web Application (Reader Mode)

    Person(student, "Student (Reader)", "Uses Reader Mode on a phone or laptop.")

    Container_Boundary(spa, "ShelfHelp Web Application") {
        Component(authProfile, "Authentication & Profile", "React", "Registration, OTP verification, login/logout, active sessions, password reset, profile editing and avatar cropping.")
        Component(appShell, "App Shell & Access Guard", "React state, browser history", "Bootstraps the application, selects the Reader or Admin shell and enforces session, role and account-status guards.")
        Component(catalogDiscovery, "Catalog & Discovery", "React", "Home, search with filters and sorting, book detail, barcode scan, reviews and wishlist.")

        Component(cartCheckout, "Cart & Checkout", "React", "Borrowing cart, checkout, pickup window and simulated payment.")
        Component(dataAccess, "Data Access & Realtime Client", "supabase-js", "PostgREST reads, Realtime subscriptions, Storage uploads and Edge Function invocation with the JWT and standard error envelope.")
        Component(myLibrary, "My Library", "React", "Loans, renewals, reservations, charges and membership.")

        Component(notificationsAssistant, "Notifications & Assistant", "React, Realtime", "Notifications, suggestions and the grounded AI assistant.")
    }

    Boundary(backend, "Backend services", "SUPABASE") {
        Container(api, "ShelfHelp API", "Supabase Edge Functions", "Business commands and scheduled jobs.")
        ContainerDb(db, "PostgreSQL Database", "Supabase Postgres 15", "Catalog and own-row data exposed through PostgREST under RLS.")
        Container_Ext(auth, "Supabase Auth", "Managed identity service", "Sessions, JWT and credential recovery.")
        Container_Ext(storage, "Supabase Storage", "Managed object storage", "Covers, avatars, evidence and imports.")
        Container_Ext(realtime, "Supabase Realtime", "Managed change-data service", "Live counters, notifications and own loan changes.")
    }

    Rel(student, appShell, "Uses Reader Mode", "HTTPS")

    Rel(appShell, dataAccess, "Session state")
    Rel(appShell, authProfile, "Routes auth flows")
    Rel(appShell, catalogDiscovery, "Renders")
    Rel(appShell, cartCheckout, "Renders")
    Rel(appShell, myLibrary, "Renders")
    Rel(appShell, notificationsAssistant, "Renders")

    Rel(catalogDiscovery, dataAccess, "Queries/commands")
    Rel(cartCheckout, dataAccess, "Queries/commands")
    Rel(myLibrary, dataAccess, "Queries/commands")
    Rel(notificationsAssistant, dataAccess, "Queries/commands")
    Rel(authProfile, dataAccess, "Authenticates")

    Rel(dataAccess, auth, "Signs in/verifies OTP", "HTTPS, PKCE")
    Rel(dataAccess, db, "Reads; writes own profile/cart", "PostgREST, RLS")
    Rel(dataAccess, api, "Invokes commands", "HTTPS, JWT")
    Rel(dataAccess, storage, "(Data → Supabase Storage) <br/>Files", "HTTPS, signed URLs")
    Rel(dataAccess, realtime, "Subscribes", "WebSocket, RLS")

    UpdateRelStyle(student, appShell, $offsetX="-30", $offsetY="-50")

    UpdateRelStyle(appShell, dataAccess, $offsetX="10", $offsetY="0")
    UpdateRelStyle(appShell, authProfile, $offsetX="-40", $offsetY="10")
    UpdateRelStyle(appShell, catalogDiscovery, $offsetX="-30", $offsetY="10")
    UpdateRelStyle(appShell, cartCheckout, $offsetX="-80", $offsetY="20")
    UpdateRelStyle(appShell, myLibrary, $offsetX="30", $offsetY="15")
    UpdateRelStyle(appShell, notificationsAssistant, $offsetX="-70", $offsetY="50")

    UpdateRelStyle(catalogDiscovery, dataAccess, $offsetX="50", $offsetY="-20")
    UpdateRelStyle(cartCheckout, dataAccess, $offsetX="-40", $offsetY="-15")
    UpdateRelStyle(myLibrary, dataAccess, $offsetX="-40", $offsetY="-20")
    UpdateRelStyle(notificationsAssistant, dataAccess, $offsetX="0", $offsetY="0")
    UpdateRelStyle(authProfile, dataAccess, $offsetX="-45", $offsetY="-40")

    UpdateRelStyle(dataAccess, auth, $offsetX="-90", $offsetY="300")
    UpdateRelStyle(dataAccess, db, $offsetX="20", $offsetY="-30")
    UpdateRelStyle(dataAccess, api, $offsetX="-200", $offsetY="160")
    UpdateRelStyle(dataAccess, storage, $offsetX="20", $offsetY="300")
    UpdateRelStyle(dataAccess, realtime, $offsetX="60", $offsetY="150")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```
</details>

![Diagram](mermaid/component-webapp-reader.png)


The data-access box is a conceptual grouping, not a mandatory central gateway.

### 3.2 Admin Mode

<details>
<summary>Mermaid source — Admin Mode</summary>

```mermaid
C4Component
    title Component diagram — ShelfHelp Web Application (Admin Mode)

    Person(librarian, "Librarian (Admin)", "Uses Admin Mode on a desktop.")

    Container_Boundary(spa, "ShelfHelp Web Application") {
        Component(adminCirculation, "Admin Circulation & Queues", "React", "Desk handover, returns, due/overdue groups, reservation queues and reminders.")
        Component(appShell, "App Shell & Access Guard", "React state, browser history", "Bootstraps the application, selects the Reader or Admin shell and enforces session, role and account-status guards.")
        Component(adminCatalog, "Admin Catalog & Inventory", "React", "Books, copies, ISBN lookup, bulk import, inventory history and write-off slips.")

        Component(adminMoney, "Admin Money & Reporting", "React", "Receipts and reversals, dashboard KPIs and report exports.")
        Component(dataAccess, "Data Access & Realtime Client", "supabase-js", "PostgREST reads, Realtime subscriptions, Storage uploads and Edge Function invocation with the JWT and standard error envelope.")
        Component(adminAcquisitions, "Admin Acquisitions & Students", "React", "Suggestion review, acquisition batches, shipment receipt and student accounts.")

        Component(authProfile, "Authentication & Profile", "React", "Sign-in/out, password reset, personal profile and own active sessions (/admin/profile/sessions).")
    }

    Boundary(backend, "Backend services", "SUPABASE") {
        Container(api, "ShelfHelp API", "Supabase Edge Functions", "Business commands and scheduled jobs.")
        ContainerDb(db, "PostgreSQL Database", "Supabase Postgres 15", "Catalog and own-row data exposed through PostgREST under RLS.")
        Container_Ext(auth, "Supabase Auth", "Managed identity service", "Sessions, JWT and credential recovery.")
        Container_Ext(storage, "Supabase Storage", "Managed object storage", "Covers, avatars, evidence and imports.")
        Container_Ext(realtime, "Supabase Realtime", "Managed change-data service", "Live counters, notifications and own loan changes.")
    }

    Rel(librarian, appShell, "Uses Admin Mode", "HTTPS")

    Rel(appShell, dataAccess, "Session state")
    Rel(appShell, adminCirculation, "Renders")
    Rel(appShell, adminCatalog, "Renders")
    Rel(appShell, adminMoney, "Renders")
    Rel(appShell, adminAcquisitions, "Renders")
    Rel(appShell, authProfile, "Routes auth/session flows")

    Rel(adminCirculation, dataAccess, "Queries/commands")
    Rel(adminCatalog, dataAccess, "Queries/commands")
    Rel(adminMoney, dataAccess, "Queries/commands")
    Rel(adminAcquisitions, dataAccess, "Queries/commands")
    Rel(authProfile, dataAccess, "Auth & sessions")

    Rel(dataAccess, auth, "Verifies session", "HTTPS, PKCE")
    Rel(dataAccess, db, "Reads; writes own profile", "PostgREST, RLS")
    Rel(dataAccess, api, "Invokes commands", "HTTPS, JWT")
    Rel(dataAccess, storage, "(Data → Storage) <br/>Files", "HTTPS, signed URLs")
    Rel(dataAccess, realtime, "Subscribes", "WebSocket, RLS")

    UpdateRelStyle(librarian, appShell, $offsetX="-20", $offsetY="-50")

    UpdateRelStyle(appShell, dataAccess, $offsetX="10", $offsetY="0")
    UpdateRelStyle(appShell, adminCirculation, $offsetX="-20", $offsetY="10")
    UpdateRelStyle(appShell, adminCatalog, $offsetX="-20", $offsetY="10")
    UpdateRelStyle(appShell, adminMoney, $offsetX="-80", $offsetY="20")
    UpdateRelStyle(appShell, adminAcquisitions, $offsetX="-30", $offsetY="-20")
    UpdateRelStyle(appShell, authProfile, $offsetX="-165", $offsetY="65")

    UpdateRelStyle(adminCirculation, dataAccess, $offsetX="-35", $offsetY="-30")
    UpdateRelStyle(adminCatalog, dataAccess, $offsetX="60", $offsetY="-20")
    UpdateRelStyle(adminMoney, dataAccess, $offsetX="-50", $offsetY="10")
    UpdateRelStyle(adminAcquisitions, dataAccess, $offsetX="-50", $offsetY="10")
    UpdateRelStyle(authProfile, dataAccess, $offsetX="-18", $offsetY="10")

    UpdateRelStyle(dataAccess, auth, $offsetX="-90", $offsetY="300")
    UpdateRelStyle(dataAccess, db, $offsetX="20", $offsetY="-30")
    UpdateRelStyle(dataAccess, api, $offsetX="-200", $offsetY="160")
    UpdateRelStyle(dataAccess, storage, $offsetX="20", $offsetY="300")
    UpdateRelStyle(dataAccess, realtime, $offsetX="60", $offsetY="150")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```
</details>

![Diagram](mermaid/component-webapp-admin.png)

All feature components use the shared presentation kit and the shared validation contracts. These are cross-cutting libraries rather than collaborating components, so they are omitted from the diagram.

Source: `mermaid/component-webapp-reader.mmd` and
`mermaid/component-webapp-admin.mmd`.

---

## 4. Web Application — component catalogue

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

The **Panel** column names the diagram panel in which each component appears: *Reader* (§3.1), *Admin*
(§3.2), or *Both* for the App Shell, Authentication & Profile, the Data Access & Realtime Client, and the shared backend.

| Component | Panel | Responsibilities & services | Relationships & collaborations | Key source | Main use cases |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **App Shell & Access Guard** | Both | Bootstraps the application; inspects authenticated user session and role (`student` vs `admin`) to render Reader Mode or Admin Mode; enforces status checks (`pending_verification`, `restricted`, `inactive`). | Mounts and conditionally routes to **Authentication & Profile** and feature sub-shells (**Catalog & Discovery**, **Cart & Checkout**, **My Library**, **Admin Circulation**, etc.); subscribes to auth state from **Data Access Client**. | `src/frontend/src/app/`, feature layouts | All |
| **Authentication & Profile** | Both | Self-registration and email OTP verification (students), password login/logout, password reset, personal profile and avatar cropping. UC-02 server lockout/countdown and optional *"Keep me signed in"* refresh-token persistence (never storing passwords), plus UC-32 own active-session inventory and remote revocation (`/profile/sessions`, `/admin/profile/sessions`). | Rendered by **App Shell** in both modes; invokes auth and avatar actions via **Data Access Client** to **Supabase Auth** and **Storage**. For session management it calls **ShelfHelp API** for `list-sessions`, `revoke-session`, and `revoke-other-sessions`. | `src/frontend/src/features/auth/` | UC-01–UC-04, UC-32 |
| **Catalog & Discovery** | Reader | Catalog browsing, diacritic-insensitive search, genre/department filtering, book detail view, ISBN camera barcode scanning, reading wishlist, and community review display. | Rendered by **App Shell**; queries catalog and book reviews via **Data Access Client** (PostgREST); issues wishlist mutations via API (`toggle-wishlist`). | `src/frontend/src/features/reader/` | UC-06–UC-08, UC-15 |
| **Cart & Checkout** | Reader | Borrowing cart persistence in `cart_items` table (own rows under RLS), copy availability check, checkout review, pickup window confirmation (48 hours), and simulated payment for fees. | Rendered by **App Shell**; sends checkout and payment commands through **Data Access Client** to ShelfHelp API functions (`checkout-cart`, `complete-simulated-payment`, and `create-payment` as planned). | `src/frontend/src/features/reader/` | UC-09, UC-10 |
| **My Library** | Reader | Active loans display, self-service loan renewal, reservation queue tracking/cancellation, outstanding fines/charges ledger, and membership tier upgrade. | Rendered by **App Shell**; queries own rows and invokes loan renewal, reservation cancellation, and fee payment via **Data Access Client** to API (`cancel-reservation`, `renew-loan`). | `src/frontend/src/features/reader/` | UC-05, UC-11–UC-14, UC-18 |
| **Notifications & Assistant** | Reader | In-app notification centre, book acquisition suggestions submission, and grounded conversational AI assistant with citation links. | Rendered by **App Shell**; listens to real-time notification events and sends suggestion/assistant requests via **Data Access Client** to API (`chat-send`, `submit-suggestion`). | `src/frontend/src/features/reader/` | UC-16, UC-17, UC-28 |
| **Admin Circulation & Queues** | Admin | Circulation desk pickup handover, book returns with condition grading and damage tier fee assessment, due/overdue loans monitoring, and reservation queue management. | Rendered by **App Shell**; sends physical circulation commands via **Data Access Client** to ShelfHelp API (`handover-items`, `return-loan`, `record-counter-payment`). | `src/frontend/src/features/admin/circulation/`, `queues/` | UC-20, UC-21, UC-29, UC-30 |
| **Admin Catalog & Inventory** | Admin | Book cataloguing, physical copy barcode generation and tracking, bulk CSV import, inventory condition history, and write-off slip creation with photo evidence. | Rendered by **App Shell**; uploads evidence to Storage and issues catalog management commands via **Data Access Client** to API and PostgREST. | `src/frontend/src/features/admin/` | UC-07, UC-19, UC-22, UC-26 |
| **Admin Money & Reporting** | Admin | Financial ledger inspection, receipt generation, counter payments recording, payment reversals, KPI summary cards, and Excel/CSV report exports. | Rendered by **App Shell**; invokes counter payment and reversal commands, and fetches aggregate statistics via **Data Access Client** (`get_dashboard_kpis`). | `src/frontend/src/features/admin/ledger/` | UC-13, UC-23, UC-27 |
| **Admin Acquisitions & Students** | Admin | Student suggestion triage, batch purchasing order management, shipment check-in, student account status controls, and debt hold management. | Rendered by **App Shell**; invokes batch lifecycle and student account modification commands via **Data Access Client** to ShelfHelp API. | `src/frontend/src/features/admin/` | UC-24, UC-25, UC-31 |
| **Data Access & Realtime Client** | Both | Gateway wrapping `supabase-js`; handles session-aware PostgREST reads, Realtime change subscriptions, Storage file transfers, and HTTPS Edge Function command invocations with standard error envelopes. | Collaborates with all feature components as their interface to external containers: **PostgreSQL Database** (PostgREST under RLS), **ShelfHelp API** (commands), **Supabase Auth**, **Supabase Storage**, and **Supabase Realtime**. | `src/frontend/src/lib/` | All |

### 4.1 Reader and Admin Mode in one container

Reader and Admin Mode share the App Shell, the Data Access client, and the shared contracts. Their routes are structured as separate route trees, with route-level `React.lazy` / `Suspense` code-splitting so that admin code is never downloaded by students. The App Shell chooses the mode from the authenticated profile:

- `role = student` → Reader shell and reader routes;
- `role = admin` → Admin shell and admin routes;
- `status = pending_verification` → verification screen;
- no session → authentication routes.

Route guards improve the experience; RLS and Edge Functions enforce the actual rule.

---

## 5. Web Application — design notes

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

- **Feature isolation.** Features do not import each other's internals. Shared behaviour moves to
  `@shelfhelp/shared` or a shared presentation component.
- **Server state.** Server state is owned by the data-access layer so that loan and availability data
  do not go stale between screens.
- **Validation.** Client validation is a usability feature; the same schema and domain rules run on the
  server.
- **Bundles.** Route-level `React.lazy` / `Suspense` splits reader and admin code, so each mode ships
  only the routes it mounts.
- **Failure.** The API client preserves `reason`, `message`, and `details`, so screens can show a
  specific recovery action.

---

## 6. ShelfHelp API — component diagram

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

The view is drawn as two panels, one per entry path. Business commands arrive from the Web Application
over HTTPS; scheduled jobs arrive from `pg_cron` inside PostgreSQL through `pg_net`. Both paths enter
the same handlers and commit through the same RPC gateway, so the two panels share the rule engine, the
gateway, and the job tracker.

### 6.1 Request path (business commands)

<details>
<summary>Mermaid source — Request path</summary>

```mermaid
C4Component
    title Component diagram — ShelfHelp API: request path (business commands)
    Container_Ext(auth, "Supabase Auth", "Managed identity service", "JWT verification, user identity and session management.")
    Container(webapp, "ShelfHelp Web Application", "React SPA", "Calls business commands.")
    ContainerDb(db, "PostgreSQL Database", "Supabase Postgres 15", "System of record, RLS, triggers, atomic RPC transactions and audit logging.")

    Container_Boundary(api, "ShelfHelp API") {
        Component(authGuard, "Auth & Access Guard", "_shared/auth.ts", "Verifies the JWT, reads app_metadata.role and reloads profile status; enforces role, account status, debt hold, membership and reservation ban.")
        Component(commandGateway, "Command Execution & RPC Gateway", "SQL RPCs, idempotency keys", "Executes each command as one PostgreSQL RPC/transaction (writing state changes and audit_logs atomically), retries deadlocks, and returns cached idempotency responses.")
        Component(jobLogger, "Job Tracking & Error Logger", "job_runs, logger", "Captures unhandled exceptions for operational monitoring.")

        Component(validation, "Request Validation", "Shared validation", "Parses and validates every request body before any database work begins.")
        Component(commandHandlers, "Business Command Handlers", "One function folder per command", "Account, catalog, inventory, borrowing, money, circulation, write-off, acquisition, notification and assistant commands; thin orchestration only.")
        Component(httpHelpers, "HTTP & CORS Helpers", "_shared/http.ts", "Accept POST requests, handle CORS and OPTIONS, and map results to JSON or the standard error envelope.")

        Component(domainRules, "Shared Domain Rules", "@shelfhelp/shared", "Pure entitlements, gating, fines, reservation promotion, lost-book and charge rules.")
        Component(adapters, "Integration Adapters", "Email, payment, embedding, LLM and ISBN adapters", "Isolates third-party protocols and applies fallbacks such as manual ISBN entry and keyword assistant results.")
    }

    Boundary(providers, "Third-party providers", "EXTERNAL") {
        System_Ext(email, "Email Delivery Provider", "SMTP or transactional email API")
        System_Ext(payment, "Payment Provider (simulator)", "Payment and refund API")
        System_Ext(ai, "AI Provider", "Embedding and LLM APIs")
        System_Ext(isbn, "Bibliographic Metadata Services", "Google Books and Open Library")
    }

    Rel(webapp, commandHandlers, "Calls command", "HTTPS, JWT")

    Rel(commandHandlers, authGuard, "Uses")
    Rel(commandHandlers, validation, "Uses")
    Rel(commandHandlers, httpHelpers, "Uses")
    Rel(commandHandlers, domainRules, "Business rules")
    Rel(commandHandlers, commandGateway, "One RPC transaction")
    Rel(commandHandlers, adapters, "Provider calls")
    Rel(commandHandlers, jobLogger, "Logs unhandled errors")

    Rel(authGuard, auth, "Verifies JWT", "HTTPS")
    Rel(commandHandlers, auth, "Manages users & sessions", "HTTPS, service role")
    Rel(authGuard, db, "Reloads profiles.status", "PostgREST HTTPS, service role")
    Rel(commandGateway, db, "Executes RPC (commits state & audit)", "PostgREST HTTPS, service role")
    Rel(jobLogger, db, "Writes error records", "PostgREST HTTPS, service role")

    Rel(adapters, email, "Email", "HTTPS/SMTP")
    Rel(adapters, payment, "Payments", "HTTPS")
    Rel(adapters, ai, "AI", "HTTPS")
    Rel(adapters, isbn, "ISBN", "HTTPS")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
    UpdateRelStyle(commandHandlers, authGuard, $offsetX="0", $offsetY="-30")
    UpdateRelStyle(commandHandlers, validation, $offsetX="-10", $offsetY="-15")
    UpdateRelStyle(commandHandlers, httpHelpers, $offsetX="-10", $offsetY="-15")
    UpdateRelStyle(commandHandlers, domainRules, $offsetX="-60", $offsetY="-10")
    UpdateRelStyle(commandHandlers, commandGateway, $offsetX="10", $offsetY="0")
    UpdateRelStyle(commandHandlers, adapters, $offsetX="10", $offsetY="0")

    UpdateRelStyle(authGuard, auth, $offsetX="10", $offsetY="0")
    UpdateRelStyle(commandHandlers, auth, $offsetX="-65", $offsetY="-195")
    UpdateRelStyle(authGuard, db, $offsetX="10", $offsetY="-25")
    UpdateRelStyle(commandGateway, db, $offsetX="-40", $offsetY="50")
    UpdateRelStyle(jobLogger, db, $offsetX="20", $offsetY="-30")

    UpdateRelStyle(webapp, commandHandlers, $offsetX="0", $offsetY="-250")
    
    UpdateRelStyle(adapters, email, $offsetX="-140", $offsetY="50")
    UpdateRelStyle(adapters, payment, $offsetX="40", $offsetY="0")
    UpdateRelStyle(adapters, ai, $offsetX="10", $offsetY="0")
    UpdateRelStyle(adapters, isbn, $offsetX="0", $offsetY="0")
```
</details>

![Diagram](mermaid/component-api-request.png)

The RPC box represents the handler's own call to a transactional stored procedure.

### 6.2 Scheduled-job path (pg_cron)

<details>
<summary>Mermaid source — Scheduled-job path</summary>

```mermaid
C4Component
    title Component diagram — ShelfHelp API: scheduled-job path (pg_cron)
    ContainerDb(db, "PostgreSQL Database", "Supabase Postgres 15", "System of record, RLS, triggers, atomic RPC transactions and audit logging.")

    Container_Boundary(api, "ShelfHelp API") {
        Component(commandGateway, "Command Execution & RPC Gateway", "SQL RPCs, idempotency keys", "Executes each job step as one PostgreSQL RPC/transaction (writing state changes and audit_logs atomically), retries deadlocks, and returns cached idempotency responses.")
        Component(jobHandlers, "Scheduled Job Handlers", "pg_net-invoked functions", "Nightly loans and fines, hold expiry, payment expiry, reminders, email outbox and embedding queue.")
        Component(jobLogger, "Job Tracking & Error Logger", "job_runs, logger", "Records background job execution outcomes into job_runs and captures unhandled exceptions for operational monitoring.")

        Component(httpHelpers, "HTTP & CORS Helpers", "_shared/http.ts", "Accept POST requests, handle CORS and OPTIONS, and map results to JSON or the standard error envelope.")
        Component(domainRules, "Shared Domain Rules", "@shelfhelp/shared", "Pure entitlements, gating, fines, reservation promotion, lost-book and charge rules.")
        Component(adapters, "Integration Adapters", "Email, payment, embedding, LLM and ISBN adapters", "Isolates third-party protocols; the job path uses the email and embedding adapters.")
    }

    Boundary(providers, "Third-party providers", "EXTERNAL") {
        System_Ext(email, "Email Delivery Provider", "SMTP or transactional email API")
        System_Ext(ai, "AI Provider", "Embedding and LLM APIs")
    }

    Rel(db, jobHandlers, "pg_cron calls job", "HTTPS via pg_net")

    Rel(jobHandlers, commandGateway, "One RPC transaction")
    Rel(jobHandlers, jobLogger, "Records run")
    Rel(jobHandlers, httpHelpers, "Uses")
    Rel(jobHandlers, domainRules, "Business rules")
    Rel(jobHandlers, adapters, "Email/embeddings")

    Rel(commandGateway, db, "Executes RPC (commits state & audit)", "PostgREST HTTPS, service role")
    Rel(jobLogger, db, "Writes job_runs", "PostgREST HTTPS, service role")

    Rel(adapters, email, "Email", "HTTPS/SMTP")
    Rel(adapters, ai, "AI", "HTTPS")

    UpdateRelStyle(db, jobHandlers, $offsetX="-15", $offsetY="-50")
    UpdateRelStyle(jobHandlers, commandGateway, $offsetX="-45", $offsetY="-15")
    UpdateRelStyle(jobHandlers, jobLogger, $offsetX="-40", $offsetY="-15")
    UpdateRelStyle(jobHandlers, httpHelpers, $offsetX="-10", $offsetY="-10")
    UpdateRelStyle(jobHandlers, domainRules, $offsetX="10", $offsetY="0")
    UpdateRelStyle(jobHandlers, adapters, $offsetX="0", $offsetY="0")
    UpdateRelStyle(commandGateway, db, $offsetX="15", $offsetY="40")
    UpdateRelStyle(jobLogger, db, $offsetX="0", $offsetY="-60")
    UpdateRelStyle(adapters, email, $offsetX="85", $offsetY="-10")
    UpdateRelStyle(adapters, ai, $offsetX="40", $offsetY="0")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```
</details>

![Diagram](mermaid/component-api-scheduled-job.png)


This panel shows the scheduled-job entry path. `pg_cron` inside PostgreSQL calls the job handlers through `pg_net` with a secret header.

Source: `mermaid/component-api-request.mmd` and
`mermaid/component-api-scheduled-job.mmd`.

---

## 7. ShelfHelp API — component catalogue

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

The **Panel** column names the diagram panel in which each component appears: *Request* (§6.1),
*Scheduled job* (§6.2), or *Both* for the shared rule engine, RPC gateway, adapters, and job tracker.

| Component | Panel | Responsibilities & services | Relationships & collaborations | Key source |
| :--- | :--- | :--- | :--- | :--- |
| **HTTP & CORS Helpers** | Both | Accept incoming HTTP POST requests, handle preflight OPTIONS, inject standard CORS headers, format success JSON responses, and serialize standard error envelopes (`{ error: { reason, message, details } }`). | Invoked by **Business Command Handlers** and **Scheduled Job Handlers** at the start and completion of every function execution. | `src/supabase/functions/_shared/http.ts` |
| **Auth & Access Guard** | Request | Extract and verify JWT bearer tokens; look up caller role in `app_metadata.role`; query and reload current `profiles.status`; enforce status gates (`active`, `restricted`, `inactive`), debt holds, active membership requirements, and reservation suspension bans. | Used by **Business Command Handlers**; communicates with **Supabase Auth** for token verification and queries **PostgreSQL Database** for real-time profile status. | `src/supabase/functions/_shared/auth.ts` |
| **Request Validation** | Request | Parse and strictly validate incoming request payloads with shared domain validation and type guards before any database connection or domain rule execution occurs. | Used by **Business Command Handlers**; shares validation contracts with the Web Application from `@shelfhelp/shared`. | `src/shared/src/` schemas |
| **Business Command Handlers** | Request | Serverless function endpoints for user actions. Thin orchestration: invokes HTTP/Auth/Validation helpers, applies shared domain calculations, calls **Supabase Auth** Admin API (`service_role`) for user commands (`register-student`, `set-account-inactive`, `list-sessions`, `revoke-session`, `revoke-other-sessions`), triggers third-party adapters when required, and executes business mutations via the RPC gateway. | Invoked by **ShelfHelp Web Application** via HTTPS; collaborates with **HTTP Helpers**, **Auth Guard**, **Validation**, **Shared Domain Rules**, **Supabase Auth**, **Integration Adapters**, **Command Execution & RPC Gateway**, and **Job Tracking & Error Logger**. | `src/supabase/functions/<command>/index.ts` |
| **Scheduled Job Handlers** | Scheduled job | Serverless endpoints invoked by scheduled background crons (`pg_cron`) for batch tasks: overdue loan fines assessment, hold reservation expiry, unpaid checkout cleanup, membership renewal notices, and email outbox dispatch. | Invoked by **PostgreSQL Database** (`pg_net` with `x-job-secret` header, bypassing user JWT Auth Guard); collaborates with **HTTP Helpers**, **Shared Domain Rules**, **Command Gateway**, **Adapters**, and **Job Tracking & Error Logger**. | `src/supabase/functions/job-*/index.ts` |
| **Shared Domain Rules** | Both | Pure business logic calculations: borrowing entitlements, gating policies, fine rules, and damage tiers. Reused across frontend preview, Edge Function validation, and mirrored in transactional SQL RPCs validated by parity tests. | Called by **Business Command Handlers** and **Scheduled Job Handlers**; shared between browser and Edge Functions. | `src/shared/src/domain/` |
| **Command Execution & RPC Gateway** | Both | Manages invocation of PostgreSQL transactional stored procedures (RPCs); checks and enforces idempotency keys; retries serialization failures and deadlocks up to three times; ensures all state changes, `copy_events`, and `audit_logs` commit atomically within one database transaction. | Invoked by **Command Handlers** and **Job Handlers**; communicates with **PostgreSQL Database** via PostgREST HTTPS using `service_role` credentials. | `src/supabase/migrations/` RPCs |
| **Integration Adapters** | Both | Encapsulates third-party external integrations behind stable, testable interfaces: `EmailProvider` (SMTP/Resend), `PaymentProvider` (simulated gateway), `Embedder` and `LlmClient` (AI Provider), and `IsbnLookup` (Google Books / Open Library); provides fallback mechanisms such as keyword search when the AI path fails. | Called by **Command Handlers** and **Job Handlers**; communicates over HTTPS / SMTP with **Email Provider**, **Payment Provider**, **AI Provider**, and **Bibliographic Services**. | `_shared/adapters/` |
| **Job Tracking & Error Logger** | Both | Persists background job execution status, elapsed runtimes, and failure diagnostics into `job_runs`; captures unexpected runtime exceptions across commands and jobs for operational monitoring (Sentry). | Invoked by **Job Handlers** and **Command Handlers**; writes job history to **PostgreSQL Database** via PostgREST HTTPS; forwards unhandled runtime errors to Sentry. | `job_runs`, logger |

### 7.1 Existing transactional procedures

| RPC | Purpose |
| :--- | :--- |
| `rpc_confirm_handover_for_admin` | Confirms a desk handover and moves the copy and loan item to borrowed in one transaction. |
| `rpc_process_return_with_evidence_for_admin` | Processes a physical return, assesses condition, records the resulting charges, updates copy status, and promotes the next reservation in one atomic transaction. |
| `rpc_settle_counter_charge` | Records counter cash payment and marks the associated charge settled. |
| `rpc_cancel_reservation_staff` | Cancels a reservation from the admin queue and promotes the next waiting student. |
| `rpc_renew_loan_for_user` | Applies renewal entitlement rules and extends the loan due date atomically. |
| `rpc_pay_reader_charges_for_user` | Settles reader charges and records the receipt. |
| `rpc_submit_book_review_for_user` | Validates loan history and stores book rating and review text. |

*Command surface:* Twenty-four business Edge Function directories are present, excluding `_shared` and the `hello` health-check function: `add-copies`, `cancel-reservation`, `cancel-writeoff-slip`, `change-copy-status`, `checkout-cart`, `complete-simulated-payment`, `complete-writeoff-slip`, `handover-items`, `import-books`, `inventory-history`, `lookup-isbn`, `mark-loan-lost`, `pay-reader-charges`, `record-counter-payment`, `register-student`, `renew-loan`, `reserve-book`, `return-loan`, `save-book`, `save-writeoff-slip`, `send-reminders`, `set-books-collection`, `submit-book-review`, and `toggle-wishlist`. §12 records which of the components above are implemented versus still to be built.

---

## 8. ShelfHelp API — business command map

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

The map lists every command and job handler the API exposes across PA1–PA5, grouped by family. Twenty-four business function directories are implemented in `src/supabase/functions/`; the families below also name handlers that PA5 will add. See §12 for the implemented-versus-planned split.

| Family | Functions | Main data touched | Use cases |
| :--- | :--- | :--- | :--- |
| **Account** | `register-student`, `set-account-inactive`, `reactivate-account`, `restore-account`, `request-restore-review`, `list-sessions`, `revoke-session`, `revoke-other-sessions` | `auth.users`, `auth.sessions`, `profiles`, `audit_logs` | UC-01–UC-04, UC-31, UC-32 |
| **Catalog** | `lookup-isbn`, `save-book`, `import-books`, `add-copies`, `change-copy-status`, `set-books-collection`, `inventory-history` | `books`, `copies`, `copy_events`, `reviews` | UC-06, UC-07, UC-15, UC-19 |
| **Borrowing** | `checkout-cart`, `cancel-loan-item`, `switch-to-counter-payment`, `renew-loan`, `submit-book-review`, `pay-reader-charges`, `reserve-book`, `cancel-reservation`, `toggle-wishlist` | `loan_requests`, `loan_items`, `reservations`, `wishlist` | UC-08–UC-10, UC-12, UC-14 |
| **Money** | `create-payment`, `complete-simulated-payment`, `purchase-membership`, `record-counter-payment`, `create-manual-receipt`, `reverse-receipt` | `payments`, `payment_lines`, `memberships`, `receipts`, `charges` | UC-05, UC-10, UC-13, UC-18, UC-23 |
| **Circulation** | `handover-items`, `return-loan`, `mark-loan-lost` | `loan_items`, `copies`, `copy_events`, `charges` | UC-18, UC-20, UC-21 |
| **Write-off** | `save-writeoff-slip`, `complete-writeoff-slip`, `cancel-writeoff-slip` | `writeoff_slips`, `writeoff_slip_copies`, `copies`, `inventory_transactions` | UC-22 |
| **Acquisition** | `submit-suggestion`, `withdraw-suggestion`, `reject-suggestion`, `add-suggestion-to-batch`, `save-batch`, `mark-batch-ordered`, `mark-batch-line-received` | `suggestions`, `suggestion_groups`, `batches`, `batch_lines`, `batch_activity` | UC-16, UC-24, UC-25 |
| **Notification** | `send-reminders` | `notifications`, `email_outbox` | UC-30 |
| **Assistant** | `chat-send` | `chats`, `chat_messages`, `books.embedding` | UC-17 |
| **Scheduled jobs** | `job-nightly-loans`, `job-due-notifications`, `job-hold-expiry`, `job-payment-expiry`, `job-membership-reminders`, `job-pickup-warnings`, `job-email-outbox`, `job-embed-queue` | `loan_items`, `charges`, `reservations`, `payments`, `notifications`, `email_outbox`, `books.embedding` | UC-12, UC-14, UC-18, UC-28, UC-30 |

---

## 9. ShelfHelp API — interactions and design notes

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

### 9.1 Command sequence

1. The Web Application invokes a command Edge Function over HTTPS POST with the user's JWT.
2. The function executes the HTTP/CORS helper, verifies the caller via the auth guard, and parses the request payload using shared validation.
3. The handler evaluates business parameters using the shared domain rules (`@shelfhelp/shared`) and passes validated inputs to the RPC gateway.
4. The RPC gateway executes the target PostgreSQL stored procedure (RPC) via PostgREST HTTPS under a service-role transaction. All entity state mutations, inventory event records (`copy_events`), and audit entries (`audit_logs`) commit **atomically** in this single transaction. Idempotency keys are checked and persisted in the same transaction to guarantee exactly-once processing; database deadlocks are retried up to three times.
5. If the command involves external systems (for example simulated payment processing or dispatching notification email), the handler communicates with the provider through the integration adapters. Unexpected runtime exceptions are caught by the error logger.
6. The function returns the committed result payload or the standardized error envelope (`{ error: { reason, message, details } }`) to the browser.

### 9.2 Scheduled job sequence

1. `pg_cron` triggers a scheduled job according to its UTC cron expression and calls the corresponding job Edge Function through `pg_net` with an internal authorization secret header (`x-job-secret`).
2. The job handler loads domain parameters and invokes the designated PostgreSQL batch RPCs via the command gateway.
3. The execution result (status, duration, items processed, error messages) is recorded in `job_runs` by the job tracker component. Unexpected failures are forwarded to operational monitoring.

### 9.3 Design notes

- **Domain rule distribution and test parity:**
  Pure business calculation logic (fine rates, damage tier percentages, borrowing limits) exists in both TypeScript (`@shelfhelp/shared`) for frontend preview/validation and in PostgreSQL stored procedures (`rpc_process_return_with_evidence_for_admin`, among others) for atomic transactional execution. To keep the two from drifting, CI runs pgTAP database tests (`src/supabase/tests/circulation_test.sql`), with Vitest unit tests against the same shared test vectors planned for PA5.
- **Server-authoritative RPC execution:**
  All transactional mutation RPCs are `SECURITY DEFINER`, with `EXECUTE` revoked from `PUBLIC`, `anon`, and `authenticated` and granted strictly to `service_role`. Clients cannot invoke mutation RPCs directly through PostgREST; every write originates from an authorized Edge Function.
- **Atomic audit logging vs operational reporting:**
  `audit_logs`, `copy_events`, and `inventory_transactions` are written inside the SQL RPC transaction, so audit rows commit atomically with business data. Cron outcomes (`job_runs`) are written outside the transaction at the handler level.
- **Thin handlers:** Handlers only validate requests, authorize callers, and orchestrate the RPC; domain rules live in `@shelfhelp/shared` and in the transactional SQL RPCs.
- **One transaction per command:** The transaction lives in a SQL RPC. The gateway adds idempotency and retry; it does not hold an open multi-statement client transaction itself.
- **Fixed lock order:** `profiles` → `books` → `copies` in ascending id; checkout selects copies with `FOR UPDATE SKIP LOCKED`.
- **Idempotency:** A repeated request with the same user and idempotency key returns the previously stored response without duplicate side effects.
- **Adapters:** A provider change changes only the adapter implementation, keeping domain rules unaffected.
- **Error contract:** Failures use `{ error: { reason, message, details } }`; `STATUS_CHANGED` carries the current status.
- **No secrets in the client:** The service-role key, database URL, and provider keys exist only in function secrets and CI.
- **Sign-in lockout and persistent sessions (`UC-02`):** Failed sign-in throttling (five consecutive failures per email or Student ID within 15 minutes → 10-minute server-enforced lockout returning HTTP 429 with `Retry-After`, paired with per-IP/device rate limiting) clears on a successful sign-in or password reset. The Web Application never stores passwords; *"Keep me signed in"* persists only the revocable refresh token in `localStorage` (or `sessionStorage` when unchecked).
- **Server-side active-session inventory and revocation (`UC-32`):** Because `auth.sessions` is not exposed through PostgREST, `list-sessions`, `revoke-session`, and `revoke-other-sessions` run in Edge Functions using `service_role` against the Supabase Auth Admin API. They derive caller identity solely from the verified JWT (never accepting `user_id` from the request body), omit raw tokens, treat revocation as idempotent, write `audit_logs` entries after Auth confirms, and leave ending the current session exclusively to normal sign-out (`UC-02`).

---

## 10. Shared code and cross-cutting concerns

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

Shared TypeScript modules carry the cross-cutting contracts used by both the browser and the Edge Functions.

| Shared area | Used by | Purpose |
| :--- | :--- | :--- |
| **Types and state enums** | Web App, API, tests | Loan item, reservation, copy, account, payment and charge states that match database `CHECK` constraints. |
| **Reason codes** | Web App, API, tests | The single error vocabulary and HTTP status mapping. |
| **Domain rules** | Web App, API, tests | Borrowing entitlements, gating checks, fine and damage calculations, reservation promotion and loss handling. |
| **Validation schemas** | Web App, API | One schema per command input, shared by the browser form and the handler. |
| **Presentation components** | Web App | Feature and layout components plus the shared presentation kit used by every feature. |

---

## 11. Traceability

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

| View element | Feature groups | Use cases |
| :--- | :--- | :--- |
| App Shell & Access Guard | All | All |
| Authentication & Profile | Accounts, identity, profile, active sessions | UC-01–UC-04, UC-32 |
| Catalog & Discovery | Catalog, search, barcode, wishlist | UC-06–UC-08, UC-15 |
| Cart & Checkout | Cart, checkout, payment | UC-09, UC-10 |
| My Library | Membership, loans, renewals, reservations, charges | UC-05, UC-11–UC-14, UC-18 |
| Notifications & Assistant | Notifications, suggestions, assistant | UC-16, UC-17, UC-28 |
| Admin Circulation & Queues | Desk circulation, queues, reminders | UC-20, UC-21, UC-29, UC-30 |
| Admin Catalog & Inventory | Catalog, copies, barcode, import, inventory, write-off | UC-07, UC-19, UC-22, UC-26 |
| Admin Money & Reporting | Receipts, ledger, analytics | UC-13, UC-23, UC-27 |
| Admin Acquisitions & Students | Acquisitions, student accounts | UC-24, UC-25, UC-31 |
| Data Access & Realtime Client | All read and command paths | All |
| API command families | See §8 | UC-01–UC-32 |
| API job handlers | Fines, holds, payments, reminders, embeddings | UC-12, UC-14, UC-18, UC-28, UC-30 |
| API adapters | Email, payment, AI, ISBN | UC-01, UC-03, UC-05, UC-10, UC-13, UC-17, UC-19, UC-24, UC-25, UC-28, UC-30 |
| API job tracking & error logger | Background jobs, operational error tracking | UC-12, UC-14, UC-18, UC-28, UC-30 |

---

## 12. Implementation status

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

This section is the single place where implementation status is recorded, so the views above can describe the target architecture without interruption. Status refers to repository code through migration `0018` at the time of writing; the code remains the authority.

| Area | Built | Still to build |
| :--- | :--- | :--- |
| **Web Application features** | App Shell and guards, authentication, catalog and discovery, cart and checkout, loans, reservations, fines, admin circulation and queues, admin catalog and inventory, admin ledger | Suggestion and assistant screens, acquisition and student-account screens, dashboard KPI cards and report exports, route-level code-splitting |
| **API components** | HTTP/CORS helpers, auth guard, request validation, business command handlers, direct RPC execution, `lookup-isbn` over direct HTTP | Command Execution & RPC Gateway as a separate retry/idempotency layer, Integration Adapters, Scheduled Job Handlers, Job Tracking & Error Logger |
| **Commands** | The twenty-four function directories listed in §7.1 | Session management (`list-sessions`, `revoke-session`, `revoke-other-sessions`), receipt reversal and manual receipts, membership purchase, `chat-send`, acquisition commands, and the `job-*` families |
| **Database** | Profiles, catalog, copies, loans, reservations, charges, payments, receipts, write-off slips, inventory history, `notifications`, `reservation_strike_events`; RLS, constraints, triggers, mutation RPCs restricted to `service_role`; text search via `unaccent`/`pg_trgm`/`tsvector` | `audit_logs`, `copy_events`, `memberships`, `email_outbox`, `suggestions`, `batches`, `chats`, `job_runs`, `settings`; HNSW-backed vector retrieval |
| **Scheduled work** | `pg_cron` and `pg_net` extensions enabled; `send-reminders` invocable by an admin | Cron schedules and the `job-*` handlers for fines, expiry, reminders, email outbox and embeddings |
| **Shared code** | Types, state enums, reason codes, selected helpers and presentation components | Complete entitlement, fine, promotion and loss rule set; universal shared validation schemas |
| **UC-02 hardening** | Client-side handling of a 429 response | Server-enforced failed-sign-in lockout and throttling, selectable session persistence with refresh-token-only storage |
| **UC-32 hardening** | — | Server-side active-session inventory and revocation against the Auth Admin API |

---

## 13. Deliberate omissions

**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

- **Individual pages and dialogs.** Each feature component contains several routes and modals.
- **Individual function folders.** The API diagram groups functions into command and job families; §8
  lists every function.
- **Database objects.** Tables, policies, triggers, and RPCs are documented in the specification and
  migrations.
- **Managed service internals.** Auth, Storage, and Realtime are black boxes by design.
- **Shared UI and validation libraries.** Selected shared components and helpers are noted in §3 and §10.

Source diagrams: `mermaid/component-webapp-reader.mmd`,
`mermaid/component-webapp-admin.mmd`,
`mermaid/component-api-request.mmd`,
`mermaid/component-api-scheduled-job.mmd`.
