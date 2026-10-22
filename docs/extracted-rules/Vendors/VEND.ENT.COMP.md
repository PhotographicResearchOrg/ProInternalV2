# VEND.ENT.COMP — Enter Date Completed in VENDRA File

**Source program:** `BP/VEND.ENT.COMP`
**Domain:** Vendors
**Integration mode:** Interactive
**Lines of code:** 15
**Last code change:** 12/06/2005 (header line 2, dharrar)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This program closes a vendor return request by recording the date it was completed. The operator enters the hold reference number, sees the vendor name, and types the completion date. The code does not say what "completed" means: possibly the vendor credit was received, or possibly the vendor confirmed receipt. The program does NOT check that the return was shipped, record the credit amount, or post anything to AP.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| `VENDRA` | Vendor RA hold/request record | READ+WRITE (attr 1 read, attr 7 written) |
| `APMST` | AP vendor master (name display / existence check) | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| — | None |

**Internal labeled sections (subroutine-like):**

N/A — 15-line program.

## 4. Business rules — extracted

### Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.COMP.01 | The operator identifies the request by its hold reference number (VENDRA key), and it must exist. The VENDRA vendor (attr 1, an AP vendor) must exist in APMST. Its name is displayed. If either check fails, the operator is re-prompted. Input starting with `E` exits. | 5–9 | KEEP |
| VEND.ENT.COMP.02 | The completion date must be entered as `MM.DD.YY` (pattern `2N.2N.2N`) and is converted to an internal date. There is no default and no range check. | 10–13 | SIMPLIFY |

### Authorization / hold / status checks

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.COMP.03 | The completion date is written to VENDRA attr 7 unconditionally. Nothing checks that the request has an RA number (attr 5) or a ship date (attr 6), and an existing completion date is overwritten. | 14 | QUESTION |

VEND.ENT.COMP.03: The business must define "completed" (vendor credit received? vendor acknowledged receipt?) and say whether a request may be completed without having been shipped.

### Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.COMP.04 | No locking: the program uses a plain `READV` and `WRITEV`. | 8, 14 | SIMPLIFY |

### Error handling / call-Computyme prompts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.COMP.05 | If VENDRA or APMST cannot be opened, the program STOPs with no message. | 3–4 | SIMPLIFY |

## 5. Hard-coded business identifiers found

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### VENDRA (single-attribute access)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 0 | ID | Hold reference number | — | |
| 1 | AVEND / VENDOR | AP vendor (APMST key) | — | Read only |
| 7 | COMP | Completed date | internal date (days since 1967-12-31) | Operator entered |

### APMST

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 1 | NAME | Vendor name | — | |

No money fields. The vendor credit amount for the return is **not** recorded anywhere in the VENDRA family.

## 7. Bug suspects

- **Invalid dates stored blank (line 13):** input that matches the pattern but is not a real date (e.g. `13.40.06`) passes the check. `ICONV` returns blank, and blank is written to attr 7. Because "blank" means "not completed", the request silently looks not completed.
- **No status gate (line 14):** a request can be completed before it was shipped or given an RA number.
- **No lock (lines 8, 14).**
- **Silent abort on open failure (lines 3–4).**

## 8. Schema-design notes for the CTO

- Modifies **VendorReturnRequest.completedDate**, the de facto "closed" status.
- Missing: vendor credit memo number and amount, the link to the AP credit (APDIST), and who closed the request.
- The status machine (requested → RA issued → shipped → completed) should be explicit, with allowed transitions.
- Extract with the VENDRA siblings and any AP credit-memo program before designing the schema.

## 9. Questions for COO/CFO — consolidated

1. What does "completed" mean for a vendor return, and may a return be completed without being shipped? (relates to VEND.ENT.COMP.03)
2. Should the vendor's credit memo number and amount be recorded when a return is completed? (relates to VEND.ENT.COMP.03)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 1 | VEND.ENT.COMP.01 |
| SIMPLIFY | 3 | VEND.ENT.COMP.02, .04, .05 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 1 | VEND.ENT.COMP.03 |
| WAREHOUSE-ONLY | 0 | |

Total: 5 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling program | `VEND.RA.HOLD` | Creates the VENDRA request |
| Sibling program | `VEND.ENT.RA`, `VEND.ENT.SHIP` | Same skeleton |
| Sibling program | `UPD.VENDRA`, `RPT.VENDRA` | Maintain and print the request |
| Shared file | `APMST` | AP vendor identity |

**Sibling-series flag:** `VEND.ENT.*` series (RA / SHIP / COMP). Canonical; no variants.
