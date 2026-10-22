# FIX.TPOCST — Routine to recalculate total PO cost received

**Source program:** `BP/FIX.TPOCST`
**Domain:** Inventory
**Integration mode:** Utility/maintenance
**Lines of code:** 29
**Last code change:** 09/05/2003 (header line 3)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This September 2003 repair recalculates "cost received" (IVPO 12) on every PO line that has been received, as the line's unit cost × quantity received. It was written after IV6's "09-08-03 Update cost.rec IVPO(12) with CST" change. It does not apply the yen conversion or the landed % that receiving uses, and it predates per-receipt subvalues (2006). Re-running it today would overwrite the landed USD cost history.

## 1.5. Integration footprint

N/A — utility/maintenance.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVPO | Purchase order lines | READ+WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `SELECT IVPO` | Full-file pass (7) |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| — | — | — |

## 4. Business rules — extracted

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| FIX.TPOCST.01 | For every PO with any qty received, each line with qty received (IVPO 9) > 0 gets cost received (IVPO 12) = unit cost (IVPO 8) × qty received. | 11–24 | OBSOLETE |
| FIX.TPOCST.02 | For a yen line (cost contains `Y`), the result stays **in yen** with a `Y` suffix (`(yen × qty):'Y'`). It is not converted to USD cents, unlike the receiving programs, which store USD in IVPO 12. | 17–19 | QUESTION |
| FIX.TPOCST.03 | Every IVPO record read is rewritten, whether or not anything changed. | 26 | OBSOLETE |

FIX.TPOCST.02: Some historical IVPO 12 values may be yen-suffixed raw totals instead of landed USD. Finance should decide whether PO-level cost history before roughly 2004 is relied on for anything, such as vendor spend reporting.

## 5. Hard-coded business identifiers found

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVPO (matrix PO, DIM 25)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 6 | PROD | Line count driver (MV) | — | |
| 8 | COST | Unit cost (MV) | USD cents or whole yen + `Y` | |
| 9 | QTY.REC | Qty received (MV; SV per receipt since 2006) | units | Treated as single value |
| 12 | COST.REC | Cost received (MV) | **USD cents or yen + `Y`** after this program | **Overloaded currency;** receiving writes landed USD cents per receipt subvalue |

## 7. Bug suspects

- **Unsafe on current data (15–16):** since 03-14-06, IVPO 9 holds one subvalue per receipt. `PO(9)<1,I>` is then a subvalue-delimited string, so the `> 0` test and the multiplication give wrong results. Running it would also replace the per-receipt subvalues in attr 12 with a single value.
- **Drops landed cost and FX (16–21):** the result is raw cost × qty, not the landed USD value that receiving stores, so a re-run silently revalues PO history.
- **Lost-update risk (11, 26):** `MATREAD` without a lock followed by `MATWRITE` can overwrite a receipt being posted at the same time.
- **Unconditional rewrite (26).**

## 8. Schema-design notes for the CTO

- Received cost on a PO line must be stored per receipt with currency, FX rate and landed charges explicit. That would have made this "recalculate" utility unnecessary.
- Migration must not trust IVPO 12 alone. Validate it against RECLOG 3 (landed USD cents per receipt).

## 9. Questions for COO/CFO — consolidated

1. Is historical PO cost-received data before roughly 2004 relied on for any reporting? (FIX.TPOCST.02)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 0 | |
| SIMPLIFY | 0 | |
| OBSOLETE | 2 | 01, 03 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 1 | 02 |
| WAREHOUSE-ONLY | 0 | |

Total: 3 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Program | `IV6`, `IV.ORD.REC` | Write IVPO 12 per receipt (landed USD) |
| Utility | `BLD.IVPO`, `FIX.IVPO`, `FIX.PO.CST`, `PO.DISC` | IVPO repair family |
| File | IVPO | |

**Sibling-series flag:** member of the `FIX.*` one-off repair utilities. Not a variant. Candidate for OBSOLETE.
