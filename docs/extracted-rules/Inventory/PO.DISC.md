# PO.DISC — Print & update differences between IVMST & IVPO

**Source program:** `BP/PO.DISC`
**Domain:** Inventory
**Integration mode:** Utility/maintenance
**Lines of code:** 135
**Last code change:** 09 Jan 2012 (header line 3; changelog 01-09-12 SJL "update PO.CST (IVMST(22))")
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

**"DISC" means discrepancy, not discount.** This batch utility reconciles the two copies of every open PO line: the PO-side copy (IVPO) and the product-side copy (IVMST attr 20–23). It prints each discrepancy and repairs it. Pass 1 makes sure every open IVPO line appears on its product, including special orders that point at a placeholder product. Pass 2 removes product-side PO references whose PO is missing, which do not match a PO line, or which are already fully received. It compares only whether a reference is present. It does **not** compare quantities or costs where both copies exist.

## 1.5. Integration footprint

N/A — utility/maintenance.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVPO | Purchase order (source of truth in pass 1) | READ |
| IVMST | Product master, open-PO multivalues 20–23 | READ+WRITE |
| IVSPORD | Special orders, keyed by special-order id | READ |
| ERROR | Opened, never used | none |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `CALL SUMM(values, total)` | Total of received subvalues for a PO line (28, 89). Not in BP; assumed to sum subvalues, confirm |
| `EXECUTE 'SSELECT IVPO'` / `'SSELECT IVMST'` | Full-file passes (19, 60) |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| `140` Re-add PO to IVMST | 97–113 | 39, 48 |
| `150` Delete PO from IVMST | 115–122 | 78, 85, 90 |
| `170` (unused special-order scan) | 124–133 | never called |

## 4. Business rules — extracted

### 4.1 Pass 1 — every open PO line must be on its product

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| PO.DISC.01 | For every IVPO line where qty ordered (attr 7) > total received (SUM of attr 9 subvalues), the product's IVMST attr 20 must contain that PO number. Lines with nothing open are ignored. | 19–41 | OBSOLETE |
| PO.DISC.02 | If the PO is missing from the product, it prints "MISSING PO" and re-adds it. With nothing received: open qty (21) = qty ordered, unit cost (22) = IVPO cost (8), BO (23) blank. With a partial receipt: open qty blank, cost = IVPO 8, BO = ordered − received. | 38–39, 97–113 | OBSOLETE |
| PO.DISC.03 | If the PO line's product is not in IVMST, IVPO attr 14 (that line's value) is treated as a special-order id. If that special order exists in IVSPORD, the PO must appear on placeholder product **555**, and is re-added there if missing. Otherwise it prints "NOT FOUND ON IVMST OR IVSPORD". | 42–52 | QUESTION |
| PO.DISC.04 | Product **555** is hard-coded as the IVMST record that carries special-order POs. If 555 is missing, the whole run stops. | 44–45 | QUESTION |

PO.DISC.03: How do special-order (drop-ship or member-specific) PO lines work today? Do they need a placeholder product in PIV2, or a separate special-order line type?
PO.DISC.04: Confirm that product 555 is the special-order placeholder and whether it carries any sales or inventory.

### 4.2 Pass 2 — remove stale product-side PO references

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| PO.DISC.05 | For each product and each PO in IVMST 20: if the IVPO record does not exist, the reference (20–23 at that position) is deleted and "NOT FOUND ON IVPO" printed. | 60–80, 115–122 | OBSOLETE |
| PO.DISC.06 | If the product is not a line on that PO and the IVPO attr 14 value is not an existing special order, the reference is deleted and "IS MISSING PROD ... ON IVPO" printed. | 81–88 | OBSOLETE |
| PO.DISC.07 | If the matching IVPO line is fully received (received ≥ ordered), the reference is deleted without printing anything. | 89–90 | OBSOLETE |

### 4.3 Reporting & concurrency

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| PO.DISC.08 | Discrepancies are printed under the heading "Report of IVPO vs IVMST using IVPO as of <time> Page <n>". The printer is not selected (`PRINTER ON` is commented out), so output goes to the terminal. | 13, 18, 38, 47, 51, 77, 84 | SIMPLIFY |
| PO.DISC.09 | Each IVMST product is locked with a LOCKED loop that retries every 5 s with no limit, printing "Waiting on IVMST ... to be released". IVPO is read without a lock. | 30–35, 65–70, 23, 76 | SIMPLIFY |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `555` | Product# | 44 | Placeholder product for special-order PO lines | QUESTION |
| 5 s | Threshold | 34, 69 | Lock retry interval | QUESTION |

## 6. Data shape — record layouts referenced

### IVPO (read into matrix PRODS, DIM 30)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 6 | PROD | Line product (MV) | — | |
| 7 | QTY.ORD | Qty ordered (MV) | units | |
| 8 | COST | Unit cost (MV) | USD cents or whole yen + `Y` | Copied to IVMST 22 on repair |
| 9 | QTY.REC | Qty received (MV/SV) | units | Summed with SUMM |
| 14 | FG.PCT (dictionary) | **Used here as special-order id per line (MV)** | — | **Overloaded:** the dictionary says single-valued `FG.PCT` (MD0) |

### IVMST (read into matrix PONOS, DIM 150)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 20 | PO.NO | Open PO (MV) | — | |
| 21 | PO.QTY | Open qty (MV) | units | |
| 22 | PO.CST | Unit cost (MV) | USD cents or whole yen + `Y` | |
| 23 | BO | BO qty (MV) | units | |

### IVSPORD

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| @ID | — | Special-order id | — | Existence check only |
| 4 | — | Read in dead label 170, compared with a product | — | Purpose unclear, confirm |

## 7. Bug suspects

- **Wrong index (82):** pass 2 reads the special-order id from `PRODS(14)<1,I>`, where `I` is the position in IVMST 20, not the IVPO line.
- **Stale `WHERE` (81–89):** when the product is not on the PO but the special order exists, `WHERE` keeps its value from an earlier iteration, so QO/QR come from the wrong line and the reference may be wrongly deleted.
- **Unlocked write to 555 (45, 112):** `MATREAD` (no U) followed by `MATWRITE` can overwrite a concurrent update to product 555.
- **Race with receiving (23, 76):** IVPO is read without a lock. A receipt in progress (IVMST updated, IVPO not yet written; see IV.ORD.REC §7) looks like a discrepancy, and pass 1 re-adds the PO the receipt just removed.
- **Dead condition (105):** `IF QR >= 0` is always true.
- **Inverted comment (54):** says `IF PRODS(7)<1,I> < PRODS(9)<1,I>`, but the code tests ordered > received.
- **Header overstates scope:** "PRINT & UPDATE DIFF", yet quantity and cost differences between the two copies are never compared. The 01-09-12 "update PO.CST" only happens when a missing reference is re-added.
- **Dead code:** label 170 and file `ERROR`.
- **READU silent-fallthrough:** not present. The LOCKED clauses tell locked apart from not-found.

## 8. Schema-design notes for the CTO

- This program exists only because a PO line is stored twice. In PIV2, product on-order should be a query over PO lines, which removes the need for it.
- **Keep it as a parallel-run check:** during the cutover period, a PIV2 job that compares PIV2 PO lines with IVPO and IVMST 20–23 (presence **and** qty/cost, which this program skips) will catch sync drift.
- Special-order PO lines need a first-class model (line type, link to member order, no stock impact) instead of product 555 plus an overloaded IVPO attr 14.
- Extract `IVSPORD` producers (e.g. `IV46.SPORD`) before modelling special-order lines.

## 9. Questions for COO/CFO — consolidated

1. How are special-order PO lines created and received, and must they stay separate from stock lines? (PO.DISC.03)
2. Confirm that product 555 is the special-order placeholder. (PO.DISC.04)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 0 | |
| SIMPLIFY | 2 | 08, 09 |
| OBSOLETE | 5 | 01, 02, 05, 06, 07 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 2 | 03, 04 |
| WAREHOUSE-ONLY | 0 | |

Total: 9 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| File | IVPO, IVMST 20–23 | Maintained by IV.ORD.REC, IV46, IV7 |
| File | IVSPORD | Special orders; see IV46.SPORD |
| Subroutine | `SUMM` | Not in BP; confirm |
| Related utilities | `BLD.IVPO`, `FIX.PO.CST`, `FIX.IVPO`, `FIX.TPOCST` | Other IVMST/IVPO repair programs |

**Sibling-series flag:** no suffix variants found. Canonical. It belongs to a family of IVPO repair utilities.
