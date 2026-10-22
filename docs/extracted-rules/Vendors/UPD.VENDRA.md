# UPD.VENDRA — Modify products for return in VENDRA file

**Source program:** `BP/UPD.VENDRA`
**Domain:** Vendors
**Integration mode:** Interactive
**Lines of code:** 43
**Last code change:** 12/21/2006 (header line 2; changelog 12-21-06 SJL "Set YN to '' before entering product")
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This program lets an operator change the products on an existing vendor return request (VENDRA) after `VEND.RA.HOLD` created it. For each product the operator can change the quantity, remove it (quantity 0), or add a product that is not yet on the request. The program does NOT return removed quantities to the pending-return pool (VENDRET), check that an added product belongs to the request's vendor, or block changes after the request has shipped or completed.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| `VENDRA` | Vendor RA hold/request record | READ+WRITE |
| `APMST` | AP vendor master (name / existence check) | READ |
| `IVMST` | Product master (description display, attr 4 DESC) | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| — | None |

**Internal labeled sections (subroutine-like):**

N/A — the labels `5` and `10` are prompt loops, not shared subroutines.

## 4. Business rules — extracted

### Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| UPD.VENDRA.01 | The operator enters the return (hold reference) number, and it must exist in VENDRA. The request's vendor (attr 1, an AP vendor) must exist in APMST, otherwise "Error - Vendor Not in APMST" and the request cannot be edited. Input starting with `E` exits. | 14–17 | KEEP |
| UPD.VENDRA.02 | The operator may add a product that is not on the request after confirming `Y`. Any product code is accepted. A product missing from IVMST only produces a warning ("Error - Not in IVMST") and is still added. Nothing checks that the product's actual vendor (IVMST A.VENDOR) matches the request's vendor. | 24–29, 36–40 | QUESTION |

UPD.VENDRA.02: The business must say whether a product may be added to a vendor's RA when it is not that vendor's product or is not in the product master.

### Date and quantity rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| UPD.VENDRA.03 | Entering quantity 0 removes the product line (product and quantity values) from the request. | 31–35 | KEEP |
| UPD.VENDRA.04 | A newly added product is inserted in ascending product-code order (`LOCATE ... BY 'AR'`), keeping attrs 3 and 4 aligned. | 24, 36–40 | SIMPLIFY |
| UPD.VENDRA.05 | For a product already on the request, the entered quantity replaces the existing quantity. | 41 | KEEP |

### Authorization / hold / status checks

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| UPD.VENDRA.06 | Products and quantities can be changed regardless of request status, even after a vendor RA number, ship date or completion date has been recorded (attrs 5–7 are not checked). | 16–42 | QUESTION |
| UPD.VENDRA.07 | Removed or reduced quantities are **not** put back into the pending vendor-return pool (VENDRET); they simply disappear from the return process. | 31–35, 41 | QUESTION |

UPD.VENDRA.06: The business must say whether an RA's contents may change after the vendor has issued the RA or after the goods have shipped.
UPD.VENDRA.07: The business must say whether quantity removed from an RA should go back to "pending return" (for a later RA) or be written off or returned to stock.

### Persistence / concurrency

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| UPD.VENDRA.08 | The VENDRA record is read with `MATREADU` and no `LOCKED` clause, so the program waits indefinitely if another user holds it. The lock is held while the operator edits. Changes are written only when `END` (any input starting with `E`) is entered at the product prompt, and the lock is released when the next return number is requested. | 13, 16, 23 | SIMPLIFY |

### Error handling / call-Computyme prompts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| UPD.VENDRA.09 | If VENDRA, APMST or IVMST cannot be opened, the program STOPs with no message. | 6–8 | SIMPLIFY |

## 5. Hard-coded business identifiers found

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### VENDRA (read into matrix R, DIM 7)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 1 | AVEND / VENDOR | AP vendor (APMST key) | — | Validated against APMST |
| 2 | DATE | RA request date | internal date | Not changed |
| 3 | PROD | Products (MV, ascending) | — | Edited |
| 4 | QUAN | Quantities (MV, aligned with attr 3) | units | Edited; no numeric validation |
| 5 | RA | Vendor RA number | — | Not checked |
| 6 | SHIPPED | Ship date | internal date | Not checked |
| 7 | COMP | Completed date | internal date | Not checked |
| 8–9 | WHO / REASON | Per dictionary | — | Beyond DIM 7. UniVerse keeps extra attributes in R(0) and MATWRITE writes them back. Confirm the account flavor |

### IVMST

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 4 | DESC | Product description for display | — | Matches the PRO dictionary |

No money fields.

## 7. Bug suspects

- **Adding with quantity 0 deletes a different product (lines 24, 31–33):** when the product is not found, `POS` is the insertion point, which is the position of the *next* product on the request. If the operator answers `Y` to add and then enters quantity 0, lines 32–33 delete the existing product at that position.
- **Wrong quantity shown when adding (line 30):** the "current" quantity displayed comes from `R(4)<1,POS>`, which belongs to a different product.
- **No quantity validation (line 30):** non-numeric, negative or blank quantities are accepted. A blank quantity is treated as 0 (`QUAN=0` is true for an empty string), so pressing Enter deletes the line.
- **No vendor check on added products (lines 24–29).**
- **No audit:** VENDRA has no change history and WHO (attr 8) is never written.
- **Lock held during operator think-time (lines 16–42).**
- Silent-fallthrough: the `MATREADU ... ELSE` at line 16 only handles not-found. With no LOCKED clause, UniVerse waits on a locked record rather than falling through, so this is not the conflation bug but it does block indefinitely.

## 8. Schema-design notes for the CTO

- Modifies **VendorReturnLine** (add, remove, change quantity).
- A line removed from a return needs a disposition (back to pending, back to stock, write-off), which is missing today.
- Line-level audit (who, when, old and new quantity) is missing.
- Validation needed in the new model: the product exists, and the product's actual vendor = the request vendor (or an explicit override with a reason; VENDRA attr 9 `REASON` exists in the dictionary as "Override-Reason" but nothing in BP writes it).
- Extract with the VENDRA family and `IV.INP.RETURNS`.

## 9. Questions for COO/CFO — consolidated

1. May a product that is not the vendor's product (or not in the product master) be added to an RA? (relates to UPD.VENDRA.02)
2. May an RA be changed after the vendor issued the RA number or after shipment? (relates to UPD.VENDRA.06)
3. What should happen to quantity removed from an RA: back to pending, back to stock, or written off? (relates to UPD.VENDRA.07)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 3 | UPD.VENDRA.01, .03, .05 |
| SIMPLIFY | 3 | UPD.VENDRA.04, .08, .09 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 3 | UPD.VENDRA.02, .06, .07 |
| WAREHOUSE-ONLY | 0 | |

Total: 9 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling program | `VEND.RA.HOLD` | Creates VENDRA requests (sorted product list this program relies on) |
| Sibling program | `VEND.ENT.RA`, `VEND.ENT.SHIP`, `VEND.ENT.COMP` | Status fields this program ignores |
| Sibling program | `RPT.VENDRA` | Prints the request |
| Shared file | `IVMST`, `APMST` | Product and AP vendor masters |

**Sibling-series flag:** part of the VENDRA RA family. Canonical; no variants.
