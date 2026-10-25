# M0 Foundations — Implementation Plan

**Source**: SRS §19 (milestone M0), SRS §11 (project structure), SRS §10 (architecture),
NFR-14 (testability), SRS §12.3 (RLS), SRS §12.5 (error contract), SRS §4.17 (settings).

**Status**: **In progress — M0a complete and verified; M0b complete except CI's first run.**
Last updated 2025-10-25.

**Exit criteria (SRS §19)**: CI green with a hello-world Edge Function, a pgTAP RLS test,
and a Playwright smoke test.

---

## 0. Progress at a glance

The original version of this plan was written before any tooling existed and before any
code. It is now substantially out of date: **every artifact it proposed has been built**,
and the two "blockers" it treated as central (no Docker, no Supabase CLI) no longer exist.

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| A1 | Repo structure (`src/supabase`, `src/shared`, `src/e2e`, `src/scripts`) | ✅ Done | directories exist |
| A2 | Workspace config (npm workspaces, strict `tsconfig.base.json`) | ✅ Done | root `package.json` (3 workspaces), `tsconfig.base.json` |
| A3 | `src/shared` types / reason codes / settings defaults / domain stubs | ✅ Done | `src/shared/src/{types,reason-codes,settings-defaults,domain}` |
| A4 | Settings loader over §4.17 defaults | ✅ Done | `src/shared/src/settings-defaults/loader.ts` |
| A5 | Clock seam (`Clock` TS + `app_now()` SQL) | ✅ Done | `src/shared/src/domain/clock.ts`, migration |
| A6 | Error contract (§12.5 `ApiError` + reason enum + status map) | ✅ Done | `src/shared/src/reason-codes/index.ts` |
| A7 | `src/supabase/config.toml` (ports, buckets from §10.5) | ✅ Done | `src/supabase/config.toml` |
| A8 | First migration `0001_init.sql` | ✅ Done + **executes** | applies clean via `db reset` |
| A9 | Hello-world Edge Function | ✅ Done + **boots** | returns 200 / 400 envelope (verified by curl) |
| A10 | Seed script | ✅ Done + **executes** | 4 books / 5 copies after `db reset` |
| A11 | Spec-matrix script | ✅ Done | 107 FRs → 107 claimed, 64 TS scenarios |
| A12 | Frontend `.env.example` | ✅ Done | `src/frontend/.env.example` |
| B1 | Docker | ✅ Installed (29.7.2) | see DEC-LOG-03 |
| B2 | Supabase CLI | ✅ 2.122.0 via `npx` | no global install needed |
| B3 | `supabase start` + `db reset` | ✅ Verified | migration and seed both apply |
| B4 | pgTAP RLS test | ✅ **23/23 passing** | `src/supabase/tests/rls_test.sql` |
| B5 | Playwright smoke | ✅ **2/2 passing** | `src/e2e/smoke.spec.ts` |
| B6 | GitHub Actions CI | ✅ Written, **not yet run** | `.github/workflows/ci.yml` |
| B7 | Branch protection on `main` | ⬜ Manual | needs the repo owner; not automatable here |

### What is left

1. **B7 — branch protection.** Manual, in GitHub settings. Require the four CI jobs
   (`static`, `db`, `functions`, `e2e`) on `main`.
2. **B6 — first CI run.** The workflow has never executed on GitHub. Push it and fix
   whatever the runner disagrees with. Known local-vs-CI risks are listed in §7.

Nothing else in M0 is outstanding.

---

## 1. What M0 is, and is not

**Is**: the skeleton every later milestone stands on — repo layout, database foundation,
shared business-rule package, settings/clock infrastructure, error contract, seed data,
and the CI gate that enforces the traceability matrix.

**Is not**: any user-visible feature. No FR from M1 onward is implemented here. M0
delivers zero reader/admin screens.

The frontend is *not* rewired to Supabase in M0 — that is M1 (Accounts). What exists in
`src/frontend` today is the read-only demo shell migrated off Firebase on 2025-10-25
(DEC-LOG-01); the Playwright smoke test uses it as a rendering target and as proof that
the catalog read path works through RLS.

---

## 2. Repository layout (resolved)

**Mapping rule**: `src/` in this repository corresponds to `shelfhelp/` in SRS §11.
Everything app-related lives under `/src`, per the project requirement. There is **no**
`apps/web` and **no** move of `src/frontend`.

```
src/                        # == shelfhelp/ in SRS §11
  frontend/                 # existing Vite app; a workspace
  supabase/                 # config.toml, migrations/, tests/, functions/, seed.sql
  shared/                   # types, schemas, settings-defaults, reason-codes, domain
  e2e/                      # Playwright specs + config; a workspace
  scripts/                  # spec-matrix.mjs
  speckit/                  # specs, constitution (not part of SRS §11)
```

Workspaces (root `package.json`): `src/frontend`, `src/shared`, `src/e2e`.
`src/` is the *project* root, not the *workspace* root; see DEC-LOG-02.

Two deliberate deviations from the literal SRS §11 layout:

| SRS §11 | This repo | Reason |
|---|---|---|
| `apps/web/src/` | `src/frontend/` | Single deployable; `apps/` is monorepo ceremony with no benefit. |
| `packages/shared/src/` | `src/shared/` | Same nesting intent, one level flatter, inside the required `/src` root. |

`src/backend/` and `src/firebase/` were deleted on 2025-10-25 (DEC-LOG-01).

---

## 3. Toolchain (was §2 "blockers" — all resolved)

The original plan listed Docker, the Supabase CLI, and pnpm as blockers and split M0 into
M0a/M0b accordingly. Docker and the CLI are now installed, so **the split is historical**:
M0 is a single milestone again. Recorded in DEC-LOG-03.

| Tool | Version | Role |
|---|---|---|
| Node | 24.11.0 | ≥ 20 required |
| npm | 11.6.1 | workspaces (D2 confirmed) |
| Docker | 29.7.2 | local stack |
| Supabase CLI | 2.122.0 via `npx` | `--workdir src` is mandatory |
| Playwright | 1.64.1 | Chromium only in M0 |

### Known good verification commands

```bash
npm run verify        # typecheck (shared + deno + e2e) + spec-matrix   [no Docker]
npm run lint
npm run db:start      # supabase start --workdir src                    [Docker]
npm run db:reset      # applies 0001_init.sql + seed.sql
npm run db:test       # pgTAP  -> 23/23
npm run e2e:install   # one-time: downloads the Chromium build
npm run e2e           # Playwright smoke -> 2/2
```

> `npm run e2e` fails with "Executable doesn't exist" on a fresh clone until
> `npm run e2e:install` has been run once. CI handles this in the `e2e` job.

---

## 4. Decisions (resolved)

| # | Question | Resolution |
|---|---|---|
| D1 | Docker availability | **Resolved** — installed and working (DEC-LOG-03). M0b no longer needs a separate phase. |
| D2 | Package manager | **npm workspaces** — decided and in use. |
| D3 | Move the Vite app to `apps/web` | **Dropped.** Layout is `/src`-rooted; `src/frontend` stays. |
| D4 | Hosted Supabase project | **Still deferred** — local-only until M1. `config.toml` has no project ref. |
| D5 | Retire the Flask/Firebase demo | **Done** — deleted 2025-10-25 (DEC-LOG-01). |

Further engineering decisions made while implementing M0:

- **DEC-LOG-04** — Edge Functions import shared code by relative path; the npm workspace
  name does not resolve in the Edge Runtime container.
- **DEC-LOG-05** — `books.embedding` is hidden with a column **GRANT** list; a column
  `REVOKE` is a no-op against Supabase's default table-level grants.
- **DEC-LOG-06** — RLS filters; it does not raise. Tests assert 0 rows affected for
  client `UPDATE`/`DELETE`, and `42501` only for `INSERT` and missing privileges.

---

## 5. Defects found and fixed while completing M0

Recorded because each one would have shipped broken if M0 had stopped at "files exist".

| # | Defect | Symptom | Fix |
|---|---|---|---|
| 1 | `_shared/http.ts` imported `@shelfhelp/shared` | Function returned `503 BOOT_ERROR`; log: *Relative import path not prefixed with / or ./ or ../* | Relative import + DEC-LOG-04 |
| 2 | `revoke select (embedding)` was a no-op | A student could read `books.embedding` | Column GRANT list + DEC-LOG-05; asserted by pgTAP |
| 3 | Edge Function tsconfig never typechecked (not in `typecheck` script) | 4 latent TS errors, incl. missing `Deno` global | `typecheck:deno` + `src/supabase/deno-globals.d.ts` |
| 4 | `zod` needed as an npm devDependency only to typecheck a remote URL import | `npm ci` desynced; high-severity advisory pulled in | Hand-written Zod surface in `deno-globals.d.ts`; **zero** npm deps for the Deno check |
| 5 | Playwright `webServer` probed `127.0.0.1` while Vite bound `localhost` (IPv6) | `Error: Timed out waiting 120000ms from config.webServer` | `--host 127.0.0.1` on the dev command |
| 6 | `exactOptionalPropertyTypes` rejected `webServer: undefined` | e2e typecheck error TS2769 | Conditional spread |
| 7 | pgTAP planned 21 tests, ran 22 (and later 21/23) | `Bad plan. You planned N tests but ran M` | Plan count corrected; seed rows isolated by scoping assertions to fixtures |
| 8 | Column GRANT fix left `anon` with **no** `SELECT` on `books` | App queried the catalog while logged out → `permission denied for table books` on every page load | Decided per SRS §12.3 (catalog reads are for signed-in users) + §2.2 (unauthenticated users may only open auth routes): the RLS lockdown is *correct*, so `App.jsx` now skips the query when `user` is null |
| 9 | Playwright `toHaveCount(0)` passed while an error was appearing | A smoke assertion that could never fail: `toHaveCount(0)` returns immediately when the count is already 0, so it cannot wait for a late error (measured: passed at T+284 ms, error present at T+284 ms — 4 ms later) | Wait for `networkidle` before asserting; verified the test **fails** with the regression re-injected and passes with the fix |
| 10 | `npm run e2e` broken on a fresh clone | `Executable doesn't exist ... chrome-headless-shell` after a clean `npm ci` | Added `npm run e2e:install` (`playwright install --with-deps chromium`), documented in §3; CI already did this |

---

## 6. Verification results (latest run)

| Check | Result |
|---|---|
| `tsc --noEmit` — `@shelfhelp/shared` | ✅ clean |
| `tsc --noEmit` — Edge Functions (Deno) | ✅ clean |
| `tsc --noEmit` — `src/e2e` | ✅ clean |
| `oxlint` (frontend) | ✅ clean |
| `spec-matrix.mjs` | ✅ 107 FRs defined, 107 claimed, 64 TS scenarios, 0 unclaimed |
| `npm ci` from clean tree | ✅ 85 packages, **0 vulnerabilities** |
| `supabase db reset` | ✅ 0001_init.sql + seed.sql apply; 4 books, 5 copies |
| Generated `search_vector` (POL-17) | ✅ `Hóa học đại cương` → `hoa hoc dai cuong` |
| `app_now()` | ✅ returns timestamptz |
| Edge Function `hello` | ✅ `200` success envelope; `400 VALIDATION_FAILED`; `OPTIONS` `200` |
| pgTAP `tests/rls_test.sql` | ✅ **23/23 pass** |
| Playwright `smoke.spec.ts` | ✅ **2/2 pass** (asserts the shell renders and a signed-out visitor settles with no permission error; verified to fail when the regression is re-injected) |
| GitHub Actions CI | ⬜ not yet run on a runner |

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| CI never run on a real runner | The `webServer`/IPv6 fix (defect 5) was found locally; the runner may differ | First push is expected to need a small fixup; treat a red first run as normal, not a regression |
| Docker Desktop flakiness on the dev machine | `db:test` / `e2e` unavailable; Docker-free checks still run | `npm run verify` covers static gates; database and browser proof is re-run when Docker is up |
| Column-GRANT list on `books` grows stale | New columns silently invisible to clients | pgTAP asserts a normal select still returns rows, so a missing column fails CI loudly (DEC-LOG-05) |
| RLS test asserts the wrong semantics | False "security hole" or false green | DEC-LOG-06 documents the filter-vs-raise rule; suite header repeats it |
| Spec-matrix false confidence | It checks FR→TS presence, not correctness | Documented in the script header |
| Branch protection not set (B7) | A failing spec-matrix job would not block a merge | Required job list is recorded above; needs repo owner action |

---

## 8. Definition of done for M0

- [x] Workspace builds: `tsc --noEmit` clean across `src/shared`, the Edge Functions, and `src/e2e`
- [x] `spec-matrix.mjs` exits 0 and reports all 107 FRs claimed
- [x] `config.toml` and `0001_init.sql` present and **executed** via `db reset`
- [x] Hello-world Edge Function returns the §12.5 envelope for success **and** a validation error
- [x] pgTAP RLS test passes (23/23)
- [x] Playwright smoke test passes (2/2)
- [x] Decisions D1–D5 and DEC-LOG-03…06 recorded in `docs/DECISIONS.md`
- [ ] CI green on GitHub with spec-matrix as a required job
- [ ] Branch protection on `main` requires the CI jobs

Two boxes remain, both requiring a push and repo-owner settings — not further code.

---

## 9. Explicitly out of scope for M0

- Any FR from M1–M11 (no auth screens, catalog, cart, loans)
- shadcn/ui and the design system (M1, when first screens exist)
- i18n string extraction (M1)
- Sentry / monitoring (NFR-13, M11 hardening)
- Hosted Supabase projects for staging/prod (D4, M1)
- Multi-browser Playwright (NT-06, M11)
- Unit-test runner (Vitest) — no `domain` logic exists yet to cover
