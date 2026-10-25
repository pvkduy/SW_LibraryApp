# ShelfHelp spec: second round of revisions (core review)

Source: the requirements-quality review of `specs/000-core/spec.md` recorded in
`specs/000-core/checklists/core-quality.md`. This round addresses the five
highest-value remaining gaps (open items CHK025/037, CHK043, CHK034, CHK039, CHK015).
Section and ID references are to `SHELFHELP_FULLSPEC.md` v1.2 plus the first revision
round (`SPEC_REVISIONS_2026-10-25.md`). The spec is unchanged until these patches are
applied.

## Summary

| Item | Verdict | Change needed |
|---|---|---|
| CHK025 / CHK037 | Real gap | Yes: define what happens to a queue when a Book stops circulating |
| CHK043 | Real gap | Yes: fix a blocker precedence order and the error reason to return |
| CHK034 | Real gap | Yes: define the pre-handover damaged-copy case in 5.2 |
| CHK039 | Real gap | Yes: add the `held` -> `lost` rule (and the release-first path) |
| CHK015 | Real gap (process) | Yes: give `[CONFIRM]` rows an owner, a record, and a consequence |

---

## CHK025 / CHK037: a queue for a Book that stops circulating

**Finding.** EC-27 says a book with all copies retired, lost, or damaged is "not
reservable", but nothing says what happens to a queue that already exists. Today a
member could sit in `waiting` forever with no copy that can ever be promoted, and
wishlisters would never be told. POL-13 allows retiring the last copy without any
check on queues.

**Patch: POL-07 (section 4.7), add:**

- A Book is **non-circulating** when it has no copy in `available`, `held`, or
  `borrowed` and no copy that could return to `available` (that is, every copy is
  `retired` or `lost`).
- When a Book becomes non-circulating, the system cancels every `waiting` reservation
  with reason `book_not_circulating`, no strike, and notifies each member. A
  `ready_for_pickup` reservation is not cancelled by this rule; it expires normally at
  its 48 h deadline or is fulfilled by handover if the held copy still exists.
- Wishlist entries stay, but no availability notification is sent while the book is
  non-circulating. Wishlisters are notified only per DEC-27 (0 available -> at least 1).
- If a copy later returns to `available` (a `found` copy, or a return), the book
  circulates again and members may reserve normally.

**Patch: POL-13 (section 4.13), add to the Write-Off Slip bullet:**

- Completing a slip that would make the Book non-circulating is allowed. The slip
  completion runs the POL-07 non-circulating rule in the same transaction, so queues
  are cancelled rather than silently orphaned.

**Patch: section 5.3, add after the existing line:**

- `waiting` -> `cancelled` also occurs when the Book becomes non-circulating
  (reason `book_not_circulating`, no strike).

**Tests:** extend TS-37 (a book whose last copy is retired cancels waiting reservations
without a strike and notifies members) and TS-52 (completing a write-off that empties
the book cancels the queue in the same transaction).

---

## CHK043: blocker precedence and which error reason wins

**Finding.** Section 6.1 defines each column independently, and section 12.5 lists
reasons with no order. A student who is both Restricted and in debt hold, or Restricted
with an expired membership, must get one deterministic `reason`. Today that is
undefined, which also makes the tests non-deterministic.

**Patch: section 6.1, add after the matrix:**

**Blocked-action precedence.** The shared gating function evaluates blockers in this
fixed order and returns the first that applies:

1. Account not `active` (`pending_verification`, `inactive`, `restricted`) ->
   `ACCOUNT_NOT_ACTIVE` (for `inactive` the user cannot log in at all) or
   `ACCOUNT_RESTRICTED` (for `restricted`).
2. Debt hold -> `DEBT_HOLD`.
3. Reservation ban -> `RESERVATION_BAN`.
4. Not a member where membership is required (reserve) -> `NOT_MEMBER`.
5. Entitlement or item limit exceeded -> `LIMIT_REACHED`.

Precedence applies only when the action is blocked for more than one reason. It does
not change which actions are permitted, only the reported reason. The UI shows the
message for the returned reason and must not compute its own precedence.

**Tests:** add to TS-61 (a Restricted student with debt receives `ACCOUNT_RESTRICTED`,
not `DEBT_HOLD`; a member with debt and a reservation ban attempting a reserve receives
`DEBT_HOLD`, not `RESERVATION_BAN`).

---

## CHK034: a `ready_for_pickup` item whose copy is discovered damaged

**Finding.** EC-12 says this is out of scope because swap and staff-cancel are archived
(Section 20.6), and that the item expires or the student cancels. Section 5.2 has no
row for it, so a reader of the state machine sees an unhandled case.

**Patch: section 5.2, add rows:**

| From | Event | To | Actor | Side effects |
|---|---|---|---|---|
| `ready_for_pickup` | Copy found damaged before handover | `ready_for_pickup` | staff | No status change; copy set `damaged` or `under_repair` releases the hold; the item remains and expires at its pickup deadline unless the student cancels. Out of scope to swap or staff-cancel (Section 20.6). |

**Patch: EC-12, replace the body with:**

Held copy found damaged or misplaced. Copies held for a ready item or a ready
reservation: staff mark the copy `damaged` or `under_repair`, which releases the hold.
Swap and staff-cancel are out of scope (Section 20.6). The affected item or reservation
then expires at its 48 h deadline or is cancelled by the student or member. The copy is
not available while `damaged` or `under_repair`.

**Tests:** extend TS-12 or TS-24 (a copy marked damaged while `held` releases the hold,
the item stays `ready_for_pickup`, and it later expires).

---

## CHK039: the `held` -> `lost` case

**Finding.** Section 5.4 has no `held` -> `lost` row. FR-COND-03 and EC-13 say a slip
cannot include a `held` copy and that the hold must be released first, so the intended
answer is "not directly allowed". The table should say so rather than leave it open.

**Patch: section 5.4, add notes under the table:**

- `held` -> `lost` is **not** a direct transition. A copy found missing while `held`
  must first have its hold released by the POL-07/EC-12 path (staff sets the copy
  `damaged` or `under_repair`, which releases the hold), or the hold must expire
  normally. Only a copy in `available`, `damaged`, or `under_repair` can be set `lost`.
- Write-Off Slip completion therefore cannot lose a copy that is `held` or `borrowed`
  (FR-COND-03 already refuses these); on-loan losses go through the loan Lost flow
  (FR-CIRC-05).

**Patch: FR-INV-07, extend the requirement sentence:**

Staff cannot set `borrowed` or `held` manually, and cannot set a `held` copy to `lost`
directly; the hold must be released first per POL-13 and EC-12.

**Tests:** extend TS-49 (attempting to mark a `held` copy lost is refused with the
release-first message).

---

## CHK015: `[CONFIRM]` rows need an owner, a record, and a consequence

**Finding.** About forty decision rows and several policy items are marked
`Confirm = Yes` / `[CONFIRM]`, but no owner is named, there is no sign-off record, and
nothing states what happens if the team ships without sign-off.

**Patch: section 0 (How to use this document), add:**

**Owner sign-off for `[CONFIRM]` and `Confirm = Yes` items.** Each such item is owned by
the product owner named in `docs/DECISIONS.md`. The default in this document is built so
work is not blocked. Sign-off is recorded by appending a dated entry to
`docs/DECISIONS.md` that names the item ID and the confirmed value; an item is
considered confirmed only when that entry exists. Shipping a milestone whose scope
contains an unconfirmed item is permitted, but the item is listed as an open risk in
that milestone's exit review, and changing it later follows the amendment procedure in
the constitution. Milestone M11 requires every `[CONFIRM]` and `Confirm = Yes` item to
be confirmed or explicitly accepted by the owner.

**Patch: section 18.3 (open questions), add a preamble line:**

Each question below is owned by the product owner. Status is tracked in
`docs/DECISIONS.md`, one dated entry per question ID.

**Note (not a spec patch required):** create the `docs/DECISIONS.md` entries when the
team answers. The file already exists and currently holds DEC-LOG-01 (the Flask to
Supabase retirement).
