# VEND.RA.HOLD — Enter Date for RA Request and Move Product to VENDRA

**Source program:** `BP/VEND.RA.HOLD`
**Domain:** Vendors
**Integration mode:** Interactive
**Lines of code:** 82
**Last code change:** 12/21/2006 (header line 2; last changelog entry 12-21-06 SJL "Add back in write to VENDRA")
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This program starts a vendor return (RA) request. The operator enters an AP vendor number (APMST key) and an RA request date. The program then takes every product waiting in the vendor-return pool (`VENDRET`) whose actual vendor is that AP vendor and moves the products into one new "hold" record in `VENDRA`. The record number comes from a sequential counter, and the operator is shown it as the "Hold File Reference Number". The moved products are deleted from `VENDRET`. The program does NOT get an RA number from the vendor (that is `VEND.ENT.RA`), ship anything (`VEND.ENT.SHIP`), create an AP debit memo or credit, or change inventory.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| `VENDRET` | Pending vendor-return pool, one record per product (attr 1 defective qty, attr 2 package qty, attr 3 serial numbers). Its `AVEND` dictionary item resolves the vendor through IVMST `A.VENDOR` (attr 37) | READ+WRITE (records deleted) |
| `VENDRA` | Vendor RA hold/request records (header plus product/qty multivalues) | WRITE |
| `APMST` | AP (actual) vendor master. Used to validate the vendor and show its name | READ |
| `CONTROL` | `'IV.INP.RETURNS'` in-progress flag/lock, and `'RA'` next-reference counter | READ+WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `CHAIN 'ABORT'` | Fatal error exit when a file cannot be opened or CONTROL `'RA'` is missing |
| `EXECUTE 'SSELECT VENDRET WITH AVEND=<vid>'` | Selects pending return products for the vendor (line 58) |

**Internal labeled sections (subroutine-like):**

N/A — straight-line program; no internal label spans more than 10 lines or is called from multiple places.

## 4. Business rules — extracted

### Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.RA.HOLD.01 | An RA request is opened for an **AP vendor** (an APMST key). The vendor must exist in APMST. The operator sees the APMST name and must confirm with `Y`. `E` or `END` exits. | 46–50 | KEEP |
| VEND.RA.HOLD.02 | A product belongs to the RA vendor when `VENDRET.AVEND` equals that vendor. `AVEND` is a dictionary I-descriptor: IVMST attr 37 `A.VENDOR`, or IVMST.DISC `A.VENDOR` for discontinued products when the IVMST value is blank. The program does **not** use the PRO vendor (IVMST attr 5 / VNMST), `VNMST.APID` (attr 12) or `VENDXREF`. A product with a blank A.VENDOR in both files is never selected. | 58; `D_VENDRET` AVEND | QUESTION |
| VEND.RA.HOLD.03 | The RA request date defaults to today when left blank. Otherwise it must look like `MM.DD.YY` (pattern `2N.2N.2N`) and is stored as an internal date. There is no range check. | 52–54 | SIMPLIFY |

VEND.RA.HOLD.02: The business must confirm that vendor returns are always grouped by actual/AP vendor (A.VENDOR) and say what should happen to returns for products that have no A.VENDOR.

### Authorization / hold / status checks

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.RA.HOLD.04 | If the CONTROL record `'IV.INP.RETURNS'` exists with a non-zero value, the program refuses to run ("IV.INP.RETURNS is being run - no entries allowed"). | 28–31 | QUESTION |

VEND.RA.HOLD.04: No program in BP writes this CONTROL value. `IV.INP.RETURNS` itself does not set it. The business must say whether this mutual-exclusion rule (no RA batching while member returns are being entered) is still needed, and how it is supposed to be set.

### Date and quantity rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.RA.HOLD.05 | The RA quantity for a product is `VENDRET` attr 1 (defective qty) **plus** attr 2 (package qty). The defective/package split is lost on the RA, and the serial numbers in attr 3 are discarded when the VENDRET record is deleted. | 61, 66; `D_VENDRET` DEF/PKG/SERIAL | QUESTION |
| VEND.RA.HOLD.06 | Every pending return for the vendor goes onto one RA request. There is no product selection at this step; changes are made afterwards in `UPD.VENDRA`. | 58–67 | KEEP |

VEND.RA.HOLD.05: The business must say whether vendors need defective and package (non-defective/overstock?) returns kept separate on the RA, and whether serial numbers must travel with the RA.

### Persistence — what gets written where

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.RA.HOLD.07 | Creates one `VENDRA` record keyed by the next number from CONTROL `'RA'` attr 1, then increments the counter. Layout: attr 1 = AP vendor, attr 2 = RA request date, attr 3 = products (MV), attr 4 = quantities (MV, same positions as attr 3). The key is shown to the operator as the "Hold File Reference Number". | 62–65, 69–70, 77–78, 81 | KEEP |
| VEND.RA.HOLD.08 | Each `VENDRET` record that is moved is deleted, which clears the product from the pending-return pool. | 66 | KEEP |

### Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.RA.HOLD.09 | CONTROL `'IV.INP.RETURNS'` is read with `READU ... LOCKED`. While it is locked the program retries every 5 seconds and gives up after more than 10 tries. Once acquired, the lock is held for the whole session. | 17–27 | SIMPLIFY |
| VEND.RA.HOLD.10 | The CONTROL `'RA'` counter is read with `READU ... LOCKED`, retried every 5 seconds, giving up after more than 10 tries. A missing record aborts. The lock is held from program start until the counter is rewritten at the end, so only one RA batch can be in progress at a time. | 32–44, 78 | SIMPLIFY |
| VEND.RA.HOLD.11 | Each VENDRET product record is read with `MATREADU` and no `LOCKED` clause, so the program waits indefinitely while another user holds it. Not-found releases the record and skips it. | 60 | SIMPLIFY |
| VEND.RA.HOLD.12 | The target `VENDRA` record lock is retried every 5 seconds with **no** retry limit. | 71–76 | SIMPLIFY |

### Error handling / call-Computyme prompts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| VEND.RA.HOLD.13 | If any of VENDRET, VENDRA, APMST or CONTROL cannot be opened, the program lists the failed files and chains to ABORT. | 8–16 | KEEP |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `'IV.INP.RETURNS'` | Other (CONTROL key) | 19, 21, 29 | In-progress flag/lock for member-return entry | QUESTION |
| `'RA'` | Other (CONTROL key) | 34, 78 | Next VENDRA hold reference number | QUESTION |
| `10` retries × `5` seconds | Threshold | 22–23, 40–41 | Lock wait limits (the VENDRA wait at 71–76 has no limit) | QUESTION |

No customer-specific or vendor-specific identifiers found (no hard-coded member or vendor numbers).

## 6. Data shape — record layouts referenced

### VENDRET (read into matrix R, DIM 2)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 0 | PROD | Product code (record key) | — | |
| 1 | DEF / QUAN | Defective quantity pending return | units | Summed with attr 2 |
| 2 | PKG | Package quantity pending return | units | Meaning of "package" unclear, confirm |
| 3 | SERIAL | Serial numbers (MV) | — | Not read (DIM 2); lost when the record is deleted |
| I-desc | AVEND | IVMST.A.VENDOR, else IVMST.DISC.A.VENDOR | — | Drives vendor selection |

### VENDRA (built in dynamic array REC)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 0 | ID | Hold reference number (CONTROL `'RA'`) | — | Not the vendor's RA number |
| 1 | AVEND / VENDOR | AP vendor (APMST key) | — | |
| 2 | DATE | RA request date | internal date (days since 1967-12-31) | |
| 3 | PROD | Products (MV) | — | Sorted by product (SSELECT) |
| 4 | QUAN | Quantities (MV) | units | Defective + package combined |
| 5 | RA | Vendor RA number | — | Not written here (VEND.ENT.RA) |
| 6 | SHIPPED | Ship date | internal date | Not written here (VEND.ENT.SHIP) |
| 7 | COMP | Completed date | internal date | Not written here (VEND.ENT.COMP) |
| 8 | WHO | Who entered | — | In dictionary; **never written** by any VENDRA program in BP |
| 9 | REASON | Override reason | — | In dictionary; never written by these programs |

No money fields are stored. RA value is computed only at report time by `RPT.VENDRA` through the dictionary (IVMST RAW cost × qty, MD2 = cents).

### CONTROL `'RA'`

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 1 | — | Next hold reference number | integer | The whole record is read into RA and incremented (line 78) |

## 7. Bug suspects

- **No transactional guard (lines 66 vs 77):** each VENDRET record is deleted inside the selection loop *before* the VENDRA record is written. A crash or abort between the two loses the pending returns.
- **Empty RA created (lines 59–78):** if the vendor has no pending VENDRET products, REC stays empty. The program still writes an empty VENDRA record and uses up a reference number. There is no "nothing to return" check, and line 70 runs `DEL REC<3,0>`.
- **Uninitialized, shared retry counter (lines 22, 40):** `TIMES` is never initialized, and the second lock loop starts from whatever count the first loop left.
- **Ineffective guard (lines 19–31):** the program locks and tests CONTROL `'IV.INP.RETURNS'`, but `IV.INP.RETURNS` neither sets nor checks that record, so the mutual exclusion does not actually happen.
- **Possible file-name mismatch:** `IV.INP.RETURNS` accumulates pending returns into a file opened as `VNRET`, while this program reads `VENDRET`. Confirm that `VNRET` is a VOC pointer to `VENDRET`. Otherwise this program's pool is fed by an unknown producer.
- **Silent exclusion (line 58):** products with no A.VENDOR are never selected and stay in VENDRET indefinitely, with no report.
- **Whole-record arithmetic (lines 34, 78):** `RA` holds the whole CONTROL record. If that record ever gets a second attribute, `RA+=1` will fail or produce garbage.
- **Long-held locks:** the CONTROL `'RA'` lock is held through the operator prompts, which blocks every other RA batch.
- **No audit:** VENDRA attr 8 `WHO` exists in the dictionary but is never written.
- **Bad dates stored blank (line 54):** `ICONV` of an invalid date that matches the pattern (e.g. `13.45.06`) returns blank, and a blank request date is stored silently.

## 8. Schema-design notes for the CTO

- Entities: **VendorReturnRequest** (header: vendor, request date, reference number) and **VendorReturnLine** (product, quantity); the pending return pool (**PendingVendorReturn**, per product) is consumed.
- Vendor identity for returns is the **actual/AP vendor** (IVMST attr 37 → APMST), not the PRO vendor group. The Vendor Desk must keep that link per product and decide what happens when it is blank.
- Split today's single quantity back into **defective qty** and **package qty** (or a reason code) on each line. Carry serial numbers through to the line.
- Two numbers are easy to confuse: the internal hold reference number (VENDRA key) and the vendor-issued RA number (attr 5). Model them as separate, clearly named fields.
- Audit is missing: who created the request, when, and status transitions (requested → RA issued → shipped → completed).
- Request status is implicit (based on which date fields are filled). Model it as an explicit status with allowed transitions.
- Extract the siblings first: `IV.INP.RETURNS` (pool producer), `IV.UPD.RETURNS`, `RPT.VENDRA`, and confirm the `VNRET`/`VENDRET` relationship.

## 9. Questions for COO/CFO — consolidated

1. Are vendor returns always grouped by the actual (AP) vendor on the product, and what should happen to returns for products with no actual vendor? (relates to VEND.RA.HOLD.02)
2. Should the system still prevent RA batching while member returns are being entered, and if so, what triggers it? (relates to VEND.RA.HOLD.04)
3. Do vendors need defective and package quantities separated on the RA, and do serial numbers need to be sent? (relates to VEND.RA.HOLD.05)
4. Should an RA request always take every pending return for the vendor, or should the operator be able to pick products and leave others pending? (relates to VEND.RA.HOLD.06)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 5 | VEND.RA.HOLD.01, .06, .07, .08, .13 |
| SIMPLIFY | 5 | VEND.RA.HOLD.03, .09, .10, .11, .12 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 3 | VEND.RA.HOLD.02, .04, .05 |
| WAREHOUSE-ONLY | 0 | |

Total: 13 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling program | `VEND.ENT.RA` | Fills VENDRA attr 5 (vendor RA number) |
| Sibling program | `VEND.ENT.SHIP` | Fills VENDRA attr 6 (ship date) |
| Sibling program | `VEND.ENT.COMP` | Fills VENDRA attr 7 (completed date) |
| Sibling program | `UPD.VENDRA` | Adds or removes products and changes quantities on a VENDRA request |
| Sibling program | `RPT.VENDRA` | Prints the "Defective Merchandise Return Request" from VENDRA (value = IVMST RAW × qty) |
| Upstream producer | `IV.INP.RETURNS` | Member return entry; accumulates defective (`D`) / package (`P`) qty per product into `VNRET` attrs 1/2 |
| Shared file | `APMST` | AP vendor master (vendor identity for RAs) |
| Shared file | `IVMST` attr 37 `A.VENDOR` (via VENDRET dictionary) | Product → actual vendor link |
| Shared file | `CONTROL` | `'RA'`, `'IV.INP.RETURNS'` |

**Sibling-series flag:** part of the `VEND.*` / `*VENDRA` RA family (VEND.RA.HOLD → VEND.ENT.RA → VEND.ENT.SHIP → VEND.ENT.COMP, plus UPD.VENDRA and RPT.VENDRA). This appears to be the canonical program that creates RAs. There are no `.O`/`.TEST`/`.SJL` variants in BP.
