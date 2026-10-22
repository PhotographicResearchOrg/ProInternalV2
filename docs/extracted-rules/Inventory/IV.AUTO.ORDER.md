# IV.AUTO.ORDER — Automatic inventory ordering

**Source program:** `BP/IV.AUTO.ORDER`
**Domain:** Inventory
**Integration mode:** Interactive
**Lines of code:** 78
**Last code change:** 12/27/2006 (header line 3)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This is a stand-alone copy of option 2 of IV6 / IV.ORD.REC. The header says "Modify IV6 to be auto order routine only". The operator enters a PO number and date. The program then turns every record in the `ORDER` work file (product → quantity) into a line on that PO, records the open PO on each product, and clears `ORDER`. It does not calculate what to order, round quantities, choose a vendor, set due dates or receive goods.

## 1.5. Integration footprint

N/A — interactive. `ORDER` is an internal work file keyed by product, written by `IV21` / `DH1` (not extracted).

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master: open-PO multivalues 20–22, RAW cost 19, vendor 5 | READ+WRITE |
| IVPO | Purchase order | READ+WRITE |
| ORDER | Products and quantities to order | READ + CLEARFILE |
| PGM.AUDIT | Usage audit, record `IV.AUTO.ORDER` | READ+WRITE |
| RECLOG, POADJ, IVCAT, CONTROL | Opened but never used in this program (copied from IV6) | none |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `INCLUDE UTLBP I_GETWHO` | Sets user context |
| `CHAIN 'ABORT'` | File open failure (21) |
| `EXECUTE 'SELECT ORDER'` | Builds the list of products to order (52) |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| — (no label over 10 lines called from multiple places) | — | — |

## 4. Business rules — extracted

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.AUTO.ORDER.01 | PO number must be 5 digits or 5 digits + 1 letter, typed by the operator. Duplicate of IV.ORD.REC.02 (without the letter-prefix form). | 30–35 | OBSOLETE |
| IV.AUTO.ORDER.02 | PO date is MM.DD.YY, defaults to today, must be valid and not in the future. Duplicate of IV.ORD.REC.04. | 36–44 | OBSOLETE |

### 4.2 PO creation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.AUTO.ORDER.03 | If the PO number does not exist, a new header is started with PO date = date entered and vendor = `M(5)`. M has just been blanked (line 24), so **the vendor is always blank** on POs created by this program. If the PO exists, its lines are appended to, even if it is closed. | 24, 49–51 | QUESTION |
| IV.AUTO.ORDER.04 | If the `ORDER` work file is empty, the program shows "No products found in the ORDFL - NO purchase order created" and stops. | 52–56 | KEEP |
| IV.AUTO.ORDER.05 | For each `ORDER` record, qty = `ORDER` attr 1. The product gets PO no. (IVMST 20), qty (21) and cost = current RAW (19 → 22) appended, and the PO gets product (6), qty (7) and RAW cost (8) appended. Products not found in IVMST are skipped. Duplicate of IV.ORD.REC.09/11/15. | 63–69 | OBSOLETE |
| IV.AUTO.ORDER.06 | The IVPO record is written once after the last product, then `ORDER` is cleared and the count shown. | 57–62 | OBSOLETE |

IV.AUTO.ORDER.03: Have POs with a blank vendor been created through this program? Should PIV2 require a vendor on every PO header?

### 4.3 Concurrency / audit

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.AUTO.ORDER.07 | The IVPO record stays locked from the start until the final write. Each IVMST product is locked with `MATREADU` without a LOCKED clause, so the program waits indefinitely on a locked product. | 49, 64, 70 | OBSOLETE |
| IV.AUTO.ORDER.08 | Program start is appended to PGM.AUDIT record `IV.AUTO.ORDER` (date, time, port, message). | 29, 72–77 | SIMPLIFY |

### 4.4 Variant status

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.AUTO.ORDER.09 | This program duplicates IV.ORD.REC option 2 with one functional difference: no vendor on new POs. Confirm whether buyers use it or the IV.ORD.REC menu. | 5 | QUESTION |

IV.AUTO.ORDER.09: Which auto-order entry point do buyers use?

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `'5N'`, `'5N1A'` | Other (format) | 33 | PO number format | QUESTION |
| `'IV.AUTO.ORDER'` | Other | 73, 76 | PGM.AUDIT key | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVMST (matrix M, DIM 30)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 5 | VEND | Intended PO vendor | — | Read from a blank matrix (bug) |
| 19 | RAW | PO line cost | USD cents (MD2) or whole yen + `Y` | |
| 20 | PO.NO | Open PO (MV) | — | |
| 21 | PO.QTY | Open qty (MV) | units | |
| 22 | PO.CST | Unit cost (MV) | USD cents or whole yen + `Y` | |

### IVPO (matrix PO, DIM 30)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 1 | VEND | Vendor | — | Always blank on new POs from this program |
| 2 | DATE | PO date | Pick date | |
| 6 | PROD | Line product (MV) | — | |
| 7 | QTY.ORD | Line qty (MV) | units | |
| 8 | COST | Line unit cost (MV) | USD cents or whole yen + `Y` | |

### ORDER

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| @ID | — | Product | — | |
| 1 | — | Qty to order | units | Not validated |

## 7. Bug suspects

- **Blank vendor on new POs (24, 50):** `PO(1)=M(5)` runs before any IVMST record is read.
- **No transaction guard (64–69 vs 58):** IVMST is written per product and IVPO only at the end. An abort part-way leaves products showing a PO that does not exist in IVPO.
- **Closed or existing PO appended (49–51):** there is no check of IVPO 13 or of existing lines, so duplicate lines are possible.
- **`CNT` never initialised (68):** UniVerse treats it as 0 with a warning.
- **Unused file opens (16–19):** RECLOG, POADJ, IVCAT and CONTROL are opened but never used, which shows a copy-paste origin.
- **Silent wait on locks (64):** MATREADU without LOCKED waits forever with no message. Its ELSE means not found only, so this is not a silent-fallthrough bug.

## 8. Schema-design notes for the CTO

- Entities: PO header, PO line. Same as IV.ORD.REC §4.2.
- A PO vendor must be mandatory and validated in PIV2.
- Suggested-order logic (min stock, months of supply, case/carton, YTD shipped, on order) is **not** here. It lives in `IV21` / `DH1`, which must be extracted before the "suggested PO" feature on the product page is designed.

## 9. Questions for COO/CFO — consolidated

1. Should PIV2 require a vendor on every PO? Do blank-vendor POs exist today? (IV.AUTO.ORDER.03)
2. Which auto-order entry point is used, this program or IV.ORD.REC option 2? (IV.AUTO.ORDER.09)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 1 | 04 |
| SIMPLIFY | 1 | 08 |
| OBSOLETE | 5 | 01, 02, 05, 06, 07 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 2 | 03, 09 |
| WAREHOUSE-ONLY | 0 | |

Total: 9 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Canonical | `IV.ORD.REC` (option 2) | Same logic, with vendor set |
| Sibling | `IV6`, `IV6.PO`, `IV.ORD.REC.N` | Family |
| Producer | `IV21`, `DH1` | Write `ORDER` |
| Files | IVMST, IVPO, ORDER, PGM.AUDIT | Shared |

**Sibling-series flag:** derived from IV6 ("Modify IV6 to be auto order routine only"). It is a variant, not canonical.
