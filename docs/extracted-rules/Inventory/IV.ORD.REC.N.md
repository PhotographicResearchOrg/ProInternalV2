# IV.ORD.REC.N — Inventory ordering and receiving USING IVPO (RENAMED from IV6), Entry-No variant

**Source program:** `BP/IV.ORD.REC.N`
**Domain:** Inventory
**Integration mode:** Interactive
**Lines of code:** 523
**Last code change:** 24 May 2012 (header line 3; changelog 05-24-12 SJL "Prompt for Entry-No from Broker & Modify all inputs and outputs")
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

> **Scope of this extraction:** differences from `IV.ORD.REC` only, per instruction. Every rule in `IV.ORD.REC.md` (IV.ORD.REC.01–40) applies to this program unchanged unless it is overridden below. The comparison used `diff IV.ORD.REC IV.ORD.REC.N`. About 80% of the 505 diff lines are screen positioning (`DSP.DATA`/`DSP.HELP`/`INP.DATA` replacing `CRT`/`INPUT`) and carry no business change.

## 1. Purpose — what this program does

This is the same order, auto-create and receive program as `IV.ORD.REC`, with a full-screen cursor-addressed UI (`EDIT.LINE`). It adds three business changes. During receiving it asks for a customs broker **Entry-No** and stamps it on every product received. It refuses to work on a PO already flagged as received in full. It changes how the yen rate is entered and stored. It is dated three months after `IV.ORD.REC` and may be the version actually in use. That must be confirmed.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

Same as IV.ORD.REC, plus:

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST attr 55 (`ENTRY.NO`) | Customs entry number of the last receipt | WRITE (new) |
| CONTROL `YEN.CONV` | Now read with a lock at startup | READ+WRITE |

## 3. External subroutines / chained programs called

Same as IV.ORD.REC, plus:

| Subroutine or program | Used for |
|---|---|
| `CALL EDIT.LINE(IP,MAX,ICOL,IROW,'L',INS,UP,EIXT)` | Field-level screen input (line 449) |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| `READU.YEN.CONV` | 493–511 | 61, 193, 205 |
| `INP.DATA` | 446–453 | All prompts |
| `DSP.DATA` / `DSP.HELP` | 513–521 | All output |

## 4. Business rules — extracted

### 4.1 Customs entry number (new)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.N.01 | When receiving (option 3 only), after the yen rate and % prompts, the operator must enter a customs broker Entry-No in the format 2 letters + 1 digit − 7 digits − 1 digit (e.g. `RS3-1234567-1`), or `XXX` to bypass. The prompt repeats until the entry is valid or the operator exits. | 221–233 | KEEP |
| IV.ORD.REC.N.02 | The Entry-No (or blank when bypassed) is written to IVMST attr 55 `ENTRY.NO` on every product received in the session, by both manual and auto receive, overwriting the previous value. It is not saved on IVPO, RECLOG or anywhere else per receipt. | 232, 400 | QUESTION |

IV.ORD.REC.N.02: Should the customs entry number belong to the receipt or shipment (PO receipt) instead of the product? Is "last entry number per product" used anywhere, for example duty drawback, HS/COO reporting or 3PL?

### 4.2 PO status gate (new)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.N.03 | A PO whose closed flag is set (IVPO attr 13 = 1) is refused with "<PO> has been received in full", for every option, including adding auto-created lines to that PO number. This overrides IV.ORD.REC.03 for closed POs. | 166–169 | KEEP |

### 4.3 Yen rate entry (changed)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.N.04 | The yen rate prompt is pre-filled with the stored rate as a decimal (e.g. `110.00`). Accepted inputs are a whole number of 3 or more digits (read as rate ×100, so `11000` = 110.00) or a number with exactly 2 decimals (multiplied by 100). This replaces IV.ORD.REC.26 input handling. | 192–204 | SIMPLIFY |
| IV.ORD.REC.N.05 | The entered rate is always written back to CONTROL `YEN.CONV` attr 2, even when unchanged. Attr 1 (the date of the rate) is **not** updated, unlike IV.ORD.REC, which writes today's date. | 205–209 | QUESTION |
| IV.ORD.REC.N.06 | CONTROL `ABO` and `BORUN` must exist; if either is missing the program aborts. (IV.ORD.REC only printed a message and continued.) | 57–59 | KEEP |
| IV.ORD.REC.N.07 | CONTROL `YEN.CONV` is read with a lock at startup and again before each rate entry. The lock is retried every 5 s, 12 times, and the program then stops. If the record is missing the program aborts. | 61, 192–194, 205, 493–511 | SIMPLIFY |

IV.ORD.REC.N.05: Should the rate date be recorded? Today the screen shows "Use YEN to $ conversion from <date>" with a date that never moves after the first save.

### 4.4 Operator input conventions (changed)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.N.08 | In manual receiving, product entry ends on `0`, `E`, `END`, ESC or a stop word, which writes the PO and the closed-flag check. The quantity prompt defaults to 0, and 0 or blank shows "Skipped". A non-numeric quantity re-prompts with no message. | 263–271, 296, 312–315 | SIMPLIFY |
| IV.ORD.REC.N.09 | All typed input is upper-cased, and `E`, `END` or ESC sets the exit flag. | 446–453 | SIMPLIFY |

### 4.5 Variant status

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.N.10 | This variant and `IV.ORD.REC` share the same 2012 changelog up to 02-17-12. `.N` adds the 05-24-12 change. Only one should be live. Confirm which one VOC/menu runs; the other is OBSOLETE. | 1–5 | QUESTION |

IV.ORD.REC.N.10: Which program do receiving clerks actually run today?

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `2A1N'-'7N'-'1N` | Other (format) | 229 | US Customs entry number format (filer code + entry + check digit) | QUESTION |
| `XXX` | Magic-number | 229, 232 | Bypass Entry-No | QUESTION |
| `'3N0N'`, `'1N0N"."2N'` | Other (format) | 199 | Yen rate input formats | QUESTION |
| 12 × 5 s | Threshold | 499–501 | YEN.CONV lock wait | QUESTION |
| `0` | Magic-number | 266 | Ends product entry | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

Same as IV.ORD.REC §6, with these differences:

### IVMST (read into matrix M, **DIM 360**, up from 30)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 55 | ENTRY / ENTRY.NO (`IVMST.ENTRY.NO`) | Last customs entry number | — (text) | Dictionary shows conv `MDZ` (numeric), which conflicts with the alphanumeric value written here. Confirm |

### CONTROL `YEN.CONV`

| Attr # | Used as | Units | Notes |
|---|---|---|---|
| 1 | Rate date | Pick date | No longer updated by this program |
| 2 | Yen per USD ×100 | integer | |

## 7. Bug suspects

- **Rate-entry ambiguity (199, 204):** `3N0N` accepts `110` as a whole number, which is stored as 1.10 ¥/$ (rate ×100). An operator who types the rate without decimals values yen goods 100× too high. The help text shows 5-digit examples only.
- **Stale rate date (205–208):** attr 1 is never refreshed, so the displayed "from" date is misleading.
- **YEN.CONV locked from startup (61) until the first PO prompt's `RELEASE` (137):** an operator sitting at the main menu blocks other `.N` users for 60 s, and then those users STOP. `IV.ORD.REC` users block indefinitely, because its `READU` at line 158 has no LOCKED clause.
- **Entry-No overwrite (400):** bypassing with `XXX` blanks the Entry-No of every product received, which erases the previous shipment's number. Auto-receive stamps the same Entry-No on all lines, even if the PO arrived in several shipments.
- **Dictionary/data mismatch:** IVMST attr 55 dictionary conversion `MDZ` (numeric) vs the alphanumeric `RS3-1234567-1` written.
- All bug suspects listed in IV.ORD.REC §7 apply here too (PO net closure, no transaction guard, duplicate lines, COGS over-correction, batch flag stuck).
- READU/MATREADU silent-fallthrough: none observed. All lock loops use LOCKED clauses.

## 8. Schema-design notes for the CTO

- Customs entry number belongs on a **receipt or shipment** entity, possibly with broker, entry date and duty, not on the product.
- The FX rate needs its own table with effective date and source. This program already loses the effective date.
- Confirm the live variant before building from either. Business behaviour differs only in IV.ORD.REC.N.01–05.
- No other schema implications beyond IV.ORD.REC §8.

## 9. Questions for COO/CFO — consolidated

1. Where should the customs entry number live, and who uses it? (IV.ORD.REC.N.02)
2. Should the date of the FX rate be recorded with each rate change? (IV.ORD.REC.N.05)
3. Which of IV.ORD.REC and IV.ORD.REC.N is in production? (IV.ORD.REC.N.10)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 3 | 01, 03, 06 |
| SIMPLIFY | 4 | 04, 07, 08, 09 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 3 | 02, 05, 10 |
| WAREHOUSE-ONLY | 0 | |

Total: 10 rules (differences only; inherits IV.ORD.REC.01–40).

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Canonical | `IV.ORD.REC` | Base logic; see that extraction |
| Sibling | `IV6`, `IV6.PO`, `IV.AUTO.ORDER` | Earlier family members |
| Subroutine | `EDIT.LINE` | Screen input (new) |
| Subroutine | `IVPO.ON.ORD`, `IV.UPD.COGS` | Unchanged |
| Program | `IV46`, `IV11.AUTO` | Unchanged |
| File | IVMST attr 55 `ENTRY.NO` | Shared with IV.MNT.PROD (product maintenance), assumed; confirm |

**Sibling-series flag:** `.N` suffix variant of `IV.ORD.REC`, and the later of the two (24 May 2012 vs 17 Feb 2012). It cannot be assumed obsolete: it may be the live one. Confirm.
