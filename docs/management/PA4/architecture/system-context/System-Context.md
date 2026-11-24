# ShelfHelp: Smart Library Management System

## PA4 Software Architecture — Technology Stack and System Context (C4 Level 1)

### Revision history

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 23/Nov/2026 | 1.0 | Initial system context and technology stack | Nguyễn Anh Khôi |
| 23/Nov/2026 | 1.1 | Modelled Supabase as an external platform dependency; separated the email provider | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.2 | Added cross-links to the Level 2 and Level 3 views; included Realtime in the platform description | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.3 | Aligned context relationships and trimmed duplicated traceability and external-system detail | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.4 | Clarified client direct write scope, documented RPC EXECUTE restrictions, and trimmed redundant technology stack detail | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.5 | Restated the frontend versions as the installed React 19.3.1 / Vite 8.3.5, aligning with the deployment view | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.6 | Applied the locked React 19.3.1 / Vite 8.3.5 notation consistently in §3.1 and §3.2 | Nguyễn Anh Khôi |

### Table of contents

- [1. Introduction](#1-introduction)
- [2. Architecture overview](#2-architecture-overview)
- [3. Technology stack](#3-technology-stack)
- [4. C4 Level 1 — System Context](#4-c4-level-1--system-context)

---

## 1. Introduction

### 1.1 Purpose

This document records the software architecture of ShelfHelp, the university library management system. It delivers the two PA4 requirements:

1. **Technology stack** — the frontend, backend, database, authentication, storage, and external services used by the system.
2. **C4 Model Level 1** — a System Context diagram in Mermaid, with a written explanation of the system, its users, and its external dependencies.

### 1.2 Scope

The document covers the whole product scope from PA1 through PA4, including the authentication slice delivered in PA3 and the circulation, queue, and reader loan/fine slice delivered in PA4. The C4 view also includes integrations already committed in the specification for PA5, because the system boundary will not change when those features are built.

### 1.3 References

| ID | Document | Use in this document |
| :--- | :--- | :--- |
| R1 | [`SHELFHELP_FULLSPEC.md`](../../../../../src/speckit/specs/SHELFHELP_FULLSPEC.md) | Authoritative requirements specification |
| R2 | [`docs/DECISIONS.md`](../../../../DECISIONS.md) | Recorded architectural decisions |
| R3 | [`Vision Document`](../../../PA2/vision-document/Vision-Document.md) | Stakeholders and feature catalogue (`FEAT-01`–`FEAT-26`) |
| R4 | [`Use-Case Diagrams`](../../../PA3/use-case-diagrams/Use-Case-Diagrams.md) | Actors and the 31 use cases |
| R5 | [`Use-Case Specifications`](../../../PA3/use-case-specifications/) | Detailed UC-01 to UC-31 descriptions |
| R6 | [`Project Plan`](../../../PA3/project-plan/Project-Plan.md) | Phase plan and Build 2 scope |

---

## 2. Architecture overview

### 2.1 Architectural style

ShelfHelp is a React single-page application backed by the managed **Supabase platform**. The browser reads data through PostgREST under Row Level Security (RLS); core business writes run in server-side Supabase Edge Functions that execute single-transaction PostgreSQL RPCs. Direct client writes via PostgREST are restricted to personal user data under strict RLS: personal `cart_items` (own rows) and `profiles` contact fields (enforced via column-level grants and triggers to prevent clients from updating protected columns like `role` or `status`). There is no custom long-running backend server. Scheduled work (overdue fines, reminders, expiry, email delivery, embeddings) runs through `pg_cron` and Edge Functions.

The team owns the application code, database schema, Edge Functions, and policies, but does not operate the Supabase infrastructure. The platform is therefore modelled as an external dependency at C4 Level 1 (see §4), and its managed services are shown explicitly in the [Level 2](../container/Container.md) view. This style keeps the deployable simple for a five-person team while still providing transactional integrity, server-side authorization, and a single source of truth for data.

### 2.2 System capabilities

The system provides the following capabilities in two modes over one shared backend. Together they cover all 31 use cases and all 26 features in the PA2 catalogue.

| Area | Capabilities |
| :--- | :--- |
| **Identity and membership** | Self-registration and email verification, sign-in/out, credential recovery, profile and avatar, two membership tiers with entitlement snapshots |
| **Catalog and discovery** | Book and copy maintenance, diacritic-insensitive search and filters, browsing, ISBN barcode lookup, book detail, reviews, wishlist |
| **Borrowing and fulfilment** | Cart, atomic checkout, copy holds, 48-hour pickup window, online or counter payment, handover, return, renewal, lost-book resolution |
| **Reservations and acquisitions** | FIFO reservation queues with automatic promotion and strikes, student suggestions, acquisition batches, shipment receipt |
| **Money and inventory** | Charges and payments, immutable receipts and reversals, copy status history, write-off slips with evidence |
| **Administration and insight** | Student account management, reservation queues, reminders, notification centre, dashboards and report exports, grounded AI recommendations |

### 2.3 Key principles

| Principle | Meaning |
| :--- | :--- |
| **Server-authoritative writes** | Protected business tables have no client write policy. Loans, copies, payments, receipts, charges, memberships, and reservations are written only by Edge Functions. All transactional write RPCs are defined as `SECURITY DEFINER` with `EXECUTE` revoked from `PUBLIC`, `anon`, and `authenticated`, and granted exclusively to `service_role`. |
| **One command, one transaction** | Checkout, handover, return, payment, and renewal either commit completely or roll back completely. |
| **Shared domain logic** | Entitlements, gating, fines, reservation promotion, and loss handling live in `src/shared` and are reused by functions, the browser, and tests. |
| **Defence in depth** | RLS filters rows, Edge Functions check role and account status, and database constraints and triggers enforce invariants. |

### 2.4 Delivery across PA1–PA4

| Phase | Added in this phase | Architectural elements exercised |
| :--- | :--- | :--- |
| **PA1** | Project proposal, actors, feature list | Problem scope and initial technology direction |
| **PA2** | Vision document, Spec Kit setup, requirement IDs | Feature catalogue, quality attributes, traceability |
| **PA3** | 31 use cases, UI prototypes, first FR (authentication) | React auth screens, `register-student` function, `profiles`/`books`/`copies` schema, RLS, auth triggers |
| **PA4** | Architecture baseline, circulation and reader loan/fine slice | `handover-items`, `return-loan`, `record-counter-payment`, `cancel-reservation`, circulation/queue tables and RPCs, reader loans/fines/reservations and admin circulation/queues/ledger screens |
| **PA5** *(planned)* | Final release | Catalog administration, cart/checkout, acquisitions, receipts, analytics, reminders, assistant, and the remaining command and job functions |

In the PA4 circulation test slice, loan requests and items for handover testing are provided via deterministic database seeds (`src/supabase/seed.sql`) and direct staff counter operations, prior to the student self-service `checkout-cart` flow planned for PA5.

---

## 3. Technology stack

### 3.1 Stack at a glance

| Layer | Technology | Version / status | Role |
| :--- | :--- | :--- | :--- |
| **Frontend** | React + Vite; JavaScript/JSX UI, strict TypeScript in the shared package | React 19.3.1, Vite 8.3.5 | Reader and admin SPA |
| **Backend logic** | Supabase Edge Functions (Deno, TypeScript) | Deployed on Supabase | One function per business command; validation, authorization, one transaction |
| **Database** | Supabase PostgreSQL | 15 (managed) | Primary store, constraints, triggers, RLS, search, scheduling |
| **Authentication** | Supabase Auth | Managed service | Identity, verification, password reset, JWT with role claim |
| **Cloud storage** | Supabase Storage | Managed service | Covers, avatars, evidence photos, CSV imports |
| **Scheduling** | `pg_cron` + `pg_net` | Extensions | Nightly jobs, reminders, expiry, email outbox, embeddings |
| **External APIs** | Email provider, payment simulator, embedding API, LLM API, Google Books, Open Library | See §3.7 | Email, payments, RAG, ISBN metadata |
| **Hosting** | Static host + CDN (Vercel) | Deployment | Serves the SPA over HTTPS |
| **CI/CD and testing** | GitHub Actions, Supabase CLI, Docker, Vitest, Playwright, pgTAP, MSW | Development | Build, migrations, quality gates |

Supabase is a single managed platform that provides the function runtime, PostgreSQL, Auth, Storage, and scheduled jobs. The team owns the schema, functions, and policies deployed there; the infrastructure is operated by Supabase, which is why it appears as an external system in §4.2.



### 3.2 Frontend

The frontend is a responsive **React 19.3.1 + Vite 8.3.5** application. Reader Mode is mobile-first; Admin Mode is desktop-first. Reader and admin routes are separate lazy-loaded bundles so admin code is never shipped to students.

- **Routing and access:** React Router with guards by session, role, and account status. Students opening `/admin/*` receive a 403 page; staff are redirected to `/admin`.
- **Data and forms:** TanStack Query with `supabase-js` for server state; React Hook Form with Zod schemas shared with Edge Functions so client and server validation agree.
- **UI:** Tailwind CSS with shadcn/ui (Radix) for accessible components; Recharts for dashboards; react-i18next and date-fns for English UI and `Asia/Ho_Chi_Minh` formatting.
- **Specialised features:** `@zxing/browser` for ISBN scanning, JsBarcode and a PDF library for label sheets, PapaParse/ExcelJS for import and export, pdfmake for Vietnamese-capable PDFs, and react-easy-crop for avatars.
- **Language note:** the UI is currently JavaScript/JSX; the shared domain and type contracts are strict TypeScript, following an incremental path toward an all-TypeScript frontend.

### 3.3 Backend

The backend logic is a set of **stateless Supabase Edge Functions** written in TypeScript on Deno and deployed on the external Supabase platform. Each function validates the request, authenticates the caller, authorizes the action, runs the shared domain logic, and writes inside one PostgreSQL transaction.

- **Commands:** account, catalog, borrowing, money, circulation, write-off, acquisition, notifications, and assistant functions (for example `register-student`, `checkout-cart`, `handover-items`, `return-loan`, `purchase-membership`, `reverse-receipt`, `chat-send`).
- **Reads:** simple reads use PostgREST under RLS. Complex reads use SQL RPCs such as `search_books` and `get_dashboard_kpis`.
- **Concurrency and idempotency:** row-level locks in a fixed order; checkout uses `FOR UPDATE SKIP LOCKED`; every mutation accepts an idempotency key so retries do not duplicate effects.
- **Adapters:** `EmailProvider`, `PaymentProvider`, `Embedder`, `LlmClient`, and `IsbnLookup` isolate third-party services from business rules.

### 3.4 Database

**Supabase PostgreSQL 15** is the system of record. Supabase operates the database server; the team owns the schema, migrations, RLS policies, and transactional RPCs.

- **Schema as code:** migrations under `src/supabase/migrations/`, applied by CI and not manual dashboard edits.
- **Integrity:** UUID keys, `timestamptz` in UTC, integer VND amounts, `CHECK` constraints for every status, and unique indexes preventing double holds, duplicate active loans, and repeated receipt reversals.
- **Immutability:** `receipts`, `inventory_transactions`, `audit_logs`, `settings_history`, and `copy_events` reject updates and deletes.
- **Search:** `unaccent`, `pg_trgm`, full-text `tsvector` columns, and a `pgvector` HNSW index support Vietnamese search and RAG retrieval.
- **Security:** RLS is enabled on every table; a table without a policy is unreadable. Students see their own rows; staff see what their screens need.

### 3.5 Authentication and authorization

- **Supabase Auth**, a managed service of the Supabase platform, handles registration, email verification, sign-in/out, and password reset. The browser uses PKCE and auto-refreshes the session. Verification, reset, and notification messages leave through the external email provider described in §3.7.
- **Role:** `app_metadata.role` in the JWT is the source of truth (`student` or `admin`). `profiles.role` is a display copy. Both are written only by server code.
- **Authorization:** RLS enforces row access; Edge Functions additionally check role, account status (`active`, `restricted`, `inactive`), debt hold, membership entitlement, and reservation ban.
- **Revocation and bots:** every function reloads `profiles.status`, so a deactivated admin is refused even with an old token; Cloudflare Turnstile protects register, login, and reset.
- **Secrets:** only the Supabase URL and anon key reach the browser. The service-role key and provider keys exist only in Edge Function secrets and CI.

### 3.6 Cloud file storage

**Supabase Storage**, a managed service of the Supabase platform, holds binary assets.

| Bucket | Visibility | Write | Read | Limit |
| :--- | :--- | :--- | :--- | :--- |
| `covers` | Public read | Staff | Anyone | 1 MB; JPEG/PNG/WebP |
| `avatars` | Private | Owner (`{uid}/avatar.jpg`) | Owner and staff via signed URL | 300 KB; JPEG |
| `evidence` | Private | Staff | Staff via signed URL | 2 MB; JPEG/PNG/WebP |
| `imports` | Private | Staff | Staff; deleted after 7 days | 2 MB; CSV |

Policies check the bucket, the caller's role, and avatar ownership. Bucket settings enforce size and MIME type.

### 3.7 External APIs and service integrations

| Service | Purpose | Failure behaviour |
| :--- | :--- | :--- |
| SMTP / transactional email provider (Resend, Brevo, or SendGrid) | Delivery of verification, reset, and notification email | Retries through the outbox; the in-app notification remains |
| Payment provider (simulator) | Membership, Premium fee, fine, damage, and loss payments; refunds | Deterministic simulator behind `PaymentProvider`, which can be replaced by a real gateway |
| Embedding API | Vectors for books and queries (English/Vietnamese) | Assistant falls back to keyword retrieval |
| LLM API (for example Claude) | Query rewrite and grounded answer | Assistant shows the retrieved book list without synthesis |
| Google Books, Open Library | ISBN metadata during cataloguing and import | Manual entry fallback |
| Cloudflare Turnstile | CAPTCHA on authentication forms | User retries |
| Sentry | Error and performance monitoring | Captured silently without blocking user workflows |

### 3.8 Hosting, CI/CD, and testing

- **Hosting & Environments:** The SPA is deployed to a static host and global CDN over HTTPS; the backend is hosted on Supabase. Environments span local Docker stacks, automated CI, and cloud deployment (detailed in [Container view §6](../container/Container.md#6-deployment-and-environments)).
- **CI/CD:** GitHub Actions executes linting, type-checking, pgTAP database tests, Edge Function integration tests, and Playwright end-to-end tests.
- **Testing:** Vitest and React Testing Library for domain/UI, pgTAP for database schema/RPC invariants and RLS, and Playwright for critical user journeys.

---

## 4. C4 Level 1 — System Context

### 4.1 Purpose of the view

The System Context view shows ShelfHelp as a single system, the people who use it, and the external systems it depends on. In the diagram, the two people are shown as person shapes, ShelfHelp is the single system box, external systems are the grey boxes, and each arrow is a directed dependency labelled with its purpose and protocol. Ownership, not hosting, defines the boundary: the team's application, schema, Edge Functions, and policies are inside ShelfHelp even though they run on the Supabase platform. The platform is shown as one external system at this level and is decomposed in the Level 2 view.

### 4.2 System Context diagram

```mermaid
C4Context
    title System Context diagram — ShelfHelp: Smart Library Management System

    Person(student, "Student (Reader)", "Searches, borrows, reserves and pays for library material.")
    Person(librarian, "Librarian (Admin)", "Runs catalog, circulation, money, acquisitions and reporting.")

    System(shelfhelp, "ShelfHelp", "Reader and admin web applications plus the library logic and configuration deployed on the Supabase platform.")

    System_Ext(supabase, "Supabase Platform", "Managed backend: Auth, PostgreSQL, Storage, Realtime, Edge Functions and scheduled jobs.")
    System_Ext(email, "Email Delivery Provider", "SMTP relay or transactional email service for verification, reset and notification email.")
    System_Ext(payment, "Payment Provider (simulator)", "Online payment gateway behind the PaymentProvider adapter.")
    System_Ext(ai, "AI Provider", "Embedding and LLM APIs for grounded research recommendations.")
    System_Ext(isbn, "Bibliographic Metadata Services", "Google Books and Open Library ISBN metadata.")

    Rel(student, shelfhelp, "Uses Reader Mode", "HTTPS")
    Rel(librarian, shelfhelp, "Uses Admin Mode", "HTTPS")
    Rel(shelfhelp, supabase, "Stores data, authenticates users, hosts backend functions", "HTTPS")
    Rel(shelfhelp, email, "Notification email", "SMTP/HTTPS")
    Rel(supabase, email, "Verification and reset email", "SMTP")
    Rel(shelfhelp, payment, "Payments and refunds", "HTTPS")
    Rel(shelfhelp, ai, "Embeddings and grounded answers", "HTTPS")
    Rel(shelfhelp, isbn, "ISBN metadata lookup", "HTTPS")
```

The source is also stored as [`mermaid/system-context.mmd`](mermaid/system-context.mmd). §4.4 and §4.5 explain each element and relationship, so the document remains complete even in a renderer without C4 support.

The next views refine this diagram: the [C4 Level 2 Container view](../container/Container.md) opens the ShelfHelp box into the Web Application, ShelfHelp API, and database containers, and decomposes the remaining platform services; the [C4 Level 3 Component view](../component/Component.md) then details the two core application containers.

### 4.3 People (actors)

| Actor | Description | Main goals | Use cases |
| :--- | :--- | :--- | :--- |
| **Student (Reader)** | University student using Reader Mode on a phone or laptop; may be a non-member or a Premium member. | Find and borrow books, manage loans and charges, reserve titles, suggest acquisitions, get AI recommendations | UC-01 to UC-18, UC-28 |
| **Librarian (Admin)** | Library staff using Admin Mode on a desktop; holds the single `admin` role. | Maintain the catalog, run circulation, manage money, acquisitions, students, and reports | UC-02, UC-04, UC-13, UC-18, UC-19 to UC-31 |

Staff accounts cannot borrow; a staff member who is also a student uses a separate student account. The two roles do not form a generalisation hierarchy.

### 4.4 External systems

| External system | What it provides | Interaction with ShelfHelp |
| :--- | :--- | :--- |
| **Supabase Platform** | Managed backend: PostgreSQL, Auth, Storage, Realtime, Edge Functions runtime, scheduled jobs | The team's schema, functions, and policies are deployed there. The browser reads via PostgREST under RLS and authenticates through Supabase Auth; business writes run in Edge Functions and commit in one PostgreSQL transaction |
| **Email Delivery Provider** | Delivery of verification, reset, and notification email | Supabase Auth sends verification and reset mail through the configured SMTP relay; application notifications leave through the email outbox to the same provider |
| **Payment Provider (simulator)** | Online payment and refunds | ShelfHelp sends purpose, amount, and reference, then records the settlement; the simulator implements the `PaymentProvider` interface |
| **AI Provider** | Embeddings and grounded answer generation | ShelfHelp sends query text and book metadata only; retrieved book ids are validated server-side; no student identity or borrowing history is sent |
| **Bibliographic Metadata Services** | ISBN metadata (title, authors, publisher, year, description) | Used only during cataloguing and import; failure falls back to manual entry |

**Supporting services.** Static hosting, Cloudflare Turnstile, Sentry, and the CI toolchain are operational dependencies rather than business systems. They are described in §3.7 and §3.8 instead of being drawn as external system boxes.

### 4.5 Explanation of the diagram

**The system.** ShelfHelp is one software system containing both Reader and Admin experiences and the server-side library logic. Users reach it over HTTPS; there is no native app and no public third-party API.

**The two actors.** The Student uses Reader Mode for personal goals: discovery, borrowing, payments, reservations, suggestions, notifications, and the assistant. The Librarian uses Admin Mode for operational goals: catalog accuracy, circulation, money, acquisitions, student management, and reporting. Both relationships represent browser traffic; the difference is the role and the authorized capabilities behind it.

**External dependencies.** The platform and the four providers are described in §4.4. Each is outside ShelfHelp's ownership and is reached only through its published interface. The arrows show runtime use, not deployment steps.

### 4.6 Scope boundaries and assumptions

**Out of scope:** a real payment gateway, university student-information-system integration, procurement systems, e-books, native mobile apps, inter-library loan, multiple branches, offline mode, and self-hosted Supabase or other server infrastructure.

**Assumptions:** one library branch and one staff role; students have institutional email addresses; the catalog stays around or below 50,000 titles, where PostgreSQL search is sufficient; payment is simulated and no card data is processed; email is best-effort with an in-app notification as the durable record; Supabase remains the managed platform and hosting provider for the backend.

Feature and use-case traceability is maintained in the [Level 2 container view](../container/Container.md#7-traceability-to-pa1pa4) and the [Level 3 component view](../component/Component.md#11-traceability).
