# ShelfHelp: Smart Library Management System

## PA4 Software Architecture — Deployment View (C4 Deployment)

### Revision history

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 24/Nov/2026 | 1.0 | Initial deployment architecture: container-to-infrastructure mapping, production C4 deployment diagram, node catalogue, and environment topologies | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.1 | Unified Vercel hosting, edge execution vs ap-northeast-2 database topology, HTTPS protocols, Node.js storage, and Supabase Pro backup SLA | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.2 | Edge Functions pinned to `ap-northeast-2`; platform services separated from team-owned containers; Dev/Staging environment added; supporting-service rows (Turnstile, Sentry); plan-assumption note; browser version floor removed | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.3 | §1.2 topology sentence rewritten; Turnstile removed from the diagram so supporting services are diagrammed consistently; rate-limit sentence removed from §6.2 | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.4 | Deployment diagram presented as a rendered image with the client-to-platform edges aggregated; node catalogue rounded out with the Edge Functions and managed-services rows | Nguyễn Anh Khôi |
| 24/Nov/2026 | 1.5 | Region corrected to AWS `ap-northeast-2` (Seoul) to match the provisioned Supabase project | Nguyễn Anh Khôi |

### Table of contents

- [1. Introduction](#1-introduction)
- [2. Mapping containers and platform services to infrastructure nodes](#2-mapping-containers-and-platform-services-to-infrastructure-nodes)
- [3. Deployment diagram](#3-deployment-diagram)
- [4. Infrastructure node catalogue](#4-infrastructure-node-catalogue)
- [5. Deployment environments](#5-deployment-environments)
- [6. Security, networking, and resilience](#6-security-networking-and-resilience)
- [7. Related views](#7-related-views)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the **Deployment Architecture** for ShelfHelp. It satisfies the PA4 course architecture submission requirements by mapping each software container defined in the [Container view](../architecture/container/Container.md) to the physical, virtualized, and managed cloud infrastructure nodes that execute it, specifying the hardware/cloud services used, running containers, and inter-node communication protocols.

### 1.2 Scope

The deployment architecture covers the complete product lifecycle from PA1 through PA4 and planned PA5 features:

1. **Production cloud topology:** Vercel serves the static SPA from its global CDN; Supabase Edge Functions, database, Auth, Storage and Realtime all run in AWS `ap-northeast-2` (Seoul).
2. **Local development topology:** Containerized local development stack orchestrated via Docker Desktop and the Supabase CLI.
3. **Continuous Integration (CI) topology:** Automated ephemeral test runners managed by GitHub Actions.

### 1.3 References

| ID | Document | Use in this document |
| :--- | :--- | :--- |
| R1 | [`Container.md`](../architecture/container/Container.md) | Authoritative software container catalogue and protocols (C4 Level 2) |
| R2 | [`System-Context.md`](../architecture/system-context/System-Context.md) | External systems and technological foundations (C4 Level 1) |
| R3 | [`Component.md`](../architecture/component/Component.md) | Internal module decomposition of Web Application and API (C4 Level 3) |
| R4 | [`SHELFHELP_FULLSPEC.md`](../../../../src/speckit/specs/SHELFHELP_FULLSPEC.md) | System requirements, operational parameters, and deployment baseline |
| R5 | [`requirements.md`](requirements.md) | Coursework deployment submission requirements |
| R6 | [`DECISIONS.md`](../../../DECISIONS.md) | Recorded architectural decisions |

---

## 2. Mapping containers and platform services to infrastructure nodes

The table below maps every runtime element of the production topology to the infrastructure node that executes it. The ownership boundary follows [Container.md §2](../architecture/container/Container.md#2-relationship-to-the-level-1-view) and §4: the Web Application, the ShelfHelp API, and the PostgreSQL database are team-owned containers; Supabase Auth, Storage, and Realtime are managed platform services the team configures but does not operate; the remaining rows are external third-party systems.

| Runtime element | Element type | Target infrastructure node | Cloud / Hardware platform |
| :--- | :--- | :--- | :--- |
| **ShelfHelp Web Application** | Team-owned container (client-side SPA bundle) | **User Web Browser**, loaded from the global asset CDN | Client device (mobile/laptop) via the Vercel Edge Network |
| **ShelfHelp API** | Team-owned container (stateless serverless functions) | **Edge Functions Runtime Node** | Supabase Edge Runtime, Deno V8 isolates pinned to the project region `ap-northeast-2` alongside the database (see §4.3.1) |
| **PostgreSQL Database** | Team-owned container (schema, RLS, RPCs) on managed infrastructure | **Managed Database Server Node** | Supabase Managed PostgreSQL 15 on Linux, AWS `ap-northeast-2`, paid plan assumed for production (§6.3) |
| **Supabase Auth** | Managed platform service (not team-owned) | **Auth Service Node** | GoTrue microservice, Supabase Cloud, AWS `ap-northeast-2` |
| **Supabase Storage** | Managed platform service (not team-owned) | **Storage Service Node** | Supabase Storage, Node.js service backed by an S3-compatible object store, AWS `ap-northeast-2` |
| **Supabase Realtime** | Managed platform service (not team-owned) | **Realtime Cluster Node** | Supabase Realtime, Elixir / Phoenix Channels cluster, AWS `ap-northeast-2` |
| **Cloudflare Turnstile** | Supporting service (operational, not a business system) | **Bot Protection Edge Service** | Cloudflare Turnstile, configured as the Supabase Auth CAPTCHA |
| **Sentry** | Supporting service (operational, not a business system) | **Monitoring Cloud Service** | Sentry cloud, receiving browser and Edge Function error and performance events |
| **Email Delivery Provider** | External system | **Email Cloud Service** | Transactional SMTP / API (Resend, Brevo, or SendGrid) |
| **Payment Provider (simulator)** | External system | **Payment Gateway Service** | Cloud HTTPS payment simulator |
| **AI Provider** | External system | **AI Platform Infrastructure** | Cloud embedding and LLM inference endpoints |
| **Bibliographic Metadata Services** | External system | **Bibliographic Repositories** | Google Books and Open Library public REST APIs |

---

## 3. Deployment diagram

<details>
<summary>Mermaid source</summary>

```mermaid
%%{init: {"c4": {"c4ShapeMargin": 70, "width": 200, "c4ShapePadding": 12, "diagramMarginX": 20, "diagramMarginY": 20}}}%%
C4Deployment
    title Deployment diagram — ShelfHelp: Smart Library Management System (Production)
    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="2")

    Deployment_Node(cdn, "Static Hosting & Edge CDN", "Vercel, global Anycast CDN") {
        Container(spa_assets, "Static Web Assets", "HTML, JS, CSS, WebP", "Pre-built, minified SPA bundle")
    }

    Deployment_Node(browser, "Web Browser", "Laptop, desktop or smartphone; evergreen browser") {
        Container(webapp, "ShelfHelp Web Application", "React 19.3.1, Vite 8.3.5", "Client-side SPA; renders Reader Mode and Admin Mode")
    }

    Deployment_Node(supabase_platform, "Supabase Managed Platform", "AWS ap-northeast-2") {
        Deployment_Node(db_node, "Managed Database Server", "PostgreSQL 15 on Linux") {
            ContainerDb(db, "PostgreSQL Database", "Supabase Postgres 15", "System of record: tables, RLS, triggers, immutable ledgers, atomic RPCs, pg_cron")
        }
        Deployment_Node(edge_cluster, "Edge Functions Runtime", "Deno V8 isolates, ap-northeast-2") {
            Container(api, "ShelfHelp API", "Deno, TypeScript", "Stateless business command handlers and scheduled job runners")
        }
        Deployment_Node(managed_node, "Managed Platform Services", "Not team-owned") {
            Container_Ext(realtime, "Supabase Realtime", "Elixir / Phoenix Channels, WebSocket", "Live availability counters, notifications and loan updates under RLS")
            Container_Ext(auth, "Supabase Auth", "GoTrue, JWT, PKCE", "Identity, OTP email verification, sessions and role-bearing JWTs")
            Container_Ext(storage, "Supabase Storage", "Node.js, S3-compatible, bucket policies", "Covers, avatars, write-off evidence and CSV imports")
        }
    }

    Deployment_Node(external, "External Services", "Third-party cloud APIs") {
        System_Ext(payment, "Payment Provider Simulator", "HTTPS gateway behind the PaymentProvider adapter")
        System_Ext(ai, "AI Provider", "Cloud embedding and LLM APIs for grounded research assistant recommendations")
        System_Ext(isbn, "Bibliographic Metadata Services", "Google Books and Open Library ISBN APIs")
        System_Ext(email, "Email Delivery Provider", "SMTP relay / API (Resend, Brevo or SendGrid)")
    }

    Rel(browser, cdn, "Fetches static SPA bundle", "HTTPS")

    Rel(webapp, api, "Invokes transactional commands", "HTTPS, JWT")
    Rel(webapp, db, "Reads; writes own profile & cart", "PostgREST HTTPS, RLS")
    Rel(webapp, managed_node, "Auth, files, live updates", "PKCE (auth), signed URLs (files), WSS + RLS (live)")

    Rel(api, db, "Calls transactional RPCs", "PostgREST HTTPS, service role")
    Rel(db, api, "pg_cron triggers <br/> scheduled jobs <br/>", "HTTPS via pg_net")
    Rel(api, auth, "Verifies JWT, creates users", "HTTPS")
    Rel(realtime, db, "Reads change stream", "logical replication")

    Rel(api, payment, "Processes simulated payments & refunds", "HTTPS")
    Rel(api, ai, "Generates embeddings & RAG synthesis", "HTTPS")
    Rel(api, isbn, "ISBN lookup", "HTTPS")
    Rel(api, email, "Notification email", "HTTPS/SMTP")
    Rel(auth, email, "Verification/reset email", "SMTP")

    UpdateRelStyle(browser, cdn, $offsetX="-70", $offsetY="-40")

    UpdateRelStyle(webapp, api, $offsetX="0", $offsetY="-100")
    UpdateRelStyle(webapp, db, $offsetX="-90", $offsetY="-100")
    UpdateRelStyle(webapp, managed_node, $offsetX="-70", $offsetY="300")

    UpdateRelStyle(api, db, $offsetX="-70", $offsetY="-40")
    UpdateRelStyle(db, api, $offsetX="-40", $offsetY="25")
    UpdateRelStyle(api, auth, $offsetX="50")
    UpdateRelStyle(realtime, db, $offsetX="-125", $offsetY="-20")

    UpdateRelStyle(api, payment, $offsetX="-125", $offsetY="-40")
    UpdateRelStyle(api, ai, $offsetX="-10", $offsetY="-20")
    UpdateRelStyle(api, isbn, $offsetX="70", $offsetY="60")
    UpdateRelStyle(api, email, $offsetX="-20")
    UpdateRelStyle(auth, email, $offsetY="10")
```

</details>

![Deployment diagram: the Web Browser and the Vercel CDN, the Supabase Managed Platform in AWS ap-northeast-2 holding the PostgreSQL database, the Edge Functions runtime and the managed Auth, Storage and Realtime services, and the external Payment, AI, Bibliographic and Email providers](mermaid/deployment.png)

One relationship is drawn as a single aggregated edge to a platform boundary: the Web Application's
traffic to Supabase Auth, Storage and Realtime, labelled **PKCE (auth), signed URLs (files), WSS + RLS
(live)**. The arrow points at the *Managed Platform Services* boundary rather than at any one service.
Drawing the three client-to-service edges individually produces a dense crossing cluster that makes the
diagram unreadable at page width, so the aggregation is deliberate. The Web Application's edges to the
database and to the ShelfHelp API remain separate arrows.

Source: [`mermaid/deployment.mmd`](mermaid/deployment.mmd).

---

## 4. Infrastructure node catalogue

### 4.1 User Workstation / Mobile Device

| Property | Value |
| :--- | :--- |
| **Node type** | Client Physical Hardware & Browser Execution Environment |
| **Hardware / OS** | Student smartphones (iOS / Android), student laptops (macOS / Windows), librarian desktop workstations |
| **Execution container** | **ShelfHelp Web Application** executed within modern evergreen browsers (current versions of Google Chrome, Mozilla Firefox, Apple Safari, and Microsoft Edge). Camera barcode scanning varies across phones and browsers, so manual ISBN entry is always available as a fallback. |

**Description and responsibilities:**
The client hardware executes the compiled single-page application in browser memory. It renders both **Reader Mode** (optimized for mobile touchscreens and responsive viewports) and **Admin Mode** (optimized for multi-column desktop workflows), manages local routing state via React Router, and interfaces with device peripherals such as webcams for barcode scanning (`@zxing/browser`).

**Communication protocols:**
- **Static Hosting & CDN (Vercel):** Inbound download of static HTML/JS/CSS assets via **HTTPS (port 443)**.
- **PostgreSQL Database:** Catalog search and row reads, plus direct writes to personal `cart_items` and `profiles` contact fields via **PostgREST over HTTPS** under Row Level Security.
- **ShelfHelp API:** Invocation of business mutation commands over **HTTPS POST** with the caller's JWT bearer token.
- **Supabase Auth, Storage and Realtime** (one aggregated edge in the diagram, see §3):
  - **Supabase Auth:** Registration, OTP verification, and JWT session refresh over **HTTPS / PKCE**.
  - **Supabase Storage:** Upload of avatars and evidence photos and retrieval of book covers via **HTTPS** with signed URLs.
  - **Supabase Realtime:** Ingestion of live availability counters and personal loan notifications via persistent **WebSocket (WSS, port 443)**.

---

### 4.2 Static Hosting & Global Edge CDN

| Property | Value |
| :--- | :--- |
| **Node type** | Distributed Edge Content Delivery Network (CDN) |
| **Cloud platform** | Vercel Global Edge Network |
| **Deployed assets** | **Static Web Assets**: Compiled, minified HTML5, ES modules (JavaScript), CSS (Tailwind), and optimized SVGs/images |

**Description and responsibilities:**
Hosts the immutable build output produced by Vite. Deployed automatically via Git push triggers in CI. Edge nodes cache static assets across geographically distributed Points of Presence (PoPs), serving readers with minimal round-trip latency, automatic HTTP/2 and HTTP/3 multiplexing, and Gzip/Brotli compression. Non-asset URL paths rewrite to `/index.html` to support client-side HTML5 History API routing.

**Communication protocols:**
- **Web Browser:** Serves cached assets to client browsers over **HTTPS (port 443)** with automated SSL/TLS certificate management.
- **CI Runner (GitHub Actions):** Ingests new production releases via secure deployment webhooks/APIs over **HTTPS**.

---

### 4.3 Supabase Managed Platform

The Supabase project and every persistent backend service (database, storage, auth, and realtime) are provisioned in the **AWS Seoul region (`ap-northeast-2`)**. The Edge Functions runtime is **region-pinned to the same region**, because every ShelfHelp command executes as a single PostgreSQL transaction and therefore gains nothing from running at a distant edge PoP.

#### 4.3.1 Edge Functions Runtime Node

| Property | Value |
| :--- | :--- |
| **Node type** | Serverless function runtime node, colocated with the database region |
| **Cloud service** | Supabase Edge Runtime (isolated Deno V8 workers pinned to `ap-northeast-2`) |
| **Containers running** | **ShelfHelp API** (stateless business command handlers and scheduled background job functions) |

**Description and responsibilities:**
Executes stateless TypeScript functions on Deno V8 isolates that run in the same region as the database. Validates incoming JSON payloads against Zod schemas, extracts and verifies caller identity from JWT tokens, reloads profile status to enforce debt holds and suspension policies, applies `@shelfhelp/shared` domain logic, and routes commands to PostgreSQL stored procedures in `ap-northeast-2`.

**Communication protocols:**
- **Web Application:** Receives command requests over **HTTPS POST** with JWT bearer authentication.
- **PostgreSQL Database:** Invokes transactional stored procedures via **PostgREST HTTPS** using the internal `service_role` key, within the same region.
- **Supabase Auth:** Invokes GoTrue administrative endpoints over **HTTPS** to create and manage user records.
- **PostgreSQL Database (`pg_cron`):** Receives background job trigger requests over **HTTPS** initiated by `pg_net` bearing the `x-job-secret` header.
- **External Providers:** Dispatches outbound HTTPS/SMTP calls to Email, Payment, AI, and Bibliographic APIs.

#### 4.3.2 Managed Database Server Node

| Property | Value |
| :--- | :--- |
| **Node type** | Managed Relational Database Node |
| **Cloud service** | Supabase PostgreSQL 15 on Linux. Production assumes a paid plan, but a pilot may run on the free tier with the plan limits checked before launch. |
| **Containers running** | PostgreSQL Database (`public` schema, `auth` schema, `storage` schema, extensions: `pg_trgm`, `unaccent`, `pgvector`, `pg_cron`, `pg_net`) |

**Description and responsibilities:**
The primary system of record. Enforces data integrity through foreign keys, check constraints, immutable ledger triggers, and deny-by-default Row Level Security (RLS). Houses all core transactional business logic inside security definer RPCs (`rpc_confirm_handover`, `rpc_process_return`, etc.), where mutation RPC execution is restricted strictly to `service_role`. Manages full-text search indexes (`tsvector`), vector similarity search (`pgvector` HNSW indexes), and scheduled crons via `pg_cron`.

**Communication protocols:**
- **Web Application:** Serves client reads and personal profile/cart writes over **PostgREST HTTPS** filtered by RLS.
- **ShelfHelp API:** Accepts RPC invocations from Edge Functions over **PostgREST HTTPS** authenticated via `service_role`.
- **Supabase Realtime:** Streams Write-Ahead Log (WAL) events to the Realtime cluster via **PostgreSQL logical replication**.
- **ShelfHelp API (`pg_cron`):** Dispatches outbound HTTP requests to Edge Function job handlers via the **`pg_net`** extension over HTTPS.

#### 4.3.3 Supabase Managed Platform Services

These three services are managed platform services, not team-owned containers ([Container.md §2](../architecture/container/Container.md#2-relationship-to-the-level-1-view)): the team configures them through platform settings and policies but does not operate their internals, so they are drawn as external containers on the Supabase node.

| Service node | Platform technology | Service running | Description & Protocols |
| :--- | :--- | :--- | :--- |
| **Auth Service Node** | GoTrue (Go microservice) | **Supabase Auth** (managed) | Manages registration, OTP verification, password hashing (bcrypt), and JWT rotation with embedded `app_metadata.role`. Exposes HTTPS endpoints to Web App and API; dispatches verification emails via external SMTP. |
| **Storage Service Node** | Supabase Storage (Node.js service) | **Supabase Storage** (managed) | Multi-tenant object storage managing dedicated buckets (`covers`, `avatars`, `evidence`, `imports`); enforces bucket access policies and serves private files via time-limited signed URLs over HTTPS. |
| **Realtime Cluster Node** | Phoenix Channels (Elixir / BEAM) | **Supabase Realtime** (managed) | Ingests table mutations from PostgreSQL via **logical replication** and broadcasts filtered updates (book availability counters, notifications, loan changes) to active clients over **WebSocket (WSS)** under RLS. |

---

### 4.4 External Third-Party and Supporting Cloud Services

| Service | Infrastructure / Service provider | Communication protocol | Role & Operational Characteristics |
| :--- | :--- | :--- | :--- |
| **Email Delivery Provider** | Resend, Brevo, or SendGrid cloud infrastructure | **SMTP (port 587) / HTTPS REST API** | Relays transactional verification OTPs, password reset links, and loan overdue reminder emails. Supabase Auth and the Edge Function email outbox queue connect via TLS-encrypted SMTP/HTTPS. |
| **Payment Provider (simulator)** | Cloud Web Service | **HTTPS REST API** | Simulates online student payments for membership purchases, fees, and fine settlements behind the `PaymentProvider` adapter interface. |
| **AI Provider** | Cloud AI Infrastructure (Claude / OpenAI / Voyage) | **HTTPS REST API** | Generates semantic vector embeddings for book descriptions and powers grounded conversational recommendations with citations for the research assistant. |
| **Bibliographic Metadata Services** | Public Web APIs (Google Books, Open Library) | **HTTPS REST API** | Public bibliographic endpoints queried by the cataloguing module during staff ISBN barcode lookup and batch import. |
| **Cloudflare Turnstile** *(supporting service)* | Cloudflare edge, configured as the Supabase Auth CAPTCHA | **HTTPS** | Presents the CAPTCHA challenge on register, login, and password reset; Supabase Auth verifies the returned token server-side. Operational dependency rather than a business system ([System-Context §4.4](../architecture/system-context/System-Context.md#44-external-systems)). Not drawn in the deployment diagram. On failure the form shows a retry. |
| **Sentry** *(supporting service)* | Sentry cloud (SaaS) | **HTTPS** | Receives error and performance events from the browser bundle and from Edge Functions. Captures silently and never blocks a user workflow. Operational dependency rather than a business system; not drawn in the deployment diagram, in line with the Level 1 and Level 3 views. |

---

## 5. Deployment environments

ShelfHelp defines four formal deployment environments, matching [Container.md §6](../architecture/container/Container.md#6-deployment-and-environments) and the three hosted Supabase projects (`dev`, `staging`, `prod`):

| Aspect | Local Development | Continuous Integration (CI) | Dev / Staging | Production |
| :--- | :--- | :--- | :--- | :--- |
| **Target Host** | Local developer workstation (macOS / Linux / Windows) | GitHub Actions virtual runner (`ubuntu-latest`) | Vercel preview deployment plus a separate hosted Supabase project (`staging`) | Vercel Edge Network plus Supabase Cloud (`ap-northeast-2`) |
| **Frontend Serving** | Vite Dev Server (`localhost:5173`) with HMR | Vite production build verification (`npm run build`) | Vercel preview URL per pull request, via HTTPS | Vercel global PoPs via HTTPS |
| **Edge Functions** | Local Deno runtime (`supabase functions serve`) | Deno smoke and integration tests against the local stack | Deployed to the staging Supabase project | Supabase Edge Runtime, region-pinned to `ap-northeast-2` |
| **Database** | Docker container (`supabase/postgres:15`) on port 54322 | Ephemeral Docker container initialized via Supabase CLI | Separate Supabase project; migrations applied by CI | Managed PostgreSQL 15 on a paid plan for automated daily backups and PITR; schema reproducible from migrations |
| **Auth & Storage** | Local GoTrue and Storage containers with in-memory mailer | Local Docker stack with test seed data | Staging Supabase project services | Supabase Auth and S3-compatible cloud storage |
| **Mail Handling** | Inbucket local webmail catcher (`localhost:54324`) | Null / mock mail transporter | Staging SMTP credentials, test recipients only | Production SMTP relay (Resend / Brevo) |
| **Testing Executed** | Vitest unit tests, manual exploratory testing | `npm run verify` (typecheck, spec-matrix), pgTAP database tests (`supabase test db`), Playwright E2E | Playwright against the preview deployment; migration dry run | Playwright smoke tests, production health checks |

---

## 6. Security, networking, and resilience

### 6.1 Network encryption and boundaries

- **Zero plaintext traffic:** All external and inter-node communication is strictly encrypted using **HTTPS (TLS 1.2+)** or **WSS** over port 443. Plain HTTP requests are redirected automatically at the CDN edge.
- **Mediation of client access:** Client browsers never connect to the PostgreSQL database directly (via database port 5432 or connection poolers). All browser data access is mediated through PostgREST over HTTPS under Row Level Security (RLS) policies, or delegated to serverless Edge Functions for transactional operations requiring elevated privileges.

### 6.2 Credential and secret management

- **Client exposure:** The frontend bundle receives only public parameters: the Supabase project URL (`VITE_SUPABASE_URL`) and the anonymous public key (`VITE_SUPABASE_ANON_KEY`).
- **Secret confinement:** The database `service_role` key, external email SMTP credentials, and AI provider API keys exist exclusively within Supabase Edge Function environment secrets and GitHub Actions CI secrets. They are never transmitted to client browsers.
- **Bootstrapping protection:** The browser obtains a Cloudflare Turnstile token for register, login, and password reset, and Supabase Auth verifies it server-side before creating a session ([System-Context §3.5](../architecture/system-context/System-Context.md#35-authentication-and-authorization)).
- **Observability:** Runtime errors and performance events go to Sentry from both the browser and the Edge Functions, alongside Supabase platform logs and the append-only `audit_logs` and `job_runs` tables owned by the database and API containers.

### 6.3 Backup, recovery, and reliability

- **Automated database backups:** Automated daily physical backups and Point-in-Time Recovery (PITR) via continuous WAL archiving are provisioned per Supabase plan. Production assumes a **paid plan** because free-tier projects pause after inactivity, have capped backups and recovery, and stop cron jobs. The pilot may still run on the free tier once its limits are checked before launch, with jobs catching up on resume.
- **Schema as code:** In all tiers, the entire relational schema, table structures, RLS policies, triggers, seed data, and RPCs are version-controlled in `src/supabase/migrations/`. In the event of catastrophic infrastructure loss or environment replication, an identical database environment can be reproduced deterministically using `supabase db reset`.
- **Stateless compute:** Edge Functions and the frontend SPA maintain no local state; any failed worker isolate is terminated and replaced instantly without data loss.

---

## 7. Related views

- **Level 1 — System Context:** [System-Context.md](../architecture/system-context/System-Context.md)
- **Level 2 — Container View:** [Container.md](../architecture/container/Container.md)
- **Level 3 — Component View:** [Component.md](../architecture/component/Component.md)
- **Deployment Diagram Source:** [`mermaid/deployment.mmd`](mermaid/deployment.mmd)
