# FIX.IVPO — Update qr and dr and cr

**Source program:** `BP/FIX.IVPO`
**Domain:** Inventory
**Integration mode:** Utility/maintenance
**Lines of code:** 25
**Last code change:** 02/24/2003 (header line 3)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This one-off repair from February 2003 fills in the receipt fields on IVPO lines ("qr" qty received, "dr" date received, "cr" cost received) from the receipt log RECLOG. It processes whatever RECLOG keys are in the active select list, so the operator must run a `SELECT RECLOG ...` first. It predates per-receipt subvalues (03-14-06) and would damage current data if re-run.

## 1.5. Integration footprint

N/A — utility/maintenance.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| RECLOG | Receipt log (source) | READ |
| IVPO | Purchase order (target) | READ+WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| (none) | Relies on an active select list from TCL |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| — | — | — |

## 4. Business rules — extracted

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| FIX.IVPO.01 | The program processes only the RECLOG keys in the caller's active select list. It runs no SELECT of its own. | 10–12 | OBSOLETE |
| FIX.IVPO.02 | For each receipt: PO = RECLOG 6, product = RECLOG 1. On that PO's line for the product, it **overwrites** qty received (IVPO 9) = RECLOG 2, cost received (IVPO 12) = RECLOG 3, and date received (IVPO 11) = **today's date** (run date), not the receipt date. | 13–19 | OBSOLETE |
| FIX.IVPO.03 | A receipt whose PO does not exist, or whose product is not on the PO, is skipped silently. | 15–16, 20–22 | OBSOLETE |

## 5. Hard-coded business identifiers found

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### RECLOG (matrix RLOG, DIM 15)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 1 | PROD | Product | — | |
| 2 | QUAN | Qty received | units | |
| 3 | AMOUNT | Extended landed cost | USD cents | |
| 6 | PO | PO number | — | |

### IVPO (matrix PO, DIM 40)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 6 | PROD | Line product (MV) | — | |
| 9 | QTY.REC | Qty received (MV) | units | Whole value overwritten |
| 11 | DT.RECD | Date received (MV) | Pick date | Set to run date |
| 12 | COST.REC | Cost received (MV) | USD cents | Whole value overwritten |

## 7. Bug suspects

- **Wrong date (18):** uses `DATE()` (run date) although the receipt date is in the RECLOG key.
- **Overwrite, not accumulate (17):** several receipts for the same PO line collapse to the last one processed. On current data it would wipe per-receipt subvalue history.
- **First occurrence only (16):** `LOCATE` hits the first line for a product, so duplicate lines are never fixed.
- **MATREADU without LOCKED (15):** waits on a locked PO. ELSE means not found only, so this is not a silent-fallthrough.

## 8. Schema-design notes for the CTO

- No new entities. Shows that RECLOG has been treated as the authoritative receipt record from which IVPO can be rebuilt. For migration, **RECLOG is the better source for receipt history** than IVPO 9/11/12, subject to data validation.

## 9. Questions for COO/CFO — consolidated

N/A — one-off technical repair; no business decisions required.

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 0 | |
| SIMPLIFY | 0 | |
| OBSOLETE | 3 | 01, 02, 03 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 0 | |
| WAREHOUSE-ONLY | 0 | |

Total: 3 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| File | RECLOG | Written by IV6, IV.ORD.REC, IV.ORD.REC.N, IV6.PO |
| File | IVPO | See IV.ORD.REC |
| Utility | `BLD.IVPO`, `FIX.PO.CST`, `FIX.TPOCST`, `PO.DISC` | IVPO repair family |

**Sibling-series flag:** member of the `FIX.*` one-off repair utilities. Not a variant. Candidate for OBSOLETE.
