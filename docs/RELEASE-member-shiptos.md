# Member ship-tos vs Computyme: release notes

Step 1 of the ship-to cutover. It shows where SQL and Computyme disagree and changes no data anywhere.

## Why
Orders go to Computyme as `account-code` (for example `2377-01`), and Computyme ships to its own copy of that address:
- `00` is ARMST attrs 31-32.
- `01` and up are in the SHIPTO file.

SQL addresses are edited on the B2B site and never reach Computyme, so the two copies drift apart.

## Run (all read-only, safe to run twice)
1. In EDA, `sql/member-desk/00-shipto-mirror.sql`: checks the SHIPTO mirror (`SHIPTo.SHIPTO`).
2. In PRO, `sql/member-desk/01-shipto-compare.sql`:
   - builds `piv2.vComputymeShipTo` from the mirror's real columns;
   - creates the comparison function and procedures;
   - adds `members.shipto` to the cutover map (insert-only).

   Run it again if the mirror's columns change.

## What changed
- **Member Desk › Locations** gets a Computyme column showing what Computyme has for each ship-to. Each row gets one of these statuses:

  | Status | Meaning |
  |---|---|
  | Matches | Computyme has the same address. |
  | Different | Same code, different address; the row also lists which parts differ. |
  | Not in Computyme | Mapped here, but Computyme has no ship-to with that code. |
  | Only in Computyme | Computyme has the ship-to; nothing here maps to it. |
  | Bad code | The mapping's code isn't a ship-to number (for example `99999999`). |
  | Duplicate code | Two addresses share one code. |
  | Address missing / Address off | The mapping points at a missing or switched-off address. |
  | Not mapped | Shipping address with no ship-to number. |

  It also notes what Computyme can't hold: address line 2, a street over 25 characters, a city over 15, "City, ST ZIP" over 25, and anything outside the US and Canada.
- **All members check** downloads every mismatch across all members as Excel.
- **API:** `GET api/members/{account}/shiptos` and `GET api/members/shipto-issues` on the existing MemberController. No new permission is needed.
- **Order export fix:** the Computyme order file now sends `account-code` for extra ship-tos.
  - The canonical export read the code from a field nothing filled in, so every order would have gone to the default ship-to. It now reads `references.computymeShipTo`.
  - A code that isn't 1-2 digits (for example `99999999`) now kicks the order out to review instead of shipping it to the wrong place.
  - Blank, `0` and `00` still mean the default ship-to.

## Next
1. Fix mismatches.
2. Move address and ship-to editing to the Member Desk.
3. Have Computyme ship to the address on the order, at which point SQL becomes master.
