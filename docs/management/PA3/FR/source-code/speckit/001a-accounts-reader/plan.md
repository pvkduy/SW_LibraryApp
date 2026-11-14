# Implementation Plan: 001a-accounts-reader (Accounts & Authentication — Reader)

**Branch**: `001a-accounts-reader` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `src/speckit/specs/001a-accounts-reader/spec.md`, `specs/000-core/spec.md`, and 8 Figma mobile UI design screens.

## Summary

Deliver a production-ready, spec-faithful, and design-accurate authentication and onboarding experience for Students (Readers). This includes:
1. Student registration (`/register`, R-01, FR-AUTH-01) validating POL-02 requirements (university email, student ID format, password rules) and invoking Edge Function `register-student` with atomic rollback on profile creation failure (EC-36).
2. Email verification (`/verify-email`, R-02, FR-AUTH-02) supporting 6-digit verification code (OTP) and link confirmation with automatic status promotion (`pending_verification` -> `active`).
3. Login and Logout (`/login`, R-03, FR-AUTH-03) with anti-enumeration generic error messaging, rate limit handling (429 lockout), and role-based routing (Student to `/`, Admin to `/admin`).
4. Password Recovery (`/forgot-password`, `/reset-password`, R-04, FR-AUTH-04) via email link/code.
5. Pixel-faithful mobile-first UI corresponding to the 8 approved Figma mockups (warm cream `#FAF8F5`, saddle brown `#734A28`, rounded card elements, custom inputs, error banners, and success/error modals).

## Technical Context

- **Language/Version**: TypeScript / JavaScript (ES2022+), React 19
- **Frontend Stack**: React 19, Vite, React Router 6+ (with data router & route guards), TanStack Query, Tailwind CSS, Lucide React (or custom SVG icons matching Figma: book badge, eye, lock, mail, user)
- **Backend Stack**: Supabase Edge Functions (Deno + TypeScript) at `src/supabase/functions/register-student/`
- **Database/Storage**: Supabase Postgres with Row Level Security (RLS) on `public.profiles`, triggers on `auth.users` for email confirmation
- **Shared Package**: `@shelfhelp/shared` (`src/shared/`) for Zod validation schemas and reason codes
- **Target Platform**: Responsive Web (Mobile-first viewport 360px–430px matching Figma, responsive up to 1920px desktop)
- **Scale/Constraints**: NFR-01 (LCP ≤ 2.5s), NFR-06 (Deny-by-default RLS, anti-enumeration messages, rate limits), Principle VI (Server-Writes-Only for role and status)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Requirement | Compliance in this Plan |
|---|---|---|
| **II. RBAC by Default** | `app_metadata.role` is source of truth; student cannot elevate role or access admin data. | Role is set strictly server-side by `register-student` (`role: 'student'`). Profiles RLS permits students to read only own row. |
| **VI. Server-Writes-Only** | Client must never directly INSERT/UPDATE privileged fields (`role`, `status`). | Account registration is routed through Edge Function `register-student` using service-role or elevated RPC, not client direct insert. |
| **VII. Configuration Over Hardcoding** | Domain allowlist and student ID pattern must follow settings defaults. | Zod schema utilizes shared regex and allowlist patterns from `@shelfhelp/shared/settings-defaults`. |
| **VIII. Spec Fidelity** | Preserve FR IDs, ACs, and error reasons (`VALIDATION_FAILED`, `ACCOUNT_NOT_ACTIVE`, `ACCOUNT_RESTRICTED`). | All error contracts and UI behaviors match SRS §12.5 and `001a-accounts-reader/spec.md`. |

## Project Structure

### Documentation (`src/speckit/specs/001a-accounts-reader/`)
```text
src/speckit/specs/001a-accounts-reader/
├── spec.md              # Authoritative feature specification
├── plan.md              # This implementation plan
└── tasks.md             # Work breakdown tasks for execution
```

### Source Code Architecture

```text
src/
├── shared/                                     # @shelfhelp/shared
│   └── src/
│       └── domain/
│           └── auth.ts                         # Zod validation schema for student registration & login
│
├── supabase/
│   ├── migrations/
│   │   └── 0002_auth_triggers.sql              # Trigger to update profiles.status to 'active' on email verification
│   └── functions/
│       └── register-student/
│           └── index.ts                        # Edge Function creating Auth user + profiles row with rollback
│
└── frontend/
    └── src/
        ├── features/
        │   └── auth/
        │       ├── AuthContext.jsx             # Session state, login, register, verifyOtp, logout
        │       ├── LoginPage.jsx               # Matches Figma Screen 1 & 2 (Sign In, Normal & Error states)
        │       ├── RegisterPage.jsx            # Matches Figma Screen 3 (Sign Up)
        │       ├── ForgotPasswordPage.jsx      # Matches Figma Screen 4 (Forgot Password)
        │       ├── VerifyOtpPage.jsx           # Matches Figma Screen 5 (Recovery PIN / 6-digit verification code)
        │       ├── ResetPasswordPage.jsx       # Matches Figma Screen 6 (SetNewPassword)
        │       ├── components/
        │       │   ├── AuthLayout.jsx          # Reusable cream container with book icon header card
        │       │   ├── AuthInput.jsx           # Styled input with prefix icon and password toggle
        │       │   ├── AuthSuccessModal.jsx    # Matches Figma Screen 7 (Registration Completed)
        │       │   └── AuthErrorModal.jsx      # Matches Figma Screen 8 (Something went wrong)
        │       └── routes/
        │           └── AuthRouteGuards.jsx     # Protects routes based on user role and profiles.status
        └── app/
            └── App.jsx                         # React Router integration
```

## Screen-to-Figma Mapping

| Figma Screen Name | Route | Component | Key Visual & Interactive Behaviors |
|---|---|---|---|
| **Sign In** (Screen 1 & 2) | `/login` | `LoginPage.jsx` | Book badge header, Email/ID input, Password input with eye toggle, "Trouble signing in?" link, brown button, "New patron? Sign up" link, inline terracotta error message. |
| **Sign Up** (Screen 3) | `/register` | `RegisterPage.jsx` | Full Name, Student ID, Institutional Email, Password, Confirm Password, Zod validation hints, "Complete Registration" button. |
| **Forgot Password** (Screen 4) | `/forgot-password` | `ForgotPasswordPage.jsx` | Email input, "Send code" button, "Back to sign in" link. Always generic success message to prevent enumeration. |
| **Recovery PIN / Verify Code** (Screen 5) | `/verify-email`, `/verify-otp` | `VerifyOtpPage.jsx` | 6 individual numeric boxes with auto-focus advance, "Resend code" (60s countdown), "Verify code" button, "Change email" secondary button. |
| **SetNewPassword** (Screen 6) | `/reset-password` | `ResetPasswordPage.jsx` | New password, Confirm password, rule compliance hints, "Reset password" button. |
| **Universal Success** (Screen 7) | Modal / View | `AuthSuccessModal.jsx` | Green circular check badge, "Registration Completed", "Welcome to ShelfHelp!", "Back to Home" button. |
| **Universal Error** (Screen 8) | Modal / View | `AuthErrorModal.jsx` | Coral circular 'X' badge, "Something went wrong", "Please try again later", "Try Again" button. |
