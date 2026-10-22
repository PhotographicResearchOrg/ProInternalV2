# IV6.PO — Inventory ordering and receiving USING IVPO (early IVPO version)

**Source program:** `BP/IV6.PO`
**Domain:** Inventory
**Integration mode:** Interactive
**Lines of code:** 182
**Last code change:** No "Last updated" line; latest changelog entry 12-5-02 SJL (line 5)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This is a late-2002 version of the ordering and receiving screen, written while IVPO was being introduced. It offers manual PO creation (directly on the product, not in IVPO), automatic creation from the `ORDER` work file, and receiving (manual or full-PO). **It cannot run as written.** It writes and reads a file variable `MST` that is never opened (it opens `IVMST TO IVMST`), so every option fails at its first `MST` access. Its value today is as evidence of the 2002 data layout, in particular IVMST attr 23 holding the **order date**, and of the single-value PO total in IVPO attr 12.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master (opened as `IVMST`; code also uses unopened `MST`) | READ+WRITE (intended) |
| IVPO | Purchase order | READ+WRITE |
| ORDER | Work file of products to order | READ+WRITE (CLEARFILE) |
| RECLOG | Receipt log | WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `CHAIN 'ABORT'` | File open failure (12–15) |
| `INCLUDE UTLBP I_GETWHO` | Sets `USER` |

**Internal labeled sections (subroutine-like):** none over 10 lines called from more than one place.

| Internal label | Approximate lines | Called from |
|---|---|---|
| — | — | — |

## 4. Business rules — extracted

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.PO.01 | The menu offers 1 = manual creation, 2 = automatic creation, 3 = receive. | 20–28 | OBSOLETE |
| IV6.PO.02 | PO number must be exactly 5 digits. | 32–34 | OBSOLETE |
| IV6.PO.03 | Date must be MM.DD.YY, valid and not in the future; it has no default. | 35–42 | OBSOLETE |
| IV6.PO.04 | Receiving asks for a yen rate (×100) and an additional-charges % (×100) on every PO. There is no stored or default rate. | 44–57 | OBSOLETE |

### 4.2 PO creation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.PO.05 | Manual creation: the product must exist. If the PO is already on the product, it is refused with "make changes in the adjustment program". The latest RAW cost is shown (yen or $). The line is written **only to IVMST**: 20 = PO, 21 = qty, 22 = RAW (IVMST 19), **23 = order date**. IVPO is not written. | 60–96, 119 | OBSOLETE |
| IV6.PO.06 | Automatic creation works as in IV.ORD.REC.09–14. In addition it keeps IVPO attr 12 as a **single PO-level running total** of qty × RAW, keeping a `Y` suffix when the existing total was yen. | 158–181 | OBSOLETE |

### 4.3 Receiving

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.PO.07 | Manual receiving: remaining = IVMST 21 + 23. A receipt equal to the remaining removes the PO from the product. **Over-receipt is refused.** A partial receipt sets 23 = remaining − Q and blanks 21. | 99–108 | OBSOLETE |
| IV6.PO.08 | Receipt valuation: unit cost from IVMST 22 × Q, yen converted with `INT(cost/CONV×10000+.5)`, plus the landed % (`+.05` rounding). Manual receipts always append a new cost layer (24 qty, 25 value, 26 date), with no handling of negative stock. | 109–112 | OBSOLETE |
| IV6.PO.09 | RECLOG record per receipt: 1 product, 2 qty, 3 landed extended cost, 6 PO. Key date*time*user*seq. | 113–116, 146–149 | OBSOLETE |
| IV6.PO.10 | Full-PO receiving: the PO must exist in IVPO. Each line is received for IVMST 21 only (not 23) and the PO is removed from the product. A negative first layer is merged by adding qty and full cost. IVPO attr 9/11/12 get receipt subvalues. | 121–154 | OBSOLETE |
| IV6.PO.11 | PO closed (IVPO 13 = 1) when `SUM(IVPO 11) ≥ SUM(IVPO 7)`. | 155 | OBSOLETE |

### 4.4 Variant status

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.PO.12 | The program is non-functional (unopened `MST`) and has no "Last updated" line. Confirm it is not on any menu and archive it. | 12, 119, 131, 145, 166, 178, 180 | QUESTION |

IV6.PO.12: Is IV6.PO referenced by any menu? If not, mark the whole program OBSOLETE.

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `'5N'` | Other (format) | 32 | PO number format | QUESTION |
| 10000, 0.05 | Magic-number | 110–111, 137–138 | Rate/pct scaling, rounding | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVMST (matrix M, DIM 30)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 4 | DESC | Display | — | |
| 5 | VEND | New PO vendor | — | |
| 19 | RAW | PO cost source | USD cents or whole yen + `Y` | |
| 20 | PO.NO | Open PO (MV) | — | |
| 21 | PO.QTY | Open qty (MV) | units | |
| 22 | PO.CST | Unit cost (MV) | USD cents or whole yen + `Y` | |
| 23 | (BO in later programs) | **Order date** (line 95) **and** BO qty (line 107) | Pick date / units | **Overloaded in this program.** BLD.IVPO later moved the date to IVPO 2 |
| 24–26 | QTY.REC / AMT.REC / DATE.REC | Cost layers | units / USD cents / date | |

### IVPO (matrix PO, DIM 30)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 1 | VEND | Vendor | — | |
| 2 | DATE | PO date | Pick date | |
| 6–8 | PROD / QTY.ORD / COST | Lines | units / cents or yen+`Y` | |
| 9, 11 | QTY.REC / DT.RECD | Receipts (SV) | units / date | |
| 12 | COST.REC | **Single PO total** (auto-create, 173–176) **and** per-receipt subvalues (auto-receive, 152) | USD cents or yen+`Y` | **Overloaded** |
| 13 | RECD | Closed flag | 1 | |

## 7. Bug suspects

- **Unopened file variable `MST` (12 vs 119, 131, 145, 166, 178, 180):** fatal runtime error on first use. Every option fails.
- **Lock ignored (71):** `MATREADU ... LOCKED LCK=1 ELSE` never tests LCK. On a locked record the code goes on with the previous product's matrix: a silent fallthrough with stale data.
- **Attr 23 date/qty conflict (95 vs 99, 107):** creation stores a date in 23, and receiving adds 23 to the open qty, so remaining becomes qty + roughly 12,000 days.
- **Wrong variable in RECLOG (146):** full-PO receiving logs `ID` (the last manually entered product) instead of `PROD`.
- **Wrong index and unconditional IVPO update (152):** the IVMST position `POS` is used as the IVPO line index. Line 152 runs even when `LOCATE` failed, with stale `Q`, `POS` and `CST`.
- **Closure compares dates to quantities (155):** `SUM(PO(11))` is a sum of receipt dates.
- **Mixed currency total (173–176):** the PO total adds dollar-cent and yen line values together.
- **Manual creation never writes IVPO (88–96):** the PO exists only on products.

## 8. Schema-design notes for the CTO

- No entities beyond IV.ORD.REC.
- Data archaeology: IVMST 23 held order dates before BLD.IVPO (02/2003). Old IVPO records may carry a single PO total in attr 12 instead of per-receipt subvalues. Migration scripts must detect both shapes.

## 9. Questions for COO/CFO — consolidated

1. Is IV6.PO referenced anywhere? (IV6.PO.12)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 0 | |
| SIMPLIFY | 0 | |
| OBSOLETE | 11 | 01–11 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 1 | 12 |
| WAREHOUSE-ONLY | 0 | |

Total: 12 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Canonical | `IV.ORD.REC` | Current logic |
| Sibling | `IV6`, `IV.ORD.REC.N`, `IV.AUTO.ORDER` | Family |
| Conversion | `BLD.IVPO` | Built IVPO from IVMST 20–23 (02/2003), clearing the attr-23 dates this program wrote |
| Files | IVMST, IVPO, ORDER, RECLOG | Shared |

**Sibling-series flag:** early variant in the IV6 family; non-canonical and non-functional. Candidate for OBSOLETE without further extraction.
