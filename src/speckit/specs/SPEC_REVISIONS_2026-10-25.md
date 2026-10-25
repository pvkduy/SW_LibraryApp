# ShelfHelp spec: proposed revisions from the conflict review

Source: seven suspected conflicts (CHK017, 023, 026, 035, 044, 073, 075) checked against `SHELFHELP_SPEC.md` v1.2. The spec file itself is unchanged. Apply these patches when you are ready. Section and ID references are to v1.2.

## Summary

| Item | Verdict | Change needed |
|---|---|---|
| CHK017 | Real gap | Yes: define how multiple fine Charges reconcile with the fine computed at return |
| CHK023 | Real gap | Yes: say that a promoted reservation is a Reservation row, and the Loan Item is created at handover |
| CHK026 | Real bug | Yes: block reserving a book the member already has on loan |
| CHK035 | Wording problem plus a real checklist bug | Yes: fix the terminal-state sentence and the restore checklist |
| CHK044 | Not a conflict | Optional one-line note |
| CHK073 | Not a contradiction, but the check order is undefined | Yes: fix one order for the promotion checks |
| CHK075 | Real gap | Yes: add a short settings-timing policy (POL-18) |

---

## CHK017: fines that persist across payments vs a final amount at return

**Finding.** DEC-16 now lets one loan have several fine Charges (a new one starts after the previous is paid). POL-08 and FR-CIRC-04 still talk about one "running" Charge and a fine "computed at return", and nothing says how they reconcile. Two details are also open: what happens when `fine_per_day` changes mid-loan, and what happens if the nightly job missed a night.

**Patch: add to POL-08 (section 4.8)**
- Each fine Charge stores the overdue days it covers (`days_from`, `days_to`) and the `rate` in force when those days were accrued. A rate change starts a new Charge instead of repricing old days.
- The final fine of a loan is the sum of `days x rate` over all its overdue days up to the return date, capped at the book's replacement price. The cap applies to the total of all fine Charges of the loan.
- At return, the system compares the final fine with the sum of the loan's existing fine Charges (paid and unpaid). It creates a top-up Charge for any missing days (for example, if the nightly job missed a night), at the current rate, so the sum equals the final fine. It never refunds an automatic payment, because accrual never exceeds the final fine.
- A fine Charge that was paid is never changed. The loan's "fine at return" shown to staff is the final fine, with the amount already paid shown next to it.

**Patch: FR-CIRC-04 acceptance, add:** "Given a loan with a paid 4,000 VND fine Charge (2 days) returned after 3 days, then one new 2,000 VND Charge is created and the total is 6,000 VND."

**Tests:** extend TS-25 with the paid-then-returned case and a missed-night case.

---

## CHK023: can a promoted reservation be cancelled like a `ready_for_pickup` loan item?

**Finding.** These are two different records. A promoted reservation is a `reservations` row in `ready_for_pickup` (section 5.3). A `ready_for_pickup` loan item comes from checkout (section 5.2). The spec never says whether a Loan Item also exists while a reservation is ready. That matters because the two cancel paths differ: a cancelled ready reservation has no strike (FR-RES-04), and an expired one earns a strike (POL-07), while an expired loan item does not.

**Adopted rule (patch to POL-07 and section 5.3)**
- While a reservation is `ready_for_pickup`, only the Reservation row exists. No Loan Item exists yet.
- The student cancels it with `cancel-reservation` (FR-RES-04), with no strike. Expiry after 48 hours earns a strike (FR-RES-03).
- At handover, the system creates the Loan Item directly in `borrowed` (`source = reservation`) and sets the reservation to `fulfilled`.
- The reservation gets its own pickup code at promotion (FR-CART-08 covers codes for checkout requests only). Add `pickup_code_hash` to `reservations`.
- The circulation "Ready for pickup" tab (FR-CIRC-01) and the handover search (FR-CIRC-02) list ready reservations as well as ready loan items. In My Loans (FR-LOAN-01), ready reservations appear as reservations, with their own countdown and cancel action.

**Tests:** extend TS-37 (promotion) with handover from a reservation, and TS-39 with the no-strike cancel.

---

## CHK026: two active loans of the same book vs a ready reservation for a book already on loan

**Finding.** This is a real bug. POL-07 allows reserving a book whenever it has zero available copies, and never checks whether the member already has it. Scenario: a member borrows the last copy (zero available), reserves the same title, and when another copy is returned it is promoted to them. Handover would create a second active loan of the same book, which POL-04 and the unique index in 12.2 forbid.

**Patch: POL-07 and FR-RES-01**
- A member cannot reserve a Book for which they hold an active Loan Item or an open request (`awaiting_payment`, `payment_failed`, `ready_for_pickup`, `borrowed`, `overdue`). The function returns `DUPLICATE_ACTIVE_LOAN`, and the book page shows "You already have this book".
- Because a cross-table rule cannot be a simple unique index, `reserve-book` checks it inside its transaction, and `promoteForBook` checks it again at promotion (see the order in CHK073).

**Tests:** add to TS-37: reserving a book you have on loan is refused.

---

## CHK035: `lost` is "terminal only after verification" but the table has `lost -> returned`

**Finding.** The table row is not a contradiction. `lost -> returned` is resolution path A, and after it the item is `returned`, which is terminal. The sentence is still confusing because it ties "resolved" to admin verification, and that exposes a real bug.

- **Bug.** The restore checklist (section 4.9) says "no Loan Item `lost`". In path B (replacement paid, book not returned) the item stays `lost` forever, so the checklist can never pass, yet FR-AUTH-08 says path B enables Restore.
- **Related.** The spec never says who sets `lost_resolved_at`.

**Patch: section 5.2 terminal-states sentence, replace with:** "Terminal states: `expired`, `cancelled`, `returned`, and `lost` once `lost_resolved_at` is set. The system sets `lost_resolved_at` when the loss is settled: the book is returned (path A, and the item also moves to `returned`) or the replacement is paid in full (path B, and the item stays `lost`). Settling a loss does not restore the account. That is the separate admin action in FR-AUTH-08."

**Patch: section 4.9 restore checklist:** change "no Loan Item `lost`" to "no Loan Item in `lost` with `lost_resolved_at` empty".

**Patch: DEC-17** replace "Administrator verifies either path" with "Admin verifies by restoring the account (FR-AUTH-08)". Tests TS-29 and TS-30 already cover both paths. Add the check that path B passes the checklist.

---

## CHK044: Reserve is blocked for non-members in 6.1 and in POL-03

**Finding.** Not a conflict, only the same rule stated twice. In POL-03, `can_reserve = false` is part of the non-member entitlements. In 6.1, the Non-member column repeats it. The real risk is two sources of truth.

**Optional patch: one line under the 6.1 matrix:** "The Non-member column is derived from entitlements (FR-MEM-05), for example `can_reserve = false`. The gating function reads entitlements and must not hard-code a separate non-member rule." No other change needed.

---

## CHK073: non-member limit (DEC-23) vs cancel-or-skip at promotion (DEC-26)

**Finding.** They do not contradict each other.

- DEC-23 governs new requests by someone whose membership has expired.
- DEC-26 governs promotion, and an expired member is cancelled there.
- A member with an active membership at their item limit is skipped, which matches EC-10.

What is missing is the order of the checks, because a member can fail several at once (expired membership and over the limit).

**Patch: POL-07, replace the "applies DEC-26 rules" step with this fixed order.** For each queue member, front first:
1. Account not `active` (restricted or inactive), or debt hold, or no active membership: cancel the reservation with a reason, no strike.
2. Member already has an active Loan Item or open request for this Book (see CHK026): cancel with a reason, no strike.
3. Counted items + 1 is more than the member's limit (DEC-22): skip, keep position, notify once.
4. Otherwise promote this member and stop.

A reservation ban does not affect existing reservations. **Tests:** TS-37 case with an expired member who is also over the limit (cancelled, not skipped).

---

## CHK075: do settings changes apply to in-flight transactions and records?

**Finding.** EC-07 covers the narrow case (a checkout reads one consistent settings version). It does not say what happens to records that already exist. One example is fines: FR-SET-01 says new fines use the new rate "from the next nightly run", but a running fine Charge is ambiguous.

**Patch: add policy POL-18 "Settings timing" (new section 4.19) and extend EC-07 to reference it.**

Rules:
1. A function reads settings once, at the start of its transaction (one `settings.version`). A scheduled job reads them once at the start of each run.
2. A change applies to actions that start after it commits. Values already written onto a record never change.

| Stored on the record at creation (never changed afterwards) | Read live by later actions |
|---|---|
| Premium fee and duration (loan item), `due_at` | Non-member limits, queue and wishlist limits, suggestion limits |
| `payment_deadline`, `pickup_deadline`, reservation `hold_until` | Pickup and payment window lengths (for new items only) |
| Membership snapshot (price, dates, privileges) | Fee for new checkouts; plan list |
| Fine Charge `rate` and days (CHK017); damage and loss Charge amounts | `fine_per_day` (for days accrued after the change) |
| `reservation_ban_until`; notifications already created | Strike window and threshold (for new strikes); chat rate limits |

Two cases need care:
- **`lost_threshold_days`** is read at each nightly run, so lowering it can convert many existing overdue loans to `lost` in one night. Before saving, the settings screen shows "N loans would convert at the next run".
- **Renewals** use the current entitlements at the moment of renewal (DEC-53). Member privileges come from the membership snapshot.

**Tests:** extend TS-34 with a fine-rate change mid-loan (new rate applies only to new days) and a lowered lost threshold (preview count shown).
