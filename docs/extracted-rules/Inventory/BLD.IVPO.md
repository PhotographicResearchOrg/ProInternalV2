# BLD.IVPO — Build IVPO purchase-order records from IVMST open-PO multivalues (no header comment)

**Source program:** `BP/BLD.IVPO`
**Domain:** Inventory
**Integration mode:** Utility/maintenance
**Lines of code:** 33
**Last code change:** 02/12/2003 (header line 3)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

The header has no purpose comment (lines 1–2 are blank `***`), so the purpose is inferred from the code. This is a one-time conversion from February 2003, the period when the IVPO file was introduced (IV6 changelog "02-14-03 Add IVPO update"). It reads every open PO reference on the product master (IVMST 20–23) and builds one IVPO record per PO number, with header vendor, PO date, lines and a single PO cost total. It then blanks IVMST attr 23 on the product, which had held the order date (see IV6.PO). It is not a recurring job.

## 1.5. Integration footprint

N/A — utility/maintenance.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master, open-PO multivalues 20–23, vendor 5 | READ+WRITE |
| IVPO | Purchase order being built | READ+WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `EXECUTE 'SSELECT IVMST WITH PO.NUM BY-EXP PO.NUM'` | One list entry per product/PO pair, sorted by PO (8) |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| `100` write previous PO / start next | 25–32 | 14, 23 |

## 4. Business rules — extracted

### 4.1 Conversion rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| BLD.IVPO.01 | Every product/PO pair in IVMST attr 20 is processed in PO-number order (exploded select), so all lines of a PO are grouped together. | 8–11 | OBSOLETE |
| BLD.IVPO.02 | For each pair, a line is appended to the IVPO record of that PO number: product (6), qty = IVMST 21 (7), unit cost = IVMST 22 (8). An existing IVPO record is extended; otherwise one is started blank. | 13, 15, 30 | OBSOLETE |
| BLD.IVPO.03 | The PO header is set from the first product of each PO: vendor (IVPO 1) = IVMST 5, and PO date (IVPO 2) = IVMST 23 at that PO's position. This shows that IVMST 23 held the order date before this conversion. | 31 | OBSOLETE |
| BLD.IVPO.04 | After copying, IVMST 23 is blanked at that position, freeing attr 23 for backorder qty in later programs. | 16, 19 | OBSOLETE |
| BLD.IVPO.05 | A single PO-level total is accumulated in IVPO 12 as Σ(qty × unit cost). A `Y` (yen) suffix is stripped and the yen amount is added to the same total as dollar-cent amounts. | 17–18 | QUESTION |
| BLD.IVPO.06 | Each IVPO record is written when the PO number changes and once more after the last pair. | 14, 23, 26–28 | OBSOLETE |

BLD.IVPO.05: PO records created by this conversion (and by IV6.PO) hold a mixed-currency PO total in attr 12 rather than per-receipt landed costs. Should POs from 2003 and earlier be migrated at all, or archived?

## 5. Hard-coded business identifiers found

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVMST (matrix IV, DIM 30)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 5 | VEND | PO vendor | — | |
| 20 | PO.NO | PO number (MV) | — | |
| 21 | PO.QTY | Line qty (MV) | units | |
| 22 | PO.CST | Unit cost (MV) | USD cents or whole yen + `Y` | |
| 23 | (BO in later programs) | **Order date** at this time | Pick date | **Overloaded historically:** date before 02/2003, BO qty after |

### IVPO (matrix PO, DIM 20)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 1 | VEND | Vendor | — | |
| 2 | DATE | PO date | Pick date | |
| 6–8 | PROD / QTY.ORD / COST | Lines | units / cents or yen+`Y` | |
| 12 | COST.REC | **Single PO total cost** | Mixed USD cents and yen | **Overloaded:** per-receipt landed cost in IV6/IV.ORD.REC |

## 7. Bug suspects

- **Mixed-currency total (17–18):** yen and USD-cent extended costs are summed into one number.
- **`RELEASE` releases everything (21):** the bare `RELEASE` after each product also drops the IVPO lock taken in label 100, while the PO matrix is still being built in memory.
- **Not re-runnable:** an existing IVPO record is extended, so a second run duplicates every line and double-counts attr 12.
- **Empty select (23, 30):** with no products, `GOSUB 100` runs with `PONO` unassigned.
- **Header taken from first product only (31):** a PO whose products had different IVMST 5 vendors is silently assigned the first one.
- **MATREADU without LOCKED (12, 30):** waits on locks. ELSE means not found only, so this is not a silent-fallthrough.

## 8. Schema-design notes for the CTO

- One-time 2003 conversion. Its significance today is **data archaeology**: IVPO records created before 02/2003 have a PO date taken from IVMST 23 and a single mixed-currency total in attr 12. Any IVPO migration must recognise this older shape.
- No schema entities beyond IV.ORD.REC.

## 9. Questions for COO/CFO — consolidated

1. Should pre-2003 PO history be migrated, or archived as read-only? (BLD.IVPO.05)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 0 | |
| SIMPLIFY | 0 | |
| OBSOLETE | 5 | 01, 02, 03, 04, 06 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 1 | 05 |
| WAREHOUSE-ONLY | 0 | |

Total: 6 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Program | `IV6.PO` | Wrote the IVMST 23 order dates this program moves |
| Program | `IV6`, `IV.ORD.REC` | Later programs that keep IVPO in step |
| Utility | `FIX.IVPO`, `FIX.PO.CST`, `FIX.TPOCST`, `PO.DISC` | IVPO repair family |
| Files | IVMST, IVPO | |

**Sibling-series flag:** member of the `BLD.*` conversion utilities (BLD.IVMST.PW, BLD.IVSOLD...). Not a variant. One-time job, candidate for OBSOLETE.
