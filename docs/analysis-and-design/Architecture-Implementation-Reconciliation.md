# ShelfHelp: Architecture vs. Implementation Reconciliation Report

**Date:** 27/Nov/2026  
**Scope:** Reconciling the current codebase in `src/` against the PA4 architecture and deployment documentation:
- [`docs/management/PA4/architecture/system-context/System-Context.md`](../management/PA4/architecture/system-context/System-Context.md)
- [`docs/management/PA4/architecture/container/Container.md`](../management/PA4/architecture/container/Container.md)
- [`docs/management/PA4/architecture/component/Component.md`](../management/PA4/architecture/component/Component.md)
- [`docs/management/PA4/deployment/Deployment.md`](../management/PA4/deployment/Deployment.md)
---

## 1. Executive Summary & Prioritized Matrix

| ID | Severity | Area | Summary of Discrepancy | Recommended Reconciliation |
| :--- | :--- | :--- | :--- | :--- |
| **REC-01** | **Critical** | DB & API Security | Mutation RPCs were callable by browser roles and privileged RPCs lacked caller checks. | **Resolved:** Added forward migration `0012_server_authoritative_writes.sql` to restrict mutation RPC execution to `service_role`; guarded reservation cancellation and counter settlement, and added admin-validated wrappers for circulation RPCs. |
| **REC-02** | **Critical** | Write Path | Frontend components called mutation RPCs directly or used client-side fallbacks; checkout/payment Edge Functions invoked RPCs with the user JWT. | **Resolved:** Routed mutations through Edge Functions, removed direct RPC and signup fallbacks, and moved checkout/payment RPC calls to service-role wrappers that preserve the verified caller ID. |
| **REC-03** | **High** | Auth Guard | Edge Functions did not reload `profiles.status`; frontend lacked inactive gating, restricted status banner, and `/admin/*` 403 handling. | **Resolved:** Shared Edge Function auth reloads role/status, user mutations enforce action-appropriate statuses, and the SPA gates inactive accounts, displays the restricted banner, and denies student access to `/admin/*`. |
| **REC-04** | **High** | PA4 `UC-02` / `UC-32` | The lockout, persistent-session option, and active-session capabilities are specified and retained in the PA4 diagrams, but are not implemented in `src/`. | **Resolved as planned scope:** Keep UC-02/UC-32 in PA4 target architecture diagrams and specifications, explicitly label them as PA5 additions, and implement them later. |
| **REC-05** | **High** | Tech Stack & Libraries | PA4 docs and specs claimed Tailwind/shadcn, Recharts, RHF/Zod, barcode/export/cropping libraries, i18n/date libraries, and testing packages that are not used. | **Resolved:** Removed unimportant or unused library choices. React Router, TanStack Query, Cloudflare Turnstile, Sentry, and Vitest remain explicitly planned additions. |
| **REC-06** | **Medium** | Delivered Scope | Docs state 5 functions are implemented and `checkout-cart` is planned for PA5, whereas 21 business Edge Functions (including `checkout-cart` and inventory) are now implemented in `src/supabase/functions/`. | **Resolved:** Updated scope/status notes in `System-Context.md` and `Component.md`; the implemented directories are distinct from the larger target PA5 command map. |
| **REC-07** | **Medium** | Schema & Jobs | Documented tables (`audit_logs`, `copy_events`, `job_runs`, `settings`, `memberships`, `notifications`, `email_outbox`, `suggestions`, `batches`, `chats`) and `pg_cron` jobs do not exist in migrations yet. | **Resolved:** Added implemented-versus-target status notes. Existing migrations and target PA5 schema/jobs are now explicitly distinguished. |
| **REC-08** | **Low** | Config & Ports | Mismatches across `config.toml`, `.env.example`, `supabase.js`, `ci.yml`, and `Deployment.md` / `System-Context.md` (region comment, env var name, `evidence` bucket limit, local ports). | **Resolved:** Standardized local ports to `54321–54324`, publishable-key naming to `VITE_SUPABASE_PUBLISHABLE_KEY`, region to `ap-northeast-2`, and the `evidence` bucket to 10 MiB. |

---

## 2. Detailed Findings

### 2.1 Security & Server-Authoritative Write Resolutions (`REC-01`, `REC-02`, `REC-03`)

1. **RPC privileges and authorization (`REC-01`)**
   - Forward migration `src/supabase/migrations/0012_server_authoritative_writes.sql` revokes browser-role execution on mutation RPCs and grants them to `service_role`; the read-only `rpc_search_books` remains available to browser roles.
   - User actions are executed through Edge Functions using service-role wrappers that set the verified caller identity for existing user-owned RPC logic. `rpc_cancel_reservation_staff` now checks ownership or an active admin, and counter settlement checks the active admin identity. Handover and return implementation RPCs are reachable only through wrappers that verify an active admin.
   - Added pgTAP checks that authenticated users cannot directly execute reservation cancellation or counter settlement.

2. **Server-authoritative write path (`REC-02`)**
   - Reader mutations for renewals, reviews, fine payments, reservations, wishlists, and checkout now invoke Edge Functions. Client RPC and signup fallbacks were removed.
   - `checkout-cart` and `complete-simulated-payment` authenticate the user JWT, reload current profile status, then invoke the transaction through `service_role` wrappers that preserve the verified user ID and SQL ownership checks.
   - Supabase Auth public sign-up is disabled; the `register-student` Edge Function remains the validated student-registration path. Its profile write is an upsert to accommodate the Auth user trigger.

3. **Current account status and route guards (`REC-03`)**
   - Shared Edge Function authentication reloads the caller’s profile and verifies its current role and status. Admin commands require an active admin. Reader actions apply the relevant policy: borrowing/checkout requires `active`, while payment recovery, reservation cancellation, wishlist updates, and reviews allow `restricted` accounts where needed.
   - `App.jsx` gates inactive profiles and renders a 403 response for students at `/admin/*`; `ReaderLayout.jsx` displays the restricted-account banner. The server checks remain authoritative if a client session is stale.

---

### 2.2 PA4 `UC-02` & `UC-32` Implementation Gaps (`REC-04`)

The architecture docs retain PA4 `UC-02` (v1.1) and `UC-32` (v1.0) as target capabilities and explicitly mark their implementation as PA5:
- **Persistent session toggle (`UC-02` §2.2.7, §3.4):** `src/frontend/src/lib/supabase.js` (lines 20–26) hardcodes `persistSession: true`, and `LoginPage.jsx` has no *"Keep me signed in"* checkbox switching storage between `localStorage` and `sessionStorage`.
- **Server-enforced lockout (`UC-02` §2.2.3, §3.5):** No server-side 5-failure / 15-minute / 10-minute lockout endpoint or `Retry-After` countdown UI exists; `LoginPage.jsx` (lines 46–48) only shows a generic string if `err.status === 429`.
- **Active-session management (`UC-32`):** `list-sessions`, `revoke-session`, and `revoke-other-sessions` do not exist in `src/supabase/functions/`, and neither `/profile/sessions` nor `/admin/profile/sessions` exists in `src/frontend/` (the Reader Profile view in `App.jsx` lines 135–187 is read-only with only navigation/sign-out buttons, and `AdminLayout.jsx` has no profile/sessions menu link).

---

### 2.3 Frontend Technology Stack, Libraries & Language Mismatches (`REC-05`)

`src/frontend/package.json` installs only `react`, `react-dom`, and `@supabase/supabase-js` (plus `vite`, `@vitejs/plugin-react`, `oxlint`, and React type definitions). The following documented technologies are not present in `src/`:

| Documented in `System-Context.md` / `Container.md` / `Component.md` | Actual State in `src/` |
| :--- | :--- |
| React Router | Planned later; current App uses state-based switching + `window.history.pushState`. |
| TanStack Query | Planned later; current code uses manual `useState` / `useEffect` fetching. |
| Tailwind/shadcn/Radix, Recharts | Removed: the implemented UI uses hand-written CSS and native controls. |
| React Hook Form/Zod | Removed: registration and server-side validation use custom JS/TS helpers and shared domain checks. |
| `@zxing/browser`, JsBarcode, PapaParse, ExcelJS, `pdfmake`, `react-easy-crop` | Removed: current features use native browser APIs or custom code. |
| `react-i18next`, `date-fns` | Removed: current UI uses inline copy and implementation-native date formatting. |
| Cloudflare Turnstile & Sentry | Planned later; not yet implemented. |
| Vitest | Planned later; unit/parity test setup is not yet configured. |

---

### 2.4 Documented Scope vs. Actual Migrations & Functions (`REC-06`, `REC-07`)

1. **Implemented Edge Functions vs. `System-Context.md` §2.4 & `Component.md` §8 (`REC-06`):**
   - The architecture documents now distinguish implemented functions from the PA5 target map.
   - `src/supabase/functions/` currently contains **21 business function directories** (excluding `_shared` and `hello`) for registration/circulation/payment/catalog/write-off/inventory workflows; it is not limited to the former five-function PA4 slice.
2. **Missing tables & scheduled jobs (`REC-07`) — resolved as a scope distinction:**
   - `audit_logs`, `copy_events`, `job_runs`, `settings`, `memberships`, `notifications`, `email_outbox`, `suggestions`, `batches`, `chats`, and `chat_messages` remain PA5-target data stores; they are not claimed as present in migrations `0001`–`0010`.
   - `pg_cron` and `pg_net` are enabled in `0001_init.sql`, but no `cron.schedule(...)` statements or `job-*` Edge Function handlers exist yet. These remain planned scheduled-work components.
   - Existing migration data stores include `profiles`, `books`, `copies`, `loan_requests`, `loan_items`, `reservations`, `charges`, `receipts`, `payments`, `wishlists`, `cart_items`, `book_reviews`, `inventory_transactions`, and `writeoff_slips`.

---

### 2.5 Configuration, Environment & Deployment Discrepancies (`REC-08`)

| Setting | Architecture / Deployment Docs | Actual `src/` Files |
| :--- | :--- | :--- |
| **Supabase cloud region** | `ap-northeast-2` (Seoul) in `Deployment.md` §1.2, §2, §4.3 | Resolved: `src/supabase/config.toml` now documents `ap-northeast-2` |
| **Browser public key env var** | `VITE_SUPABASE_PUBLISHABLE_KEY` in current code and environment template | Resolved: `Deployment.md` now uses the same publishable-key name |
| **`evidence` bucket max size** | `10 MiB` in `System-Context.md` §3.6 | Resolved: architecture/specification documents now match the migration and config, which set `10485760` bytes / `10MiB` |
| **Local Supabase ports** | Standard CLI ports `54321–54324` in environment, CI, and the deployment document | Resolved: `src/supabase/config.toml` now uses API `54321`, DB `54322`, Studio `54323`, and SMTP `54324` |

---

## 3. Pre-Submission Reconciliation Checklist

### A. Code & Migration Fixes (Required for Security & Architecture Fidelity)
- [x] Revoke browser-role execution on mutation RPCs, grant service-role execution, and add authorization checks to sensitive RPC entry points.
- [x] Remove direct client mutation RPC calls and client fallbacks; route reader mutations through Edge Functions.
- [x] Switch checkout and simulated-payment RPC calls to service-role wrappers after verifying the caller JWT.
- [x] Reload current profile role/status in Edge Functions and apply action-appropriate account-status rules.
- [x] Add `/admin/*` 403 handling, inactive-account gating, and restricted status banner.
- [x] Keep UC-02 lockout / *"Keep me signed in"* and UC-32 (`list-sessions`, `revoke-session`, `revoke-other-sessions`, `/profile/sessions`, `/admin/profile/sessions`) in PA4 diagrams/specifications and mark them as target PA5 implementation.

### B. Documentation & Config Updates (Required if Libraries/Scope Remain As-Built for PA4)
- [x] Reconcile `System-Context.md` §2.4 and `Component.md` §8 to reflect the **21** business Edge Functions now present in `src/supabase/functions/` (including `checkout-cart`, reader action handlers, and inventory) vs. what remains planned for PA5.
- [x] Reconcile `System-Context.md` §3.2, `Container.md` §4.1, and `Component.md` §3–§5: removed unused UI/barcode/export/cropping/i18n/form libraries; kept React Router, TanStack Query, Turnstile, Sentry, and Vitest as planned additions.
- [x] Align `evidence` bucket limit to 10 MiB, publishable-key naming to `VITE_SUPABASE_PUBLISHABLE_KEY`, `config.toml` region comment to `ap-northeast-2`, and local Supabase ports to `54321–54324`.
