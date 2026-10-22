# FIX.PO.CST — Back-fill missing PO cost on IVMST from IVPO (no header comment)

**Source program:** `BP/FIX.PO.CST`
**Domain:** Inventory
**Integration mode:** Utility/maintenance
**Lines of code:** 24
**Last code change:** Unknown (no header, no "Last updated" line)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

The program has no comment, so the purpose is inferred from the code. For every product with open POs, it fills in any blank product-side PO unit cost (IVMST 22) from the matching PO line's cost (IVPO 8). This matters because receiving values goods at IVMST 22 (IV.ORD.REC.23), so a blank there would receive stock at zero cost. It does not overwrite costs that are already present and does not compare the two copies.

## 1.5. Integration footprint

N/A — utility/maintenance.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master, open-PO multivalues 20 and 22 | READ+WRITE |
| IVPO | Purchase order lines 6 and 8 | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `EXECUTE 'SELECT IVMST WITH PO.NUM'` | Products with any open PO (4) |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| — | — | — |

## 4. Business rules — extracted

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| FIX.PO.CST.01 | For each product with open POs, and each PO in IVMST 20 whose unit cost (IVMST 22) is blank: if the PO exists and has a line for the product, IVMST 22 is set to that line's IVPO 8 cost. Values already present are not changed. | 4–20 | OBSOLETE |
| FIX.PO.CST.02 | Every selected IVMST record is rewritten whether or not anything changed. | 21 | OBSOLETE |

## 5. Hard-coded business identifiers found

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVMST (matrix REC, DIM 100)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 20 | PO.NO | Open PO (MV) | — | |
| 22 | PO.CST | Unit cost (MV) | USD cents or whole yen + `Y` | Back-filled |

### IVPO (matrix POREC, DIM 50)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 6 | PROD | Line product (MV) | — | |
| 8 | COST | Line unit cost (MV) | USD cents or whole yen + `Y` | Source |

## 7. Bug suspects

- **Undated, uncommented program:** it is impossible to tell when or why it was run.
- **Unconditional rewrite (21):** touches every product with a PO, so concurrent edits between read and write are at risk. MATREADU without LOCKED waits, which avoids silent-fallthrough, but the long batch holds each lock only briefly.
- **First occurrence only (14):** duplicate PO lines for a product always take the first line's cost.
- **IVPO read without lock (13).**

## 8. Schema-design notes for the CTO

- This is further evidence that the product-side and PO-side cost copies drift apart (see PO.DISC). In PIV2 there should be one PO line cost, plus a not-null/validation rule so that a line cannot be received at zero cost unintentionally.

## 9. Questions for COO/CFO — consolidated

N/A — technical repair; the underlying business question is IV.ORD.REC.23 (which cost is authoritative).

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 0 | |
| SIMPLIFY | 0 | |
| OBSOLETE | 2 | 01, 02 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 0 | |
| WAREHOUSE-ONLY | 0 | |

Total: 2 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Program | `IV.ORD.REC` | Consumes IVMST 22 at receipt |
| Utility | `PO.DISC` | Also writes IVMST 22 from IVPO 8 when re-adding a PO |
| Utility | `BLD.IVPO`, `FIX.IVPO`, `FIX.TPOCST` | IVPO repair family |

**Sibling-series flag:** member of the `FIX.*` one-off repair utilities. Not a variant. Candidate for OBSOLETE.
