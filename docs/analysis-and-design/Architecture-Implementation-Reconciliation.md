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
| **REC-01** | **Critical** | DB & API Security | Mutation `rpc_*` functions are not revoked from `authenticated`/`anon`/`PUBLIC`; `rpc_cancel_reservation_staff` lacks any caller ownership or admin check. | **Fix code/migrations:** Revoke `EXECUTE` on mutation RPCs from `PUBLIC`, `anon`, `authenticated` and grant only to `service_role`; add strict authorization guards inside RPCs and route through Edge Functions. |
| **REC-02** | **Critical** | Write Path | Frontend components call mutation RPCs directly (and fall back to direct `supabase.rpc` / `auth.signUp`); two Edge Functions call RPCs as `supabaseUser` instead of `service_role`. | **Fix code:** Remove direct client mutation RPC calls and client fallbacks; invoke Edge Functions via `service_role`. |
| **REC-03** | **High** | Auth Guard | Edge Functions do not reload `profiles.status` on the server; `App.jsx` lacks an `inactive` gate, a `restricted` banner, and a `/admin/*` 403 page. | **Fix code:** Reload `profiles.status` in `_shared/auth.ts` and user-facing Edge Functions; add missing route guards in `App.jsx` / `ReaderLayout.jsx`. |
| **REC-04** | **High** | PA4 `UC-02` / `UC-32` | The lockout, persistent-session option, and active-session capabilities are specified and retained in the PA4 diagrams, but are not implemented in `src/`. | **Resolved as planned scope:** Keep UC-02/UC-32 in PA4 target architecture diagrams and specifications, explicitly label them as PA5 additions, and implement them later. |
| **REC-05** | **High** | Tech Stack & Libraries | PA4 docs and specs claimed Tailwind/shadcn, Recharts, RHF/Zod, barcode/export/cropping libraries, i18n/date libraries, and testing packages that are not used. | **Resolved:** Removed unimportant or unused library choices. React Router, TanStack Query, Cloudflare Turnstile, Sentry, and Vitest remain explicitly planned additions. |
| **REC-06** | **Medium** | Delivered Scope | Docs state 5 functions are implemented and `checkout-cart` is planned for PA5, whereas 18 business Edge Functions (including `checkout-cart` and inventory) already exist in `src/supabase/functions/`. | **Resolved:** Updated scope/status notes in `System-Context.md` and `Component.md`; the 18 implemented directories are distinct from the larger target PA5 command map. |
| **REC-07** | **Medium** | Schema & Jobs | Documented tables (`audit_logs`, `copy_events`, `job_runs`, `settings`, `memberships`, `notifications`, `email_outbox`, `suggestions`, `batches`, `chats`) and `pg_cron` jobs do not exist in migrations yet. | **Resolved:** Added implemented-versus-target status notes. Existing migrations and target PA5 schema/jobs are now explicitly distinguished. |
| **REC-08** | **Low** | Config & Ports | Mismatches across `config.toml`, `.env.example`, `supabase.js`, `ci.yml`, and `Deployment.md` / `System-Context.md` (region comment, env var name, `evidence` bucket limit, local ports). | **Resolved:** Standardized local ports to `54321–54324`, publishable-key naming to `VITE_SUPABASE_PUBLISHABLE_KEY`, region to `ap-northeast-2`, and the `evidence` bucket to 10 MiB. |

---

## 2. Detailed Findings

### 2.1 Security & Server-Authoritative Write Violations (`REC-01`, `REC-02`, `REC-03`)

1. **Missing `EXECUTE` revocations on `SECURITY DEFINER` RPCs (`REC-01`)**
   - **Documented behavior:** `System-Context.md` (§2.3), `Container.md` (§4.3), `Component.md` (§9.3), and `Deployment.md` (§4.3.2) state that all transactional mutation RPCs are `SECURITY DEFINER` with `EXECUTE` revoked from `PUBLIC`, `anon`, and `authenticated`, and granted exclusively to `service_role`.
   - **Actual `src/` behavior:** None of `src/supabase/migrations/0001`–`0010` execute `REVOKE EXECUTE` on `rpc_*` functions (`0001_init.sql` and `0006` only revoke/grant table/column `SELECT` and `UPDATE` on `profiles` and `books`).
   - **Concrete security exposure:** In `src/supabase/migrations/0003_circulation_loans_queues.sql` (lines 542–575), `public.rpc_cancel_reservation_staff(p_reservation_id uuid, p_reason text)` is `SECURITY DEFINER` and performs neither an `is_admin()` check nor a `v_res.uid = auth.uid()` ownership check. Any authenticated student can invoke it via PostgREST to cancel another user's reservation.

2. **Direct client mutations & `service_role` bypasses (`REC-02`)**
   - **Documented behavior:** `System-Context.md` (§2.1) restricts direct browser PostgREST writes to personal `cart_items` and `profiles` contact fields; all other mutations go through Edge Functions using `service_role`.
   - **Actual `src/` behavior:**
     - `src/frontend/src/features/reader/loans/LoansPage.jsx` (lines 108–130) calls `supabase.rpc('rpc_renew_loan', ...)` and `supabase.rpc('rpc_submit_book_review', ...)` directly.
     - `src/frontend/src/features/reader/fines/FinesPage.jsx` (lines 112–115) calls `supabase.rpc('rpc_pay_reader_charges', ...)` directly.
     - `src/frontend/src/features/reader/reservations/ReservationsPage.jsx` (line 55) calls `supabase.rpc('rpc_cancel_reservation_staff', ...)` directly, bypassing the `cancel-reservation` Edge Function.
     - `src/frontend/src/features/reader/catalog/CartProvider.jsx` (line 216) calls `supabase.rpc('rpc_toggle_wishlist', ...)` directly, and `BookDetailPage.jsx` (line 208) calls `supabase.rpc('rpc_reserve_book', ...)` directly.
     - `src/frontend/src/features/reader/catalog/CheckoutFlowPage.jsx` (lines 96–165) falls back to direct `supabase.rpc('rpc_checkout_cart', ...)` and `supabase.rpc('rpc_complete_simulated_payment', ...)` when Edge Function calls fail.
     - `src/supabase/functions/checkout-cart/index.ts` (line 49) and `src/supabase/functions/complete-simulated-payment/index.ts` (line 42) invoke those RPCs via `supabaseUser` (anon key + user JWT) rather than `service_role`.
     - `src/frontend/src/features/auth/AuthContext.jsx` (lines 74–93) falls back to direct `supabase.auth.signUp(...)` in the browser when `register-student` fails.

3. **Edge Functions do not reload `profiles.status`, and frontend route guards are incomplete (`REC-03`)**
   - **Documented behavior:** `System-Context.md` (§3.5) and `Component.md` (§7) require every Edge Function to reload `profiles.status` so deactivated/restricted users are refused immediately even with a valid JWT. `Component.md` (§4.1) and `System-Context.md` (§3.2) also require a 403 page for students visiting `/admin/*`, blocking `inactive` users, and a `restricted` status banner.
   - **Actual `src/` behavior:**
     - `src/supabase/functions/_shared/auth.ts` (`requireAdmin`, lines 4–37) only checks `user.app_metadata?.role === 'admin'`; it does not query `profiles.status`. User-facing Edge Functions (`cancel-reservation`, `checkout-cart`, `complete-simulated-payment`) likewise do not reload `profiles.status` before executing.
     - `src/frontend/src/app/App.jsx` (lines 214–293) gates only `profile?.status === 'pending_verification'`; there is no `inactive` block, no `/admin/*` 403 route, and no `restricted` banner in `ReaderLayout.jsx` (which currently renders only a debt-hold banner).

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
   - `src/supabase/functions/` currently contains **18 business function directories** (excluding `_shared`) for registration/circulation/payment/catalog/write-off/inventory workflows, plus `hello`; it is not limited to the former five-function PA4 slice.
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
- [ ] Add `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION ... TO service_role;` for all mutation RPCs (and add explicit authorization checks inside `rpc_cancel_reservation_staff` and sibling RPCs).
- [ ] Remove direct `supabase.rpc(...)` mutation calls and client fallbacks in `LoansPage.jsx`, `FinesPage.jsx`, `ReservationsPage.jsx`, `CartProvider.jsx`, `BookDetailPage.jsx`, `CheckoutFlowPage.jsx`, and `AuthContext.jsx`; route all mutations through Edge Functions.
- [ ] Switch `checkout-cart/index.ts` and `complete-simulated-payment/index.ts` to call RPCs via `service_role` after authenticating the user JWT.
- [ ] Update `src/supabase/functions/_shared/auth.ts` and user-facing Edge Functions to reload `profiles.status` and reject `inactive` / non-`active` callers as required.
- [ ] Add `/admin/*` 403 handling, `inactive` gating, and `restricted` banner in `App.jsx` / `ReaderLayout.jsx`, and remove/translate mixed Vietnamese strings to match the English UI policy.
- [x] Keep UC-02 lockout / *"Keep me signed in"* and UC-32 (`list-sessions`, `revoke-session`, `revoke-other-sessions`, `/profile/sessions`, `/admin/profile/sessions`) in PA4 diagrams/specifications and mark them as target PA5 implementation.

### B. Documentation & Config Updates (Required if Libraries/Scope Remain As-Built for PA4)
- [x] Reconcile `System-Context.md` §2.4 and `Component.md` §8 to reflect the **18** business Edge Functions already present in `src/supabase/functions/` (including `checkout-cart` and inventory) vs. what remains planned for PA5.
- [x] Reconcile `System-Context.md` §3.2, `Container.md` §4.1, and `Component.md` §3–§5: removed unused UI/barcode/export/cropping/i18n/form libraries; kept React Router, TanStack Query, Turnstile, Sentry, and Vitest as planned additions.
- [x] Align `evidence` bucket limit to 10 MiB, publishable-key naming to `VITE_SUPABASE_PUBLISHABLE_KEY`, `config.toml` region comment to `ap-northeast-2`, and local Supabase ports to `54321–54324`.
