# VEND.ENT.SHIP — Enter Shipping Date in VENDRA File

**Source program:** `BP/VEND.ENT.SHIP`
**Domain:** Vendors
**Integration mode:** Interactive
**Lines of code:** 14
**Last code change:** 12/05/2005 (header line 2, dharrar)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This program records that the goods on a vendor return request have been shipped back to the vendor. The operator enters the hold reference number, confirms the vendor name, and the program stamps today's date as the ship date. It does NOT check that an RA number exists, relieve inventory, create an AP debit memo or a vendor credit expectation, or record a carrier or tracking number.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| `VENDRA` | Vendor RA hold/request record | READ+WRITE (attr 1 read, attr 6 written) |
| `APMST` | AP vendor master (name display / existence check) | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| — | None |

**Internal labeled sections (subroutine-like):**

N/A — 14-line program.

## 4. Business rules — extracted

### Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.SHIP.01 | The operator identifies the request by its hold reference number (VENDRA key), and it must exist. The VENDRA vendor (attr 1, an AP vendor) must exist in APMST. Its name is displayed. If either check fails, the operator is re-prompted. Input starting with `E` exits. | 5–9 | KEEP |
| VEND.ENT.SHIP.02 | The operator must confirm "Confirm Shipping Returns to <vendor>" with `Y`. Any other answer cancels and ends the program. | 11–12 | KEEP |

### Date and quantity rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.SHIP.03 | The ship date is always the system date (`DATE()`), written to VENDRA attr 6. The operator cannot enter or back-date it. | 13 | QUESTION |

VEND.ENT.SHIP.03: The business must say whether shipments are ever recorded after the fact (which would need a date entry), and whether carrier and tracking information should be captured.

### Authorization / hold / status checks

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.SHIP.04 | There is no prerequisite. A request can be marked shipped with no vendor RA number (attr 5), and re-running the program overwrites an earlier ship date. | 8–13 | QUESTION |

VEND.ENT.SHIP.04: The business must say whether a vendor RA number is required before goods may ship, and whether a ship date may be changed once recorded.

### Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.SHIP.05 | No locking: the program uses a plain `READV` and `WRITEV`. | 8, 13 | SIMPLIFY |

### Error handling / call-Computyme prompts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.SHIP.06 | If VENDRA or APMST cannot be opened, the program STOPs with no message. | 3–4 | SIMPLIFY |

## 5. Hard-coded business identifiers found

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### VENDRA (single-attribute access)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 0 | ID | Hold reference number | — | |
| 1 | AVEND / VENDOR | AP vendor (APMST key) | — | Read only |
| 6 | SHIPPED | Ship date | internal date (days since 1967-12-31) | Always today |

### APMST

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 1 | NAME | Vendor name | — | |

No money fields.

## 7. Bug suspects

- **No status gate (line 13):** a request can be "shipped" before an RA number exists, and a second run silently replaces the ship date.
- **No lock (lines 8, 13).**
- **Silent abort on open failure (lines 3–4).**
- Silent-fallthrough READU pattern: not applicable (no READU).

## 8. Schema-design notes for the CTO

- Modifies **VendorReturnRequest.shippedDate**, which today is the status marker for "shipped".
- Consider an explicit status, a shipment record (carrier, tracking, shipped by), and an expected-credit amount for AP follow-up.
- Shipping a return has no link to inventory or AP in this program. Confirm whether `IV.UPD.RETURNS` or AP handles that elsewhere before designing the schema.
- Extract with the VENDRA siblings.

## 9. Questions for COO/CFO — consolidated

1. Should the ship date be enterable (back-dated) rather than always today? Should carrier and tracking be captured? (relates to VEND.ENT.SHIP.03)
2. Must a vendor RA number exist before shipping? May a ship date be changed? (relates to VEND.ENT.SHIP.04)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 2 | VEND.ENT.SHIP.01, .02 |
| SIMPLIFY | 2 | VEND.ENT.SHIP.05, .06 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 2 | VEND.ENT.SHIP.03, .04 |
| WAREHOUSE-ONLY | 0 | |

Total: 6 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling program | `VEND.RA.HOLD` | Creates the VENDRA request |
| Sibling program | `VEND.ENT.RA`, `VEND.ENT.COMP` | Same skeleton |
| Sibling program | `UPD.VENDRA`, `RPT.VENDRA` | Maintain and print the request |
| Shared file | `APMST` | AP vendor identity |

**Sibling-series flag:** `VEND.ENT.*` series (RA / SHIP / COMP). Canonical; no variants.
