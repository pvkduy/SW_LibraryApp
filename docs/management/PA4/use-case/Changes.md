# ShelfHelp: Smart Library Management System
# Use-Case Specifications — Changes (PA4)

**Version:** 1.0  
**Date:** 27/Nov/2026  
**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Văn Vĩ | **Edited by:** Nguyễn Anh Khôi

---

## Revision History

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 27/Nov/2026 | 1.0 | Initial change record for the PA4 use-case revision | Nguyễn Anh Khôi |

---

## What changed

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
