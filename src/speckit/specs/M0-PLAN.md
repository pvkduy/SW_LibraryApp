# M0 Foundations — Implementation Plan

**Source**: SRS §19 (milestone M0), SRS §11 (project structure), SRS §10 (architecture),
NFR-16 (testability), SRS §12.5 (error contract), SRS §4.17 (settings).

**Status**: Proposed — for review before any code is written.

**Exit criteria (SRS §19)**: CI green with a hello-world Edge Function, a pgTAP RLS test,
and a Playwright smoke test.

---

## 1. What M0 is, and is not

**Is**: the skeleton every later milestone stands on — repo layout, database foundation,
shared business-rule package, settings/clock infrastructure, error contract, seed data,
and the CI gate that enforces the traceability matrix.

**Is not**: any user-visible feature. No FR from M1 onward is implemented here. M0
delivers zero reader/admin screens.

**Deliberate scope cut in this plan**: the frontend is *not* rewired to Supabase in M0.
That happens in M1 (Accounts), which is where the first real `supabase-js` usage lands.
M0 leaves the existing Flask/Firebase demo in place, untouched, per DEC-LOG-01.

---

## 2b. Repository layout (resolved)

**Mapping rule**: `src/` in this repository corresponds to `shelfhelp/` in SRS §11.
Everything app-related lives under `/src`, per the project requirement. There is **no**
`apps/web` and **no** move of `src/frontend`.

```
src/                        # == shelfhelp/ in SRS §11
  frontend/                 # existing Vite app, unchanged and not moved
  supabase/                 # NEW: config.toml, migrations/, tests/, functions/
  shared/src/               # NEW: types, schemas, settings-defaults, reason-codes, domain
  e2e/                      # NEW: Playwright specs
  scripts/                  # NEW: spec-matrix
  speckit/                  # specs, constitution (not part of SRS §11)
```

> **Status**: `backend/` and `firebase/` were deleted on 2025-10-25 (DEC-LOG-01 resolution).
> The tree above is the target state; those two nodes no longer exist.

Two deviations from the literal SRS §11 layout, both deliberate:

| SRS §11 | This repo | Reason |
|---|---|---|
| `apps/web/src/` | `src/frontend/` | Single deployable; `apps/` is monorepo ceremony with no benefit here. Frontend not moved. |
| `packages/shared/src/` | `src/shared/src/` | Same nesting intent, one level flatter, inside the required `/src` root. |

**Workspace root**: `package.json` and workspace globs live at the **repository root**
with `src/*` globs, so CI, editors, and `.github/` resolve naturally. The `src/` folder
is the *project* root, not the *workspace* root.

**Package manager**: npm workspaces (pnpm is not installed). To be recorded in
`docs/DECISIONS.md` as D2.

---

## 2. Blockers found in this repository

These are facts about the current machine, verified before planning:

| Tool / item | State | Why it matters |
|---|---|---|
| **Docker** | ❌ not installed | `supabase start` (local stack) cannot run. Blocks pgTAP + integration + Playwright-against-local. |
| **Supabase CLI** | ❌ not installed | No `supabase init`, no `supabase start`, no `functions serve` |
| **pnpm** | ❌ not installed | SRS §11 assumes a pnpm workspace (`pnpm-workspace.yaml`) |
| Node | ✅ v24.22.1 | OK (README wants ≥ 20) |
| npm | ✅ 11.19.1 | Usable fallback for pnpm |
| Git | ✅ 2.48.1, remote `origin` → `pvkduy/SW_LibraryApp`, branch `main` | OK |
| Python | ✅ 3.13.5 | Not needed — the Flask demo was deleted (DEC-LOG-01) |
| `.github/workflows` | ❌ absent | CI has to be created from scratch |
| `tsconfig*.json` | ❌ absent | No TypeScript configured anywhere yet |
| `supabase/` | ❌ absent | The entire database/Edge Function layer does not exist |

### Consequence

**Two of the three M0 exit criteria cannot be met without Docker**:

- pgTAP RLS test → needs a running Postgres (local stack or hosted project)
- Playwright smoke test → needs an app to test (M0 has no app) and a target

So M0 must be split into two parts with different prerequisites. This is the central
decision of this plan.

---

## 3. Proposed split: M0a (no Docker) and M0b (needs Docker)

### M0a — Foundation artifacts (doable now, no Docker)

Everything that is *file creation* and *TypeScript/SQL authoring*:

| # | Deliverable | Detail |
|---|---|---|
| A1 | Repo structure | `src/supabase/`, `src/shared/`, `src/e2e/`, `src/scripts/`. `src/frontend` is **not** moved. |
| A2 | Workspace config | root `package.json` with npm workspaces pointing at `src/*`; root `tsconfig.base.json` (strict) |
| A3 | `src/shared` | `src/types/`, `src/schemas/` (Zod), `src/settings-defaults/` (§4.17 verbatim), `src/reason-codes/` (§12.5 verbatim), `src/domain/` stubs for entitlements, gating, fines. Pure TS, no Deno/Node APIs. |
| A4 | Settings loader | Typed accessor over the §4.17 defaults, with `settings.version` semantics from POL-18 |
| A5 | Clock | TS `Clock` interface + `app_now()` SQL function (test seam, NFR-16) |
| A6 | Error contract | Shared `ApiError` type + reason enum from §12.5, plus the reason→message map skeleton |
| A7 | `src/supabase/config.toml` | Local stack config (regions, ports, storage buckets from §10.5) |
| A8 | First migration | `src/supabase/migrations/0001_init.sql`: extensions (`pg_trgm`, `unaccent`, `vector`), `app_now()`, `immutable_unaccent`, `normalize_vi_exact`, core tables (`profiles`, `books`, `copies`), RLS enabled + deny-by-default, immutability trigger scaffolding |
| A9 | Hello-world Edge Function | `src/supabase/functions/hello/index.ts` — validates input with Zod, returns the §12.5 envelope |
| A10 | Seed script | `src/supabase/seed.sql` skeleton (placeholder rows; full seed is later) |
| A11 | Spec-matrix script | `src/scripts/spec-matrix.mjs` — parses `specs/**/spec.md` + SRS §17, asserts every FR has a TS scenario, exits non-zero on failure |
| A12 | `.env.example` files | Supabase-shaped (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) in `src/frontend/` (Vite only reads its own root) |

**M0a exit criteria (revised, achievable without Docker)**: `tsc --noEmit` passes across
the workspace, `spec-matrix` runs and reports 107 FRs → 0 unclaimed, and the SQL
migration parses (syntax-checked, not executed).

### M0b — Local stack + CI (requires Docker + Supabase CLI)

| # | Deliverable | Detail |
|---|---|---|
| B1 | Install Docker Desktop | User action; cannot be automated |
| B2 | Install Supabase CLI | `npm i -D supabase` (works without global install) |
| B3 | `supabase start` + `db reset` | Applies A8 migration, proves it executes |
| B4 | pgTAP RLS test | `src/supabase/tests/rls_test.sql` — a student cannot read another student's rows; asserts deny-by-default |
| B5 | Playwright smoke | `src/e2e/smoke.spec.ts` — trivial routing smoke against a placeholder page |
| B6 | GitHub Actions CI | `.github/workflows/ci.yml` — lint, `tsc --noEmit`, unit, pgTAP, Playwright, **spec-matrix as a required job** |
| B7 | Branch protection | Require the CI job on `main` |

**M0b exit criteria**: exactly SRS §19 — CI green with a hello-world Edge Function, a
pgTAP RLS test, and a Playwright smoke test.

---

## 4. Decisions this plan needs from you

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | Docker availability | Install Docker Desktop / use a hosted Supabase dev project instead / defer M0b | **Defer M0b**; do M0a now |
| D2 | Package manager | npm workspaces (pnpm absent) | **npm workspaces** — decided |
| D3 | ~~Move the Vite app to `apps/web`~~ | **Dropped.** Layout is `/src`-rooted; `src/frontend` stays where it is. | Resolved by the project requirement |
| D4 | Hosted Supabase project | Create dev project now (needs an account) / local-only until M0b | **Decide at M0b** — M0a needs neither |
| D5 | Retire the Flask demo now? | Delete `src/backend/`, `src/firebase/` / keep until M0b | **Keep until M0b** — deleting before a replacement exists leaves no runnable app |

---

## 5. Proposed execution order (M0a)

1. **A1 + A2** — structure and workspace config. Verify `tsc --noEmit` runs.
2. **A6 + A5** — error contract and clock first, because A3/A9 depend on their types.
3. **A3** — `packages/shared`: settings defaults and reason codes copied **verbatim** from
   §4.17 and §12.5 so there is one source of truth. Domain stubs are interfaces only,
   no logic (logic belongs to the milestone that owns each rule).
4. **A4** — settings loader over the defaults.
5. **A11** — spec-matrix script. Doing this early makes every later step self-checking.
6. **A7 + A8** — `config.toml` and the first migration (syntax-only validation).
7. **A9** — hello-world Edge Function.
8. **A10 + A12** — seed skeleton and env examples.

Each step ends with a verification command that must pass before the next begins.

---

## 6. Explicitly out of scope for M0

- Any FR from M1–M11 (no auth, no catalog, no cart, no loans)
- shadcn/ui and the design system (M1, when first screens exist)
- i18n string extraction (M1; M0 only ensures the dependency choice is recorded)
- Sentry, monitoring (NFR-13, wired at M11 hardening; a project key is not needed yet)
- Real Supabase projects for staging/prod (DEC: M0b at the earliest)

> Frontend migration off the Firebase SDK and deleting the Flask/Firebase demo were both
> completed on 2025-10-25 (DEC-LOG-01), so neither appears here any more.

---

## 7. Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Docker never installed | M0b and the CI gate never run; M1 inherits an untested migration | Treat Docker as a hard prerequisite for leaving M0; do not start M1 until B4 passes |
| Migration authored without ever executing | SQL errors discovered at M1, expensive to unwind | Syntax-check in M0a; execute first thing in M0b |
| `packages/shared` accumulates logic early | Business rules drift from the spec's owner milestone | M0a ships interfaces + settings/reasons only; no gating or fine logic |
| Two package managers (npm + future pnpm) | Confusing installs and lockfiles | Pick one (D2) and record it in `docs/DECISIONS.md` |
| Spec-matrix false confidence | It checks FR→TS presence, not correctness | Document its limit in the script header |

---

## 8. Definition of done for M0

- [ ] Workspace builds: `tsc --noEmit` clean across `packages/shared` and `supabase/functions`
- [ ] `scripts/spec-matrix.mjs` exits 0 and reports all 107 FRs claimed by a TS scenario
- [ ] `supabase/config.toml` and `0001_init.sql` present; SQL syntax-validated
- [ ] Hello-world Edge Function returns the §12.5 envelope for both success and a validation error
- [ ] (M0b) `supabase start` + `db reset` succeed; pgTAP RLS test passes; Playwright smoke passes; CI green with spec-matrix as a required job
- [ ] Decisions D1–D5 recorded in `docs/DECISIONS.md`
