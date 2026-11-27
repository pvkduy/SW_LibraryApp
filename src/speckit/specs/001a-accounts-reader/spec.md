# Feature Specification: Accounts & Authentication — Reader

**Source**: `specs/SHELFHELP_FULLSPEC.md` — Reader screens R-01..R-04, R-15, R-22, R-23; FR-AUTH-01..05, FR-AUTH-11; FR-PROF-01..03; FR-GLOB-01, 02.

**Created**: 2026-10-23

**Status**: Draft

**Side**: Reader (student)

**Shared context**: `specs/000-core/spec.md` (actors §2, decisions §3 including DEC-57/DEC-58, policies POL-01/POL-02/POL-19, gating §6).

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

A registered user signs in and out securely, routed by role, with lockout protection and an optional persistent session.

**Why this priority**: Login is the gate to all role-scoped functionality.

**Independent Test**: Login as student and admin, verify role redirect, generic errors, lockout, and persistent session (TS-02).

**Acceptance Scenarios** (R-03):

1. **Given** wrong password, **Then** the message does not reveal whether the email exists.
2. **Given** five failures within 15 minutes, **When** the sixth attempt is made even with the correct password, **Then** it returns 429 with `Retry-After` and the sign-in button stays disabled until the countdown ends.
3. **Given** a reload, cleared browser storage, or a switch between email and Student ID during the lockout, **Then** the lockout still applies.
4. **Given** "Keep me signed in" selected, **When** the browser restarts, **Then** the session is restored without re-entering credentials; **Given** it is not selected, **When** the tab closes, **Then** the session ends.
5. **Given** a student, **When** login succeeds, **Then** `/` opens.
6. **Given** an admin, **Then** `/admin` opens.
7. **Given** logout, **Then** browser back does not show private data and the refresh token is invalid.

### User Story 3 - Password recovery (Priority: P2)

A user resets a forgotten password through an emailed link.

**Why this priority**: Losing access blocks the account; recovery is secondary to onboarding.

**Independent Test**: Request reset and reset via link, verify generic messaging and lockout clearing (TS-03).

**Acceptance Scenarios** (R-04):

1. **Given** an unknown email, **Then** the same confirmation text appears.
2. **Given** an expired link, **Then** the reset form is not shown.
3. **Given** a weak new password, **Then** submit is blocked with rule hints.
4. **Given** a locked identifier, **When** the reset link is used and a new password is saved, **Then** the reset succeeds and the failed-attempt counter is cleared.

### User Story 4 - Profile and avatar (Priority: P2)

A student edits personal information, changes password, and manages an avatar.

**Why this priority**: Account self-service, not blocking core borrowing.

**Independent Test**: Edit profile, change password, upload avatar (TS-41, TS-42, TS-67).

**Acceptance Scenarios** (R-15):

1. **Given** an invalid phone, **Then** save is blocked with a message.
2. **Given** a saved change, **Then** it persists after reload.
3. **Given** a wrong current password, **Then** rejected with a specific error and nothing changes.
4. **Given** a successful password change, **Then** every other device is signed out and the current session continues.
5. **Given** a 4 MB PNG avatar, **Then** stored file is at most 300 KB and square.
6. **Given** cancel after crop, **Then** old avatar remains.

### User Story 5 - Manage active sessions (Priority: P2)

A signed-in student reviews the devices signed in to their account and remotely signs out ones they no longer trust.

**Why this priority**: Session control limits damage from a lost or shared device without blocking core borrowing.

**Independent Test**: Sign in from two devices, verify the list, revoke one and all others (TS-67).

**Acceptance Scenarios** (R-23):

1. **Given** two signed-in devices, **Then** only the caller's sessions are listed with device/browser, approximate location, sign-in time, and last-active time; the current one carries a "This device" badge and no tokens are returned.
2. **Given** a missing user agent or IP address, **Then** "Unknown device" or "Unknown location" shows instead of an empty row.
3. **Given** "Sign Out" on another device and confirmation, **Then** its next refresh fails, it returns to sign-in, and the current session stays active.
4. **Given** "Sign Out All Other Sessions" and confirmation, **Then** every other session is revoked and only "This device" remains.
5. **Given** an already-revoked session, **Then** the row is removed and "This session was already signed out" shows.
6. **Given** a network failure, **Then** the row stays, an error with Retry shows, and no success message appears.
7. **Given** the session-list endpoint is unavailable, **Then** the screen offers "Sign Out This Device" and Retry.
8. **Given** a request that names another user's session, **Then** it is rejected with `SESSION_NOT_FOUND` and no data is returned.
9. **Given** an unrecognized device, **Then** the screen recommends changing the password and reviewing account activity.

### Edge Cases

- Email already registered → "already registered, log in or reset password".
- Repeated login failures → server-enforced POL-19 lockout: 429 with `Retry-After`, even for a correct password; the countdown disables the button.
- Lockout bypass attempts (reload, cleared storage, switching between email and Student ID) → still locked; password recovery remains available.
- `inactive` accounts → "Account inactive, contact the library".
- `restricted` accounts → log in and see the restricted banner.
- Mid-submit network drop (register) → idempotent retry creates one account.
- Auth user created but profile insert fails (EC-36) → Auth user deleted.
- Current session revoked from another device → next protected request or refresh fails; local state and the persisted refresh token are cleared, and the user is sent to sign-in with "Your session was signed out on another device. Please sign in again." (EC-37).
- Active-session inventory unavailable → "Active sessions are temporarily unavailable. You can still sign out of this device." with Sign Out This Device and Retry; no cached or partial list (EC-39).
- Successful password reset clears the failed-attempt counter and SHOULD revoke other sessions while keeping the recovery session.
- "Keep me signed in" stores only the refresh token (`localStorage` when checked, `sessionStorage` when not); the password is never stored.
- Unknown device or location → "Unknown device"/"Unknown location", never an empty row.
- Remote revocation is idempotent; an already-expired or already-revoked session is treated as success.

## Requirements

### Functional Requirements

- **FR-AUTH-01** `[PA1 §3.1]` **Register.** SHALL collect POL-02 fields, validate with one shared Zod schema (client+server), create via `register-student` (checks ID/email unused, Auth user role `student`, `profiles` row `pending_verification`, verification email). On `profiles` insert failure, delete the Auth user.
- **FR-AUTH-02** `[PA1 §3.1]` **Email verification.** Show instructions, Resend (60 s cooldown, max 5/hour), "I have verified" button. Trigger sets `active` only when Auth confirms email. Unverified users reach no other screen. 7-day unverified cleanup by job.
- **FR-AUTH-03** `[PA1 §3.1]` **Login and logout.** SHALL authenticate with email or Student ID and password, offer **"Keep me signed in"** (unchecked by default; persists only the refresh token per POL-19), redirect by role (2.2), and sign out on demand. The sign-in form SHALL use a real `<form>` with `autocomplete="username"` and `autocomplete="current-password"`; the app SHALL never read or write the browser credential store. Wrong credentials show one generic message. SHALL enforce the POL-19 lockout: five consecutive failures for the same identifier within 15 minutes locks it for 10 minutes; every blocked attempt returns 429 with a generic message and `Retry-After`, even with the correct password; a successful sign-in or password reset clears the counter; a per-IP/device rate limit runs alongside. `inactive` accounts see "Account inactive, contact the library"; `restricted` accounts log in with the restricted banner. The account menu SHALL link to **Active Sessions** (R-23, FR-AUTH-11). Logout SHALL revoke the current refresh token, clear local session state, persisted session tokens, and client caches, and unsubscribe all listeners.
- **FR-AUTH-04** `[PA1 §3.1]` **Password reset by emailed link.** Accept email, always "If an account exists, we sent a link", send link. Validate recovery session, enforce policy, redirect to login. A successful reset SHALL clear the failed-attempt counter (POL-19) and SHOULD revoke all other sessions (FR-AUTH-11) while keeping the current recovery session. Expired or used link → "Link expired" + re-request. The lockout SHALL never block password recovery.
- **FR-AUTH-05** `[PA1 §3.1]` **(System) Role-based access control and gating.** Enforce roles in route guards, RLS, Edge Function checks, Storage policies. Gating matrix 6.1 by one shared server function, which also applies the fixed blocker precedence (account status → debt hold → reservation ban → not-member → limit) and returns the first matching reason. Students never reach admin data/functions. (AC: admin Edge Function → 403 `FORBIDDEN_ROLE`; cross-student loan query → no row; Restricted + debt → `ACCOUNT_RESTRICTED`.)
- **FR-AUTH-11** `[+]` **Manage active sessions.** Students use `/profile/sessions`; staff use `/admin/profile/sessions`. SHALL call the server-side `list-sessions` Edge Function with the caller's JWT and display only the caller's sessions, most recent activity first: a "This device" badge, device/browser description from the user agent, approximate IP/coarse location when available, sign-in time, last-active time (relative, eventually consistent), and Sign Out for every other session. The session identifier is opaque; the response SHALL never include access/refresh tokens, password hashes, service-role keys, or another user's data. Missing metadata shows "Unknown device"/"Unknown location". Revoking one session SHALL require a confirmation naming the device and sign-in time; revoking all other sessions SHALL confirm that the current session stays active. Revocation SHALL call `revoke-session`/`revoke-other-sessions`, verify ownership, invalidate the refresh token, remove the row only after the Auth service confirms, and audit-log it. Success shows "That device has been signed out." / "All other devices have been signed out."; failure shows "We could not sign out that device. Please try again." Revocation is idempotent (already expired/revoked = success). The current session SHALL end only through normal sign-out (FR-AUTH-03), never remote revocation. Staff manage only their own sessions; account-wide suspension is FR-AUTH-07, which revokes sessions as a side effect. If the list cannot load, still offer "Sign Out This Device" and Retry.
- **FR-PROF-01** `[PA1 §3.2]` **Edit personal information.** Edit name, phone, faculty. Email and student ID read-only. Unsaved changes trigger leave-confirm.
- **FR-PROF-02** `[PA1 §3.2]` **Change password.** Require current password (re-auth), enforce policy, handle `requires-recent-login`. On success SHALL revoke all other sessions through FR-AUTH-11 while keeping the current session active.
- **FR-PROF-03** `[PA1 §3.2]` **Avatar upload or capture with crop.** JPEG/PNG/WebP ≤ 5 MB or camera, square crop, 512×512 JPEG ≤ 300 KB (EXIF honored), upload to `avatars/{uid}/avatar.jpg` (owner-checked), allow removal. Cancel discards; failed upload keeps old.
- **FR-GLOB-01** `[+]` **Status banners.** Persistent banners for Restricted, Debt hold, Reservation ban, Membership expiring (7 days), Pickup ending (<12 h).
- **FR-GLOB-02** `[+]` **Error, forbidden, not found, offline.** Global error boundary with Reload, 403/404 pages, offline banner disabling mutations.

### Key Entities

- **User/Profile**: identity, role (claim copy), status, full name, email, student ID, faculty, phone, avatar, reservation ban, debt, active items.
- **Auth session (derived)**: opaque session ID, device/browser, approximate IP/location, sign-in and last-active times; `active` → `revoked`/`expired`. Read from Supabase `auth.sessions` only through Edge Functions; tokens are never returned (DEC-57).

## Success Criteria

- **SC-001**: New student registers and verifies email in under 3 minutes (TS-01).
- **SC-002**: 100% of role violations return 403 with no admin data exposure (TS-04, NFR-06).
- **SC-003**: Wrong-password messaging never reveals account existence.
- **SC-004**: Avatar output ≤ 300 KB, square, EXIF-correct (TS-42).
- **SC-005**: The active-session list shows only the caller's sessions with no tokens, and remote revocation takes effect on the next refresh (TS-67).
- **SC-006**: A locked identifier cannot sign in until the 10-minute lockout ends, even with the correct password, and password recovery remains available (TS-02).

## Assumptions

- Student identity via university email allowlist + verification (ASM-04).
- UI English only; strings in locale file (ASM-10).
- Admin accounts created by hand; no in-app staff management (DEC-02).
- Sign-in lockout defaults are 5 failures / 15 minutes / 10-minute lockout, server-enforced (POL-19, DEC-58).
- "Keep me signed in" persists only the refresh token; the password is never stored (POL-19, DEC-58).
- Session inventory and revocation run through server-side Edge Functions; the service-role key never reaches the browser (DEC-57).

## Test Scenarios

TS-01, TS-02, TS-03, TS-04, TS-05, TS-06, TS-41, TS-42, TS-60, TS-67.
