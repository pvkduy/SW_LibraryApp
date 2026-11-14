---
description: "Task list for 001a-accounts-reader implementation"
---

# Tasks: 001a-accounts-reader (Accounts & Authentication — Reader)

**Input**: Design documents from `src/speckit/specs/001a-accounts-reader/plan.md`, `spec.md`, and 8 Figma design screens.

## Format: `[ID] [P?] [Phase] Description`

- **[P]**: Can run in parallel
- **Paths**: Exact file paths in this repository (`src/shared/`, `src/supabase/`, `src/frontend/`)

---

## Phase 1: Shared Schema & Database Infrastructure

**Purpose**: Core validation schemas and database triggers needed by both backend and frontend.

- [x] **T001** [P] Create `src/shared/src/domain/auth.ts` defining Zod validation schemas for student registration (`studentRegisterSchema`), login (`loginSchema`), and password reset (`resetPasswordSchema`) following POL-02 constraints (email `*.edu.vn`, student ID pattern `^[A-Za-z0-9]{6,15}$`, password $\ge$ 8 chars with 1 letter & 1 digit).
- [x] **T002** [P] Export new auth domain schemas in `src/shared/src/index.ts`.
- [x] **T003** Create database migration `src/supabase/migrations/0002_auth_triggers.sql` adding a trigger function on `auth.users` that automatically updates `public.profiles.status = 'active'` when `email_confirmed_at` is updated.

---

## Phase 2: Backend Edge Function (Registration)

**Purpose**: Server-side registration logic with atomic rollback and role assignment (Principle II & VI).

- [x] **T004** Create Edge Function `src/supabase/functions/register-student/index.ts`:
  - Validate payload with Zod schema from `@shelfhelp/shared`.
  - Check uniqueness of `student_id` and `email` against `public.profiles`.
  - Create Supabase Auth user with `app_metadata.role = 'student'`.
  - Insert row in `public.profiles` with `status = 'pending_verification'`.
  - Rollback: Delete the Auth user if profile insert fails (EC-36).
  - Return standardized response envelope or error contract (§12.5).

---

## Phase 3: Frontend Reusable Components (Figma Design System)

**Purpose**: Build the visual foundation matching the 8 Figma mockups (warm cream background, leather brown buttons, custom inputs, modals).

- [x] **T005** [P] Ensure `src/frontend/.env.local` is created with local Supabase configuration (`VITE_SUPABASE_URL=http://127.0.0.1:54321`, `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`).
- [x] **T006** [P] Create `src/frontend/src/features/auth/components/AuthLayout.jsx`:
  - Background `#FAF8F5`, max-width ~420px mobile shell.
  - Header card with circular book badge, title, and subtitle.
  - White inner card (`rounded-2xl border border-[#F0EBE1] shadow-sm`).
- [x] **T007** [P] Create `src/frontend/src/features/auth/components/AuthInput.jsx` supporting icons (user, lock, mail), password visibility toggle button, and inline field error hints.
- [x] **T008** [P] Create `src/frontend/src/features/auth/components/AuthModals.jsx` implementing:
  - `AuthSuccessModal` (Figma Screen 7 - Green checkmark, "Registration Completed", "Welcome to ShelfHelp!").
  - `AuthErrorModal` (Figma Screen 8 - Red 'X', "Something went wrong", "Try Again").

---

## Phase 4: Authentication Screen Components (React Pages)

**Purpose**: Build each user-facing screen matching the approved Figma frames.

- [x] **T009** Create `src/frontend/src/features/auth/LoginPage.jsx` (Figma Screen 1 & 2):
  - Email/Student ID field and Password field with reveal toggle.
  - "Trouble signing in?" link to `/forgot-password`.
  - Brown "Sign In" button with loading spinner.
  - Anti-enumeration generic error display (terracotta text `#C85A3E` below button).
  - "New patron? Sign up" navigation link to `/register`.
- [x] **T010** Create `src/frontend/src/features/auth/RegisterPage.jsx` (Figma Screen 3):
  - Form fields: Full Name, Student ID, Institutional Email, Password, Confirm Password.
  - Live client-side Zod validation.
  - "Complete Registration" button calling `register-student` Edge Function.
  - "Already have an account? Sign In" link to `/login`.
- [x] **T011** Create `src/frontend/src/features/auth/ForgotPasswordPage.jsx` (Figma Screen 4):
  - Email input and "Send code" button.
  - "Remembered it? Back to sign in" navigation link.
  - Calls `supabase.auth.resetPasswordForEmail`.
- [x] **T012** Create `src/frontend/src/features/auth/VerifyOtpPage.jsx` (Figma Screen 5):
  - 6-digit verification code input boxes with auto-tabbing and paste handling.
  - "Resend code" with 60-second cooldown timer.
  - "Verify code" primary button calling `supabase.auth.verifyOtp`.
  - "Change email" secondary outlined button.
- [x] **T013** Create `src/frontend/src/features/auth/ResetPasswordPage.jsx` (Figma Screen 6):
  - New password and Confirm password fields with visibility toggles.
  - "Reset password" button updating session credentials via `supabase.auth.updateUser`.

---

## Phase 5: Auth Context, Routing & Verification

**Purpose**: Wire all authentication features into the application lifecycle and verify quality gates.

- [x] **T014** Update `src/frontend/src/features/auth/AuthContext.jsx`:
  - Integrate Edge Function `register-student` via `src/frontend/src/lib/api.js`.
  - Provide helper methods: `login`, `register`, `verifyOtp`, `sendPasswordReset`, `updatePassword`, `logout`.
  - Refresh and synchronize `profiles` row on session state changes.
- [x] **T015** Update `src/frontend/src/app/App.jsx` with React Router routes:
  - Public routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`.
  - Role & status guard: Redirect unverified users (`status === 'pending_verification'`) to `/verify-email`, `student` to `/`, `admin` to `/admin`.
  - Show logout button and user profile on home screen `/`.
- [x] **T016** Run automated quality checks:
  - `npm run lint` (oxlint).
  - `npm run verify` (typecheck & spec-matrix).
