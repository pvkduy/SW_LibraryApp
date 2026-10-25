# Feature Specification: Accounts & Authentication — Reader

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Reader screens R-01..R-04, R-15, R-22; FR-AUTH-01..05; FR-PROF-01..03; FR-GLOB-01, 02.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Reader (student)

**Shared context**: `specs/000-core/spec.md` (actors §2, decisions §3, policies POL-01/POL-02, gating §6).

## User Scenarios & Testing

### User Story 1 - Register and verify (Priority: P1)

A new student creates an account with their university email and student ID, then
confirms their email so the account becomes active.

**Why this priority**: No other feature is reachable without an authenticated account.

**Independent Test**: Register with valid data, verify email, confirm account states (TS-01).

**Acceptance Scenarios** (R-01, R-02):

1. **Given** valid data, **When** submitted, **Then** the user document exists with `pending_verification` and a verification email was sent.
2. **Given** a student ID already in use, **Then** a field error is shown and no Auth user exists.
3. **Given** an email domain outside the allowlist, **Then** the error names the allowed domains.
4. **Given** a network drop mid-submit, **Then** entered data is kept and a retry with the same idempotency key creates exactly one account.
5. **Given** an unverified user, **When** they open `/search`, **Then** redirected to `/verify-email`.
6. **Given** Resend pressed twice within 60 s, **Then** the second press is blocked with a countdown.

### User Story 2 - Login and logout (Priority: P1)

A registered user signs in and out securely, routed by role.

**Why this priority**: Login is the gate to all role-scoped functionality.

**Independent Test**: Login as student and admin, verify role redirect and generic errors (TS-02).

**Acceptance Scenarios** (R-03):

1. **Given** wrong password, **Then** the message does not reveal whether the email exists.
2. **Given** a student, **When** login succeeds, **Then** `/` opens.
3. **Given** an admin, **Then** `/admin` opens.
4. **Given** logout, **Then** browser back does not show private data.

### User Story 3 - Password recovery (Priority: P2)

A user resets a forgotten password through an emailed link.

**Why this priority**: Losing access blocks the account; recovery is secondary to onboarding.

**Independent Test**: Request reset and reset via link, verify generic messaging (TS-03).

**Acceptance Scenarios** (R-04):

1. **Given** an unknown email, **Then** the same confirmation text appears.
2. **Given** an expired link, **Then** the reset form is not shown.
3. **Given** a weak new password, **Then** submit is blocked with rule hints.

### User Story 4 - Profile and avatar (Priority: P2)

A student edits personal information, changes password, and manages an avatar.

**Why this priority**: Account self-service, not blocking core borrowing.

**Independent Test**: Edit profile, change password, upload avatar (TS-41, TS-42).

**Acceptance Scenarios** (R-15):

1. **Given** an invalid phone, **Then** save is blocked with a message.
2. **Given** a saved change, **Then** it persists after reload.
3. **Given** a wrong current password, **Then** rejected with a specific error and nothing changes.
4. **Given** a 4 MB PNG avatar, **Then** stored file is at most 300 KB and square.
5. **Given** cancel after crop, **Then** old avatar remains.

### Edge Cases

- Email already registered → "already registered, log in or reset password".
- Repeated login failures → Supabase Auth 429 lockout message.
- `inactive` accounts → "Account inactive, contact the library".
- `restricted` accounts → log in and see the restricted banner.
- Mid-submit network drop (register) → idempotent retry creates one account.
- Auth user created but profile insert fails (EC-36) → Auth user deleted.

## Requirements

### Functional Requirements

- **FR-AUTH-01** `[PA1 §3.1]` **Register.** SHALL collect POL-02 fields, validate with one shared Zod schema (client+server), create via `register-student` (checks ID/email unused, Auth user role `student`, `profiles` row `pending_verification`, verification email). On `profiles` insert failure, delete the Auth user.
- **FR-AUTH-02** `[PA1 §3.1]` **Email verification.** Show instructions, Resend (60 s cooldown, max 5/hour), "I have verified" button. Trigger sets `active` only when Auth confirms email. Unverified users reach no other screen. 7-day unverified cleanup by job.
- **FR-AUTH-03** `[PA1 §3.1]` **Login and logout.** Email/password auth, "Keep me signed in", role redirect (2.2), sign out. Generic wrong-credential message. 429 lockout. `inactive` message; `restricted` banner. Logout clears caches/unsubscribes.
- **FR-AUTH-04** `[PA1 §3.1]` **Password reset by emailed link.** Accept email, always "If an account exists, we sent a link", send link. Validate recovery session, enforce policy, redirect to login. Expired link → "Link expired" + re-request. Revoke other sessions SHOULD.
- **FR-AUTH-05** `[PA1 §3.1]` **(System) Role-based access control and gating.** Enforce roles in route guards, RLS, Edge Function checks, Storage policies. Gating matrix 6.1 by one shared server function, which also applies the fixed blocker precedence (account status → debt hold → reservation ban → not-member → limit) and returns the first matching reason. Students never reach admin data/functions. (AC: admin Edge Function → 403 `FORBIDDEN_ROLE`; cross-student loan query → no row; Restricted + debt → `ACCOUNT_RESTRICTED`.)
- **FR-PROF-01** `[PA1 §3.2]` **Edit personal information.** Edit name, phone, faculty. Email and student ID read-only. Unsaved changes trigger leave-confirm.
- **FR-PROF-02** `[PA1 §3.2]` **Change password.** Require current password (re-auth), enforce policy, handle `requires-recent-login`. Other sessions SHOULD be signed out.
- **FR-PROF-03** `[PA1 §3.2]` **Avatar upload or capture with crop.** JPEG/PNG/WebP ≤ 5 MB or camera, square crop, 512×512 JPEG ≤ 300 KB (EXIF honored), upload to `avatars/{uid}/avatar.jpg` (owner-checked), allow removal. Cancel discards; failed upload keeps old.
- **FR-GLOB-01** `[+]` **Status banners.** Persistent banners for Restricted, Debt hold, Reservation ban, Membership expiring (7 days), Pickup ending (<12 h).
- **FR-GLOB-02** `[+]` **Error, forbidden, not found, offline.** Global error boundary with Reload, 403/404 pages, offline banner disabling mutations.

### Key Entities

- **User/Profile**: identity, role (claim copy), status, full name, email, student ID, faculty, phone, avatar, reservation ban, debt, active items.

## Success Criteria

- **SC-001**: New student registers and verifies email in under 3 minutes (TS-01).
- **SC-002**: 100% of role violations return 403 with no admin data exposure (TS-04, NFR-06).
- **SC-003**: Wrong-password messaging never reveals account existence.
- **SC-004**: Avatar output ≤ 300 KB, square, EXIF-correct (TS-42).

## Assumptions

- Student identity via university email allowlist + verification (ASM-04).
- UI English only; strings in locale file (ASM-10).
- Admin accounts created by hand; no in-app staff management (DEC-02).

## Test Scenarios

TS-01, TS-02, TS-03, TS-04, TS-05, TS-06, TS-41, TS-42, TS-60.
