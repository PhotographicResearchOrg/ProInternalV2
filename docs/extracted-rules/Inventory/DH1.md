# DH1 — Calculate order requirements for any group

**Source program:** `BP/DH1`
**Domain:** Inventory
**Integration mode:** Batch
**Lines of code:** 61
**Last code change:** 11/19/1985 (header line 2, `DLHSYS`). No changelog
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

A buyer runs this to calculate suggested order quantities for one product group, or for products already selected before the run. For each product it takes last year's sales for the coming N months, scales them by this year's growth compared with last year, subtracts stock and open PO quantity, adds member demand, rounds to the product's order quantity, and writes the result to the `ORDER` work file. It shows only a total at the end. It does NOT choose a vendor, create a PO, or use MOQ/case/carton/min-stock fields.

This is the 1985 predecessor (or alternative) of `IV21`, which writes the same file with a different formula. Confirm which is on the live menu.

## 1.5. Integration footprint

N/A — batch (operator-launched, prompts for parameters). `ORDER` is an internal work file.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master: sales history, stock, open POs, member demand, order qty | READ |
| CONTROL | `UPD` attr 2 = month of the last monthly update | READ |
| ORDER | Suggested-order work file: key = product, attr 1 = qty | WRITE (optional CLEARFILE) |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `EXECUTE 'SSELECT IVMST WITH GRP = ... BY DESC'` | Product selection when a group is entered (line 21) |

**Internal labeled sections (subroutine-like):** none.

## 4. Business rules — extracted

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| DH1.01 | The buyer may clear the `ORDER` file first (`Y`). | 16–17 | SIMPLIFY |
| DH1.02 | The buyer enters months of supply (MS, decimals allowed, e.g. 2.5) and a group number. A blank group uses whatever select list is already active, so products can be pre-selected by any criteria. | 18–21 | SIMPLIFY |
| DH1.03 | Products with IVMST attr 2 `ORD.QTY` < 1 (no order quantity) or attr 15 `STATUS` > 0 are skipped. | 24–25 | QUESTION |

DH1.03: Should a product with no order quantity on file really be excluded from suggestions, and which STATUS values mean "do not reorder"?

### 4.2 Date and sales-history rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| DH1.04 | Months elapsed MON = CONTROL `UPD` attr 2 (month of the last monthly update), minus 1 if that is not the current calendar month or today is before the 20th. If MON = 0 the program stops: "Not enough current year activity". | 10–15 | QUESTION |
| DH1.05 | CURR = sum of IVMST attr 17 (`MORD`, this year by month) for months 1..MON; PREV = the same for attr 18 (`MPYR`, last year). N and O = number of those months with non-zero sales this year and last year. | 26–34 | KEEP |
| DH1.06 | No last-year sales in the period (PREV < 1) but some this year: forecast = INT(MS × CURR / N), i.e. average selling month × months of supply. With no sales in either year PREV is set to 1 and the normal path runs. | 35–38 | KEEP |

DH1.04: Is "the 20th of the month" still the point at which a month counts as complete?

### 4.3 Quantity calculation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| DH1.07 | Growth factor PERC = (CURR / N) / (PREV / O): average selling month this year over average selling month last year. No cap (IV21 caps at 2). | 39–43 | QUESTION |
| DH1.08 | A fractional months-of-supply is rounded **up** to the next whole month (2.5 → 3). The code intended to subtract half of the last month (line 51) but that never runs (see §7). | 44, 51 | QUESTION |
| DH1.09 | Seasonal forecast: sum of last year's sales (attr 18) for the MS months after MON (months MON+1 .. MON+MS). Months past December wrap to **this** year's sales (attr 17) from January. Forecast = INT(sum × PERC). | 45–52 | QUESTION |
| DH1.10 | Net requirement = forecast − on hand (SUM IVMST 24) − open PO qty (SUM IVMST 21) + member demand (IVMST 3 `REQ`). PO backorder balance (attr 23) is **not** deducted. | 53 | QUESTION |
| DH1.11 | Rounded to the nearest multiple of IVMST attr 2 `ORD.QTY` (halves round up). | 54 | QUESTION |
| DH1.12 | Requirements below 10 (including zero/negative) are not written. | 55 | QUESTION |

DH1.07: Should growth be capped, and should it be computed on selling months only (zero months ignored)?
DH1.08: Should partial months be supported, or months of supply be whole numbers?
DH1.09: For months that wrap into next year the code uses this year's actuals and still applies the growth factor, so growth is counted twice. Is that intended?
DH1.10: Should partly received PO balances (attr 23) count as on order?
DH1.11: Is attr 2 `ORD.QTY` the vendor order multiple, or should MOQ (16), CASE (27) or CARTON (33) be used?
DH1.12: Is a 10-unit minimum right for every product?

### 4.4 Persistence

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| DH1.13 | Each result is written to `ORDER` attr 1 keyed by product (overwriting). The total quantity of all suggestions is shown at the end. | 56, 58, 60 | SIMPLIFY |

### 4.5 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| DH1.14 | No locks on IVMST or ORDER. A buyer who clears the file (DH1.01) wipes another buyer's pending suggestions. | 17, 23, 56 | SIMPLIFY |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| CONTROL `UPD` attr 2 | Other (control key) | 10 | Current month of monthly update | QUESTION |
| `20` (day of month) | Magic-date | 11 | Month counts as complete from the 20th | QUESTION |
| `10` | Threshold | 55 | Minimum qty written | QUESTION |
| `10 - @DAY` | Magic-number | 14 | "Wait N days" message (inconsistent with 20) | QUESTION |
| `12` | Magic-number | 46, 50 | Calendar wrap | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVMST (matrix R, DIM 40)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 2 | `QUAN` (local EQU) = ORD.QTY | Skip if < 1; rounding multiple | units | Local EQU name `QUAN` is misleading |
| 3 | REQ | Added to requirement | units | Member demand, confirm |
| 15 | STATUS | Skip if > 0 | code | |
| 17 | MORD | This year by month (MV, value 1 = Jan) | units | |
| 18 | MPYR | Last year by month (MV) | units | |
| 21 | PO.QTY | Open PO qty (MV) | units | |
| 23 | BO | PO backorder balance | units | **Not read** |
| 24 | QTY.REC | On-hand layers (MV) | units | |

No money fields.

### CONTROL `UPD`

| Attr | Used as | Units | Notes |
|---|---|---|---|
| 2 | Month of the last monthly update | 1–12 | Also read by IV.UPD.COGS and IVMST dictionary items |

### ORDER (written)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| @ID | — | Product | — | |
| 1 | QUANTITY | Suggested qty | units | |

## 7. Bug suspects

- **Half month never subtracted (44, 51):** line 51 tests `I=B` after a `FOR I=A TO B` loop, where I is always B+1, so the half-month deduction never happens and 2.5 months always behaves as 3. The line also reads `R(X)<1,I>` one past the window.
- **Order-dependent months of supply (36, 44):** line 44 overwrites MS itself (`MS=INT(MS)+1`). Products processed before the first product reaches line 44 use 2.5 at line 36; all later products use 3. HALF is never reset.
- **Backorder balance ignored (53):** attr 23 is not deducted, so partly received POs are re-ordered (same issue as IV21).
- **Growth applied twice to wrapped months (50, 52):** months past December come from this year's actuals (attr 17) and are still multiplied by PERC.
- **Wrong wait message (14):** the cutoff is the 20th but the message says "wait at least 10 − day days" (e.g. on Jan 5 it says 5 days instead of 15).
- **Window past available data:** with MS + MON > 24 the wrap reads attr 17 months not yet sold (blank), understating the forecast.
- **No MS validation (18):** non-numeric MS gives a zero forecast silently.
- **Blank group with no active list (19–22):** nothing is processed and the total shows 0 with no warning.
- **READU/MATREADU silent-fallthrough:** not present.

## 8. Schema-design notes for the CTO

- Same entities as IV21: Suggested Order Line, Product Monthly Sales History, Product Availability.
- DH1 rounds to IVMST attr 2 `ORD.QTY` and skips products without it. IV21 uses attr 2 only above 100 units, and the dictionary formula uses attr 27 `CASE`. PIV2 needs one defined "order multiple" per product/vendor.
- Member demand (REQ, attr 3) is **added** to the requirement here and **subtracted** from available stock in IV21. Mathematically the same; keep it as one availability formula in PIV2.
- On order must include PO backorder balances, derived from PO lines.
- Missing audit: run parameters, who ran it, buyer overrides.
- Extract before schema commit: `IV21` (done), the monthly update that fills attr 17/18 and CONTROL `UPD`.

## 9. Questions for COO/CFO — consolidated

1. Should products without an order quantity be excluded, and which STATUS values block reordering? (relates to DH1.03)
2. Is the 20th the month cutoff? (relates to DH1.04)
3. Cap the growth factor? (relates to DH1.07)
4. Whole or fractional months of supply? (relates to DH1.08)
5. Is applying growth to this year's actuals for next year's months intended? (relates to DH1.09)
6. Count PO backorder balances as on order? (relates to DH1.10)
7. Which field is the order multiple? (relates to DH1.11)
8. Is 10 the minimum? (relates to DH1.12)
9. Is DH1 or IV21 the live suggestion program? (relates to DH1.05–DH1.13)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 2 | DH1.05, DH1.06 |
| SIMPLIFY | 4 | DH1.01, DH1.02, DH1.13, DH1.14 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 8 | DH1.03, DH1.04, DH1.07, DH1.08, DH1.09, DH1.10, DH1.11, DH1.12 |
| WAREHOUSE-ONLY | 0 | |

Total: 14 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling | `IV21` | Newer (2000) suggestion program, same output |
| Consumer | `IV.ORD.REC` option 2, `IV.AUTO.ORDER` | Turn `ORDER` into a PO |
| File | CONTROL `UPD` | Also used by `IV.UPD.COGS`, AR month-end programs, IVMST dictionary |
| File | IVMST 17/18 | Filled by the monthly update (not extracted) |

**Sibling-series flag:** DH1 and IV21 are alternative versions of the same job. DH1 (1985) is the older one and may be OBSOLETE if IV21 is on the menu. Nothing in BP calls either, so check VOC/PRO.MENU.
