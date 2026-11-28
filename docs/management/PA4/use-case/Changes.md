# ShelfHelp: Smart Library Management System
# PA4 Changes

**Version:** 1.1
**Date:** 28/Nov/2026
**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

> **Implementation status:** This change record describes requirements, not completed implementation. UC-02 application-enforced lockout and selectable persistence and UC-32 session management remain PA5 targets; see [UC-02](UC02.md) and [UC-32](UC32.md).

---

## Revision History

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 27/Nov/2026 | 1.0 | Initial change record for the PA4 use-case revision | Nguyễn Anh Khôi |
| 28/Nov/2026 | 1.1 | Merged Vision Document changes section into this file (single Changes.md per PA submission) | Nguyễn Anh Khôi |

---

## 1. Use-Case Specifications

**UC-02 — Sign in and sign out.** Added Alternative Flow 2.2.3, *Temporary Lockout
After Repeated Failures*: after five consecutive failed sign-in attempts for the same
email/Student ID within 15 minutes, the identifier is locked for 10 minutes. The
lockout is enforced server-side, returns a generic message with `Retry-After`, applies
to both email and Student ID sign-in, and is paired with a per-IP/device rate limit.
A successful sign-in or password reset clears the counter. Added Alternative Flow
2.2.7, *Persistent Session ("Keep Me Signed In")*, together with Sections 3.4 and 3.5:
the web app never stores the password; "remember me" persists only the Supabase
refresh token in `localStorage` (or `sessionStorage` when unchecked), while the
browser's own password manager handles credential saving through standard
`autocomplete` attributes. Added the corresponding preconditions and postconditions,
and linked the sign-out flow to UC-32.

**UC-32 — Manage active sessions (new).** Added a use case for the account-menu
screen that lists the caller's signed-in devices and lets the user remotely sign out
one session or all other sessions. The flow covers the session list (device/browser,
approximate IP/location, sign-in and last-active times, "This device" marker), single
and bulk revocation, stale or already-revoked sessions, network failures, an
unavailable session list, an unrecognized device, and revocation of the current
session through UC-02. The use case requires a server-side session-inventory and
revocation endpoint (for example, a Supabase Edge Function using the service role)
because the Auth session table is not exposed through PostgREST. Traceability:
`FEAT-01`, `FR-AUTH-03`, `FR-AUTH-04`, `FR-PROF-02`.

**Use-Case Diagram 1.** Added UC-32 and its associations to the Student, Librarian,
and Authentication and email service actors; updated the actor table, the Diagram 1
summary table, and the coverage table. Diagram 1 was regenerated from the Mermaid
source. Diagrams 2–5 are unchanged and remain in
`docs/management/PA3/use-case-diagrams/`.

---

## 2. Vision Document

The PA3 Vision Document was updated to version 2.1:

- FEAT-01 now covers failed-sign-in protection, persistent sessions, and active-session management.
- Authentication/security requirements now specify server-side throttling, password-not-stored rules, revocable refresh tokens, and session-inventory privacy.
- Performance requirements now include sign-in/sign-out and active-session inventory targets.
- The change is traceable to UC-02 and UC-32 in the PA4 use-case package.

---
