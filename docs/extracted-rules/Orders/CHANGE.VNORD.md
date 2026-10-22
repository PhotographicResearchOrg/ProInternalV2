# CHANGE.VNORD — Program to change VNORD and NUMBER when vendor changes

**Source program:** `BP/CHANGE.VNORD`
**Domain:** Orders
**Integration mode:** Utility/maintenance
**Lines of code:** 60
**Last code change:** 06/24/2003 (header line 3; changelog 6-24-03 SJL "Add update/change of NUMBER file")
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

When a product's **PRO vendor** (IVMST attr 5 `VEND`) changes, this program moves that product's open member order lines from the old vendor's vendor-order records (`VNORD`) to the new vendor's. It also updates the vendor on the order-number index (`NUMBER`). It is started automatically by product maintenance (`IV.MNT.PROD` and `IV1`), which stack the product and old vendor as input after IVMST has already been saved with the new vendor. It does NOT change purchase orders (IVPO), backorders (BKORD), allocations, or the actual/AP vendor (IVMST attr 37).

## 1.5. Integration footprint

N/A — utility/maintenance (invoked by `EXECUTE 'RUN CHANGE.VNORD'` with `DATA` stacked by the caller).

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| `VNORD` | Member orders split by PRO vendor. Key = `<3-char PRO vendor><member order no>` | READ+WRITE (records deleted and created) |
| `NUMBER` | Order-number index (attr 4 = PRO vendor; dictionary `VN = VENDOR:ORDER`) | READ+WRITE |
| `IVMST` | Product master. Attr 5 = new PRO vendor, attr 6 = product group | READ |
| `VNMST` | PRO vendor master (old vendor existence check) | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `EXECUTE 'SELECT VNORD WITH VEND = ... AND WITH PROD = ...'` | Finds the old vendor's orders containing the product |
| `EXECUTE 'SELECT NUMBER WITH VN = ...'` | Finds index entries for the changed orders |
| `CHAIN 'ABORT'` | Open/read failures |

**Internal labeled sections (subroutine-like):**

N/A — two inline loops.

## 4. Business rules — extracted

### Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| CHANGE.VNORD.01 | Inputs are the product and its **old** PRO vendor. The **new** vendor is read from IVMST attr 5, so IVMST must already hold the new vendor. Callers: IV.MNT.PROD (line 175–179, when `VEND.CHG`) and IV1 (line 75–78, when `IV(5) # OVND`). | 12–14, 39 | KEEP |
| CHANGE.VNORD.02 | The old vendor must exist in VNMST (PRO vendor master), otherwise abort. The new vendor is **not** validated. | 15 | SIMPLIFY |

### Persistence — order move

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| CHANGE.VNORD.03 | For each of the old vendor's VNORD records that contain the product, the product's line (attr 2 PROD and attr 3 QUAN at the same position) is removed. If no products remain, the old VNORD record is deleted. | 18–35 | KEEP |
| CHANGE.VNORD.04 | The removed line is moved to the VNORD record keyed `<new vendor><same member order no>`. If that record exists, the line is appended. Otherwise a new record is created with the member (attr 1) and header attrs 4–11 copied from the old record. | 39–44 | KEEP |
| CHANGE.VNORD.05 | VNORD keys assume a **3-character PRO vendor number** followed by the member order number (`VNID[4,7]`), so PRO vendor numbers are effectively fixed at 3 characters. | 39; `D_VNORD` VEND = `@ID[1,3]` | QUESTION |
| CHANGE.VNORD.07 | The NUMBER index attr 4 (VENDOR) is set to the new vendor for every VNORD key that changed. | 48–59 | KEEP |

CHANGE.VNORD.05: The business and CTO must confirm that PRO vendor numbers are always 3 characters (AP vendor numbers appear to be 4: `APDIST VENDOR = @ID[1,4]`). The new Vendor Desk must keep or explicitly migrate this length difference.

### Product-group rules (hard-coded group numbers)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| CHANGE.VNORD.06 | For products in **product group 10** (IVMST attr 6 = 10), the second value of VNORD attr 8 (`TORD`) is decreased on the old order and increased on the new order by the moved quantity. | 33, 43 | QUESTION |

CHANGE.VNORD.06: The business must say what product group 10 is and what the second value of TORD counts (a separate total for that group?), and whether this still applies.

### Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| CHANGE.VNORD.08 | VNORD records (old and new) are read with `MATREADU` and no LOCKED clause, so the program waits. All locks are released after each order (`RELEASE`). | 22, 40, 45 | SIMPLIFY |
| CHANGE.VNORD.09 | NUMBER records are read with `READU` and no LOCKED clause (wait), and released after each record. | 54, 58 | SIMPLIFY |

### Error handling / call-Computyme prompts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| CHANGE.VNORD.10 | A file open failure, a missing IVMST product or a missing old VNMST vendor chains to ABORT. | 7–15 | KEEP |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `10` | Product-group | 33, 43 | Group 10 gets TORD value-2 adjustment | QUESTION |
| `[4,7]` key slice / 3-char vendor prefix | Magic-number | 39 | VNORD key = 3-char PRO vendor + order no | QUESTION |

No customer-specific or vendor-specific identifiers found (no hard-coded member or vendor numbers).

## 6. Data shape — record layouts referenced

### VNORD (read into matrices ORD / NORD, DIM 15)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 0 | key | `<PRO vendor 3><member order>` | — | |
| 1 | MEMBER | Member | — | Copied |
| 2 | PROD | Products (MV) | — | Line moved |
| 3 | QUAN / QSB | Quantities (MV) | units | Line moved |
| 4 | DATE | Order date | internal date | Copied (new record only) |
| 5 | PO | Member PO | — | Copied |
| 6 | SHIP | Ship date | internal date | Copied |
| 7 | INST | Instructions | — | Copied |
| 8 | TORD | MV; value 2 adjusted for group 10 | unknown (confirm; `CHECK` I-desc formats it MD02Z, suggesting money) | **Purpose unclear, confirm.** Possibly overloaded |
| 9 | SHIP.INFO | Ship-to info (MV) | — | Copied |
| 10 | ALLOC / A.QUAN | Allocated qty **per product (MV)** | units | Copied wholesale as if it were header data → see Bug suspects |
| 11 | SHIP.ZONE | Zone | — | Copied |
| 12–14 | STATUS / METHOD / PS | Status, ship method, PS | — | **Not copied** to a new record |

### NUMBER (dynamic REC)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 4 | VENDOR | PRO vendor | — | Overwritten with the new vendor |

### IVMST (matrix IV, DIM 40)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 5 | VEND / PVEND | New PRO vendor | — | Read after the caller updated it |
| 6 | GRP | Product group | — | Group 10 special case |

No money fields are calculated here (TORD units unclear).

## 7. Bug suspects

- **Phantom lines (lines 22–45):** the move-to-new-vendor block (39–45) is **outside** the `MATREADU ... THEN` and `LOCATE ... THEN`. If the old VNORD record cannot be read, or the product is not found on it, the program still writes `NORD` to the new vendor. NORD then holds either the previous iteration's line (a duplicate quantity) or an empty matrix.
- **Empty change list (lines 48–50):** if no VNORD record changed, the program runs `SELECT NUMBER WITH VN = ` with no value. Depending on how UniVerse parses that, it either errors or selects every NUMBER record, in which case lines 54–56 would overwrite the vendor on **all** order-number index entries. **Verify urgently.**
- **ALLOC copied wholesale (line 25):** attr 10 is a per-product multivalue, but it is copied from the old order to a new order as if it were a header field, so the new order gets other products' allocation quantities. The moved product's own allocation is not moved, and the old order keeps a misaligned allocation value.
- **Status lost (line 25):** attrs 12–14 (STATUS, METHOD, PS) are not copied, so the new vendor order loses its status and ship method.
- **TORD corruption (line 42):** `DEL ORD(8)<1,2>` shifts value 3+ down into position 2 before line 43 adds the quantity, which corrupts TORD when it has 3 or more values.
- **Duplicate product line (line 41):** when merging into an existing new-vendor order, the product is appended even if it is already there.
- **No audit:** the vendor move is not logged.
- READU silent-fallthrough: not present (no LOCKED clauses, so reads wait; ELSE paths are not-found only).

## 8. Schema-design notes for the CTO

- Entities: **MemberVendorOrder** (VNORD = member order split by PRO vendor), **OrderNumberIndex** (NUMBER).
- The VNORD key **embeds the PRO vendor** (`VVV` + order no.), so a vendor change means re-keying records. The new schema should hold vendor as a foreign key on the order line, so a vendor change is an update, not a move.
- VNORD attr 10 ALLOC is per-line data and must be on the line entity. Attrs 4–9 and 11–14 are header data.
- TORD (attr 8) purpose is unknown and may be overloaded (value 2 = group-10 total?). Resolve before schema commit.
- Vendor identity: VNORD and NUMBER use the **PRO vendor (VNMST, 3 chars)**, never the AP vendor.
- Extract first: `IV.MNT.PROD`, `IV1` (callers), and the programs that build VNORD (member order split) and BKORD.

## 9. Questions for COO/CFO — consolidated

1. Are PRO vendor numbers always exactly 3 characters? (relates to CHANGE.VNORD.05)
2. What is product group 10, what does the second TORD value represent, and is the rule still needed? (relates to CHANGE.VNORD.06)
3. When a product's vendor changes, should open member orders move automatically, or should a buyer review them? (relates to CHANGE.VNORD.03, .04)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 5 | CHANGE.VNORD.01, .03, .04, .07, .10 |
| SIMPLIFY | 3 | CHANGE.VNORD.02, .08, .09 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 2 | CHANGE.VNORD.05, .06 |
| WAREHOUSE-ONLY | 0 | |

Total: 10 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Caller | `IV.MNT.PROD` (lines 175–179), `IV.MNT.PROD.N`, `IV.MNT.PROD.O` | `DATA PRODUCT,OLD.PRO.VEND` then `EXECUTE 'RUN CHANGE.VNORD'` |
| Caller | `IV1` (lines 75–78) | `DATA IVID,OVND` then `EXECUTE 'RUN CHANGE.VNORD' CAPTURING RESULTS` |
| Shared file | `VNORD`, `NUMBER` | Member order split by vendor (see `D_VNORD`, `D_NUMBER`) |
| Shared file | `VNMST` | PRO vendor master |
| Shared file | `IVMST` attr 5 / attr 6 | PRO vendor / product group |

**Sibling-series flag:** no series. Standalone and canonical. Its callers have `.N`/`.O` variants (IV.MNT.PROD.N, IV.MNT.PROD.O).
