# ShelfHelp: Architecture vs. Implementation Reconciliation Report

**Date:** 28/Nov/2026  
**Scope:** Reconciling the current codebase in `src/` against the PA4 architecture and deployment documentation:
- [`docs/management/PA4/architecture/system-context/System-Context.md`](../management/PA4/architecture/system-context/System-Context.md)
- [`docs/management/PA4/architecture/container/Container.md`](../management/PA4/architecture/container/Container.md)
- [`docs/management/PA4/architecture/component/Component.md`](../management/PA4/architecture/component/Component.md)
- [`docs/management/PA4/deployment/Deployment.md`](../management/PA4/deployment/Deployment.md)

---

## 1. Executive Summary & Prioritized Matrix

| ID | Severity | Area | Summary of Discrepancy | Recommended Reconciliation |
| :--- | :--- | :--- | :--- | :--- |
| **REC-01** | **High** | DB & RLS Write Boundary | Docs state direct client writes are limited to `cart_items` and `profiles` contact fields, and protected business tables have no client write policies; however, legacy admin/client write policies remained active in migrations. | **Resolved:** Added forward migration `0015_restrict_client_write_policies.sql` dropping client write policies on `loan_requests`, `loan_items`, `reservations`, `charges`, `receipts`, `books`, `copies`, `wishlists`, and `book_reviews` while preserving `SELECT` policies (and keeping `notifications_update_own_read` for `AdminLayout.jsx` mark-as-read). |
| **REC-02** | **High** | Frontend Bundle Splitting | `System-Context.md` §3.2 and `Component.md` §4.1/§5 claim Reader and Admin routes are separate lazy-loaded bundles so admin code is never shipped to students, but `App.jsx` statically imports all Admin and Reader pages. | **Resolved (doc update):** `System-Context.md` v2.0 §3.2 and `Component.md` v1.7 §4.1/§5 updated to state that reader/admin routes are separate route trees today and that `React.lazy` / `Suspense` route-level code-splitting is a **PA5 target**. No source code change required. |
| **REC-03** | **Medium** | Edge Function Count & Command Map | `Component.md` §7.1 and §8 report **21** business Edge Functions, whereas `src/supabase/functions/` now contains **24** (excluding `_shared` and `hello`), with naming/listing mismatches (`send-reminders` vs. `send-bulk-reminder`, `submit-book-review` vs. `submit-review`, missing `inventory-history`). | **Resolved:** Updated `Component.md` v1.6 — §7.1 count corrected to 24 with explicit function list; §8 intro updated; command table corrected (`send-bulk-reminder` → `send-reminders`; `submit-review` removed from Catalog; `inventory-history` added to Catalog row). |
| **REC-04** | **Medium** | RPC Names, Schema Status & API Internals | Docs reference `search_books` instead of `rpc_search_books`; list `notifications` as an uncreated PA5 table despite `0013` creating `public.notifications`; and describe per-mutation idempotency keys, 3x deadlock retries, `_shared/adapters/`, and `job_runs`/`audit_logs`/`copy_events` that are not yet in `src/`. | **Resolved:** Updated `System-Context.md` v1.9 — `rpc_search_books` corrected in §3.3; `public.notifications` noted as implemented in §2.4 PA4 row; idempotency scope qualified to checkout/payment mutations in §3.3; `notifications` removed from PA5 target table list in §2.4. Updated `Container.md` v1.7 — `rpc_search_books` corrected in §5.1. |
| **REC-05** | **Low** | Diagrammed Libraries & Planned Tooling | `Component.md` §3.1/§3.2 Mermaid diagrams label components with `React Router` and `TanStack Query` even though neither is in `src/frontend/package.json`; **Sentry**, **Cloudflare Turnstile**, **Vitest**, and **MSW** are also absent from `src/` and `package.json`. | Keep these explicitly marked as planned additions in both prose and diagram labels until installed/integrated. |

---

## 2. Detailed Findings

### 2.1 Direct Client Write Policies vs. Server-Authoritative Claims (`REC-01`)

- **Documented:** `System-Context.md` §2.1 & §2.3 and `Container.md` §4.1 state that direct client writes via PostgREST are restricted to personal `cart_items` (own rows) and `profiles` contact fields, and that *"Protected business tables have no client write policy. Loans, copies, payments, receipts, charges, memberships, and reservations are written only by Edge Functions."*
- **Actual (`src/supabase/migrations/`):**
  - `0003_circulation_loans_queues.sql` (lines 178–211) creates `loan_requests_admin_all`, `loan_items_admin_all`, `reservations_admin_all`, `charges_admin_all`, `receipts_admin_insert`, and `copies_admin_update`. None of these policies are dropped by `0012_server_authoritative_writes.sql`, `0013_admin_audit_fixes_and_uc_completion.sql`, or `0014_uc_alignment_fixes.sql`.
  - `0006_catalog_wishlist_cart_checkout.sql` (lines 19, 25, 112) retains `books_admin_all`, `copies_admin_insert`, and `wishlists_own_all`.
  - `0004_reader_loans_fines_reviews.sql` (lines 42, 47) retains student insert/update policies on `book_reviews`, and `0013_admin_audit_fixes_and_uc_completion.sql` (line 82) adds `notifications_update_own_read` on `public.notifications`.
- **Verified consistent:** `0012_server_authoritative_writes.sql` (lines 208–232) and `0013`/`0014` do revoke `EXECUTE` on mutation `rpc_*` functions from `PUBLIC`, `anon`, and `authenticated`, granting execution exclusively to `service_role`.

---

### 2.2 Frontend Bundle Splitting & Diagrammed Libraries (`REC-02`, `REC-05`)

- **Static imports in `App.jsx` (`REC-02`):** `System-Context.md` §3.2 and `Component.md` §4.1 & §5 previously stated that Reader and Admin routes are separate lazy-loaded bundles so admin code is never shipped to students. In `src/frontend/src/app/App.jsx` (lines 11–25), `AdminLayout`, `CirculationPage`, `BooksPage`, `QueuesPage`, and `FinancialLedgerPage` are statically imported alongside reader pages with no `React.lazy` or dynamic `import()`. **Resolution:** docs updated to clarify that routes are separate route trees today and that `React.lazy` / `Suspense` route-level code-splitting is a **PA5 target**. No source code change.
- **Routing & data-fetching libraries (`REC-05`):** `src/frontend/package.json` installs only `react` (`^19.2.8`, resolved `19.3.1`), `react-dom`, and `@supabase/supabase-js` (plus `vite` resolved `8.3.5`, `@vitejs/plugin-react`, `oxlint`, and React types). Neither `react-router` nor `@tanstack/react-query` is installed. While `System-Context.md` §3.2 and `Component.md` §5 note them as planned additions, `Component.md` §3.1/§3.2 Mermaid diagrams already label `App Shell & Access Guard` as `"React Router"` and feature/data components as `"React, TanStack Query"` / `"supabase-js, TanStack Query"`.

---

### 2.3 Edge Function Count & Command Map (`REC-03`)

- **Documented:** `Component.md` §7.1 (line 488) and §8 (line 498) stated that **21** business Edge Function directories exist in `src/supabase/functions/` (excluding `_shared` and `hello`).
- **Actual (`src/supabase/functions/`):** There are **24** business Edge Function directories (excluding `_shared` and `hello`):
  `add-copies`, `cancel-reservation`, `cancel-writeoff-slip`, `change-copy-status`, `checkout-cart`, `complete-simulated-payment`, `complete-writeoff-slip`, `handover-items`, `import-books`, `inventory-history`, `lookup-isbn`, `mark-loan-lost`, `pay-reader-charges`, `record-counter-payment`, `register-student`, `renew-loan`, `reserve-book`, `return-loan`, `save-book`, `save-writeoff-slip`, `send-reminders`, `set-books-collection`, `submit-book-review`, `toggle-wishlist`.
- **Command-map discrepancies in `Component.md` §8 (now fixed):**
  - `send-bulk-reminder` → corrected to `send-reminders`.
  - `submit-review` removed from **Catalog** row (nonexistent); `submit-book-review` retained under **Borrowing**.
  - `inventory-history` added to the **Catalog** row.
- **Resolution:** `Component.md` updated to v1.6 with count 24, explicit function list in §7.1, and corrected §8 command table.

---

### 2.4 RPC Names, Target Tables & API Internals (`REC-04`)

- **Search RPC name:** `System-Context.md` §3.3 and `Container.md` §5.1 referred to `search_books`; corrected to `rpc_search_books` (implemented as `public.rpc_search_books` in `0006_catalog_wishlist_cart_checkout.sql` line 189 and confirmed in `0012_server_authoritative_writes.sql` line 230).
- **Implemented vs. target tables:** `System-Context.md` §2.4 listed `notifications` among PA5 target tables; removed — `public.notifications` (along with `public.reservation_strike_events`) is already created in `0013_admin_audit_fixes_and_uc_completion.sql` (lines 50, 91). Target tables `memberships`, `email_outbox`, `suggestions`, `batches`, `chats`, `audit_logs`, `copy_events`, `job_runs`, and `settings` remain absent from migrations and are still listed as PA5 targets.
- **API internal components:** `System-Context.md` §3.3 idempotency claim qualified to checkout and payment mutations (not every mutation). The `_shared/adapters/`, 3x deadlock retries, and `job_runs`/`audit_logs`/`copy_events` remain PA5 targets as described in existing prose.
- **Resolution:** `System-Context.md` updated to v1.9; `Container.md` updated to v1.7.

---

### 2.5 Supporting Services & Test Tooling (`REC-05`)

- **Sentry & Cloudflare Turnstile:** Referenced in `System-Context.md` §3.7/§3.8 and `Deployment.md` §2/§4.4/§6.2, but neither package nor integration exists in `src/` or `package.json`.
- **Vitest & MSW:** Listed in `System-Context.md` §3.1/§3.8 and `Deployment.md` §5 as part of the testing/CI stack (with Vitest noted as planned), and neither is present in `package.json` or `.github/workflows/ci.yml`.
- **Verified CI:** `.github/workflows/ci.yml` runs `lint`, `typecheck`, `spec-matrix`, `pgTAP`, `Edge Function smoke` (`hello`), and `Playwright smoke`, matching the rest of `Deployment.md` §5.

---

## 3. Verified Consistent Baseline

The following documented architectural properties were verified directly in the current codebase:
- **Runtime versions:** Installed `react` `19.3.1` and `vite` `8.3.5` match `System-Context.md` §3.1/§3.2 and `Container.md` §3.1/§4.1.
- **Auth & profile checks:** `src/supabase/functions/_shared/auth.ts` verifies the JWT, checks `app_metadata.role`, and reloads `profiles.role` and `profiles.status` on every request; `src/frontend/src/lib/supabase.js` uses `flowType: 'pkce'`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Storage & local stack config:** `src/supabase/config.toml` matches PostgreSQL 15, disabled public signup (`enable_signup = false`), local ports `54321–54324`, and all four storage buckets (`covers`, `avatars`, `evidence`, `imports`).
- **Realtime:** `src/frontend/src/features/reader/catalog/BookDetailPage.jsx` subscribes to live copy updates via `supabase.channel(...)`.
- **PA5 auth scope markers:** Server-side `UC-02` lockout, the *"Keep me signed in"* storage toggle, and `UC-32` (`list-sessions`, `revoke-session`, `revoke-other-sessions`) are absent from `src/` and accurately marked as PA5 targets in the PA4 docs (`LoginPage.jsx` currently has `429` error handling and `autocomplete` attributes).
