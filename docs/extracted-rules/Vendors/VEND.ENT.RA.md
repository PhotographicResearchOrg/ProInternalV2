# VEND.ENT.RA — Enter RA Number in VENDRA File

**Source program:** `BP/VEND.ENT.RA`
**Domain:** Vendors
**Integration mode:** Interactive
**Lines of code:** 13
**Last code change:** 12/03/2005 (header line 2, dharrar)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

After a vendor approves a return, the operator uses this program to record the vendor's RA (Return Authorization) number. The operator enters the internal hold reference number that `VEND.RA.HOLD` created, sees the AP vendor's name, and types the RA number. The program stores it on the VENDRA record. It does NOT validate the RA number, check the RA's status, change products or quantities, or send anything to the vendor.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| `VENDRA` | Vendor RA hold/request record | READ+WRITE (attr 1 read, attr 5 written) |
| `APMST` | AP vendor master (name display / existence check) | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| — | None |

**Internal labeled sections (subroutine-like):**

N/A — 13-line program.

## 4. Business rules — extracted

### Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.RA.01 | The operator identifies the request by its hold reference number (VENDRA key), and it must exist. The VENDRA vendor (attr 1, an AP vendor) must exist in APMST. Its name is displayed. If either check fails, the operator is re-prompted. Input starting with `E` exits. | 6–9 | KEEP |
| VEND.ENT.RA.02 | The vendor RA number is free text up to 10 characters (`INPUT RA,10_`). There is no format or uniqueness check, and input starting with `E` exits without saving. | 10–11 | SIMPLIFY |

### Authorization / hold / status checks

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.RA.03 | The RA number is written to VENDRA attr 5 unconditionally. An existing RA number is overwritten without warning, and nothing stops entry after the return has shipped or completed. | 12 | QUESTION |

VEND.ENT.RA.03: The business must say whether the RA number may be changed once entered, and whether changes are allowed after the goods have shipped.

### Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.RA.04 | No locking: the program uses a plain `READV` and `WRITEV` (no `READVU`), so two users could update the same request at once. | 8, 12 | SIMPLIFY |

### Error handling / call-Computyme prompts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.ENT.RA.05 | If VENDRA or APMST cannot be opened, the program STOPs with no message. | 3–4 | SIMPLIFY |

## 5. Hard-coded business identifiers found

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### VENDRA (single-attribute access)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 0 | ID | Hold reference number | — | From CONTROL `'RA'` (VEND.RA.HOLD) |
| 1 | AVEND / VENDOR | AP vendor (APMST key) | — | Read only |
| 5 | RA | Vendor-issued RA number | — | Written; up to 10 characters |

### APMST

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 1 | NAME | Vendor name for display | — | |

No money fields.

## 7. Bug suspects

- **No lock (lines 8, 12):** concurrent updates to the same request go undetected (last write wins).
- **Silent overwrite (line 12):** an RA number already entered is replaced with no confirmation and no history.
- **Silent abort on open failure (lines 3–4):** `STOP` with no message.
- Silent-fallthrough (READU/MATREADU ELSE conflating not-found and locked): not applicable, because no READU is used.

## 8. Schema-design notes for the CTO

- Modifies **VendorReturnRequest.vendorRaNumber**.
- Needs an audit trail: who entered or changed the RA number, and when.
- Decide whether vendorRaNumber should be unique per vendor.
- Status gating (RA number required before ship? editable after ship?) should be explicit in the new model.
- Extract with the VENDRA siblings (`VEND.RA.HOLD`, `VEND.ENT.SHIP`, `VEND.ENT.COMP`, `UPD.VENDRA`, `RPT.VENDRA`) before committing the schema.

## 9. Questions for COO/CFO — consolidated

1. May the vendor RA number be changed after entry or after shipment, and must changes be logged? (relates to VEND.ENT.RA.03)
2. Is there a standard RA-number format per vendor that should be validated? (relates to VEND.ENT.RA.02)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 1 | VEND.ENT.RA.01 |
| SIMPLIFY | 3 | VEND.ENT.RA.02, .04, .05 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 1 | VEND.ENT.RA.03 |
| WAREHOUSE-ONLY | 0 | |

Total: 5 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling program | `VEND.RA.HOLD` | Creates the VENDRA request |
| Sibling program | `VEND.ENT.SHIP`, `VEND.ENT.COMP` | Same skeleton; fill attrs 6 and 7 |
| Sibling program | `UPD.VENDRA`, `RPT.VENDRA` | Maintain and print the request |
| Shared file | `APMST` | AP vendor identity |

**Sibling-series flag:** `VEND.ENT.*` series (RA / SHIP / COMP), three near-identical programs that each set one VENDRA field. Canonical; no variants. In the new system they can be one Vendor Return screen.
