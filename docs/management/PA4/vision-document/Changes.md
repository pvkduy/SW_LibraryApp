# ShelfHelp: Smart Library Management System
# PA4 Changes

**Version:** 1.0
**Date:** 27/Nov/2026
**Performed by:** Nguyễn Anh Khôi | **Reviewed by:** Lê Minh Thuận | **Edited by:** Nguyễn Anh Khôi

---

## Revision History

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 27/Nov/2026 | 1.0 | Recorded PA4 use-case changes and the corresponding PA3 Vision Document update | Nguyễn Anh Khôi |

---

## Use-Case Changes

- **UC-02 — Sign in and sign out:** Added a server-enforced temporary lockout after repeated failed attempts, an optional persistent-session flow, explicit credential-storage rules, and the link to active-session management.
- **UC-32 — Manage active sessions:** Reused the retired UC-32 identifier for a new use case that lists the caller's sessions and supports single-session and bulk remote sign-out.
- **Use-Case Diagram 1:** Added UC-32 to the account and identity diagram and updated actor, use-case, and coverage tables.

## Vision Document Update

The PA3 Vision Document was updated to version 2.1:

- FEAT-01 now covers failed-sign-in protection, persistent sessions, and active-session management.
- Authentication/security requirements now specify server-side throttling, password-not-stored rules, revocable refresh tokens, and session-inventory privacy.
- Performance requirements now include sign-in/sign-out and active-session inventory targets.
- The change is traceable to UC-02 and UC-32 in the PA4 use-case package.
