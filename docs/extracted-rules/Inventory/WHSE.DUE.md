# WHSE.DUE — Enter product due dates into ORDDUE

**Source program:** `BP/WHSE.DUE`
**Domain:** Inventory
**Integration mode:** Interactive
**Lines of code:** 28
**Last code change:** 11/13/97 (header line 2, `pro`). No changelog
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

A buyer or warehouse user enters, for one product at a time, the date a shipment is expected. The date is stored in ORDDUE, one date per product, and shown elsewhere as the product's due date. `ORDUP1` clears dates when stock arrives or the date passes and prints the list of products that need one. It does NOT link the date to a PO or vendor, keep history, or record who entered it.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product must exist (attr 4 description shown) | READ |
| ORDDUE | Expected date per product (attr 1) | WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `CHAIN 'ABORT'` | Open failures (lines 8–9) |

**Internal labeled sections (subroutine-like):** none.

## 4. Business rules — extracted

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| WHSE.DUE.01 | The product must exist in IVMST. Any entry starting with `E` ends the program. | 11–14 | KEEP |
| WHSE.DUE.02 | The due date is typed as MM.DD.YY (pattern `0N.0N.0N`) and converted with the system 2-digit-year rule. | 15, 17, 24 | SIMPLIFY |

### 4.2 Date rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| WHSE.DUE.03 | The due date must be after today; today or earlier is rejected. | 19 | KEEP |
| WHSE.DUE.04 | A date 180 or more days ahead triggers a warning ("more than 6 months, please verify") but is accepted. | 18 | QUESTION |

WHSE.DUE.04: Is 6 months still the right sanity threshold, and should it block rather than warn?

### 4.3 Persistence

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| WHSE.DUE.05 | After `Y` confirmation, ORDDUE attr 1 = the date (internal format), keyed by product, replacing any earlier date. No PO, entry date or user is stored (ORDDUE attrs 2 and 3 exist in the dictionary for this but are not written). | 20–25 | QUESTION |

WHSE.DUE.05: Should expected dates be per PO line (vendor ETA) with who/when, rather than one free date per product?

### 4.4 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| WHSE.DUE.06 | The date is written with `WRITEV` and no lock; the last writer wins. | 25 | SIMPLIFY |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `180` days | Threshold | 18 | "More than 6 months" warning | QUESTION |
| `E` prefix | Other | 12, 16 | Exit keyword (blocks product codes starting with E) | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### ORDDUE (written)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| @ID | — | Product | — | |
| 1 | DUE | Expected date | Pick date | |
| 2 | UPD.DATE | Not written | Pick date | Dictionary only |
| 3 | VIA-PO | Not written | — | Dictionary only |

### IVMST (read)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 4 | DESC | Existence check / display | — | |

No money fields.

## 7. Bug suspects

- **Product codes starting with "E" cannot be entered (12):** the exit test fires before the lookup.
- **Misleading message on an invalid date (17–19):** `1.2.3` passes the pattern. If `ICONV` returns empty, the "more than 6 months" test is false, and the "date which has passed" test treats empty as ≤ today, so the user sees "CANNOT be a date which has passed" for an invalid date.
- **Two-digit years (17, 24):** century depends on the system pivot.
- **Typo** "ENETERED" (17). Cosmetic.
- **No audit (25):** who set the date and when is not stored.
- **READU/MATREADU silent-fallthrough:** not present.

## 8. Schema-design notes for the CTO

- Same entity as ORDUP1: Expected Availability Date. Recommend a vendor-promised date on each PO line (with history), and derive the product's next-available date as the earliest open PO line date with qty to cover member demand.
- Missing audit: entered by, entered on, source PO.
- Sibling: `ORDUP1`.

## 9. Questions for COO/CFO — consolidated

1. Is 6 months the right warning limit, and should it block? (relates to WHSE.DUE.04)
2. Should due dates be per PO line with history? (relates to WHSE.DUE.05)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 2 | WHSE.DUE.01, WHSE.DUE.03 |
| SIMPLIFY | 2 | WHSE.DUE.02, WHSE.DUE.06 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 2 | WHSE.DUE.04, WHSE.DUE.05 |
| WAREHOUSE-ONLY | 0 | |

Total: 6 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling | `ORDUP1` | Clears dates and prints the worklist |
| File | ORDDUE | Only these two programs write it; IVMST dictionary `DDATE` reads it |

**Sibling-series flag:** none. Despite the `WHSE.` prefix the program does nothing warehouse-specific; it is a buyer function.
