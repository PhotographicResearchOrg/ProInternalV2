# IV7 — Inventory adjustments

**Source program:** `BP/IV7`
**Domain:** Inventory
**Integration mode:** Interactive
**Lines of code:** 222
**Last code change:** 07/07/2003 (header line 3; changelog 7-7-03 SJL "TEMP DISABLE OPTION 1 - CHANGE VENDOR ORDERS")
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

Operators use this screen to correct a product's inventory. Option 2 changes the quantity of a specific cost layer (receipt), with its value prorated. Option 3 overwrites the total stock value, collapsing all layers into one. Each stock or value change needs a reason and is logged to `IVADJ`. Option 1, changing quantity or raw cost on open vendor orders, has been "temporarily" disabled since July 2003. Its code is still present and wrote only to IVMST, never to IVPO. The program never changes IVPO or RECLOG, so a receiving correction made here does not reach PO receipt history.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master: open POs (20–23), cost layers (24–26), status (15), L.REQ (3) | READ+WRITE |
| IVPO | Purchase order: date read for display; header read in the disabled option 1 | READ |
| IVADJ | Inventory adjustment audit log | WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `CHAIN 'ABORT'` | File open failure (13–15) |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| `20`/`30` Update record | 53–89 | 113, 134, 146 |
| `400` Select line to change | 147–190 | 106, 111, 127, 132 |
| `900` Update IVADJ | 191–208 | 87 |
| `1000` Enter reason | 209–221 | 144, 153 |

## 4. Business rules — extracted

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV7.01 | The operator must enter initials, which must not be numeric and are upper-cased. Blank, `E`, `END` or ESC exits. The initials are stored on every adjustment. | 21–24 | KEEP |
| IV7.02 | The product must exist in IVMST. If it is locked, the program retries every 2 s for up to 120 s, then says "CHOOSE ANOTHER PRODUCT". Locked and not-found are told apart correctly. | 25–39 | SIMPLIFY |
| IV7.03 | The screen shows three totals: vendor orders = SUM(IVMST 21) + SUM(23), present stock = SUM(24), stock value = SUM(25) in USD cents. | 42–46 | KEEP |

### 4.2 Vendor-order adjustment (option 1, disabled)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV7.04 | Option 1 "Vendor orders" is refused with "NOT NOW" (disabled 7-7-03). | 48–49 | OBSOLETE |
| IV7.05 | Disabled code: listed each open PO (with PO date from IVPO attr 2) and let the operator change its qty (written to open qty 21 if present, otherwise BO 23) and its raw cost (cents, or whole yen with `Y`). It updated IVMST only. The IVPO block (75–86) calculates `ORIG.QTY` and never writes it, and no IVADJ record was written. | 75–86, 90–113, 163–190, 197 | OBSOLETE |

### 4.3 Stock (cost-layer) adjustments

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV7.06 | Receiving adjustment (option 2): the operator picks a cost layer (IVMST 24/25/26 position) and enters a new whole-number qty. The layer value is prorated at its existing unit cost, `INT(oldValue / oldQty × newQty + 0.5)` in USD cents. The layer date is unchanged. | 114–134, 171–175 | KEEP |
| IV7.07 | Value adjustment (option 3): the operator enters a new total stock value in cents (no decimals) and confirms it with Y. **All layers are collapsed into one**: qty = total qty, value = new value, date = today. | 135–146 | KEEP |
| IV7.08 | A reason is required for stock and value adjustments: 5–25 characters, upper-cased, defaulting to the previous reason entered in the session. `E`/`END`/ESC abandons the changes. | 209–221, 144–145 | KEEP |
| IV7.09 | Each saved stock or value adjustment writes an IVADJ record. Key = internal date + whole seconds. Fields: 1 initials, 2 product, 3 qty change (new − original total), 4 value change in USD cents, 5 reason VM description ("Stock - <old> to <new>" or "Value - <old> to <new>"). No IVADJ record is written for vendor-order adjustments. | 191–208 | KEEP |
| IV7.10 | On save, the product status is recalculated. If IVMST 15 (STATUS) > 0: when on-order + BO + stock + IVMST 3 (L.REQ) = 0, status becomes 3; otherwise, when on-order + BO + stock = 0 and L.REQ ≠ 0, status becomes 2. | 53–58 | QUESTION |
| IV7.11 | On save, any open-PO entry whose open + BO qty = 0 is removed from IVMST 20–23, and any cost layer with qty 0 is removed from 24–26. | 59–73 | KEEP |
| IV7.12 | Changes are held in memory and written only when the operator presses Enter at the line prompt and gives a reason. `END` at any prompt discards everything ("All changes ignored"). | 52, 107, 112, 128, 133, 147–156 | KEEP |

IV7.10: What do product status values 2 and 3 mean (e.g. discontinued with demand vs discontinued and empty), and should an adjustment change status automatically? What is IVMST attr 3 `L.REQ` ("Ord-Qty")? IV21 subtracts it from available stock, so it looks like committed or member-backorder quantity. Confirm.

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| Status `2`, `3` | Magic-number | 56–57 | Product status codes | QUESTION |
| 120 s / 2 s | Threshold | 35–36 | Lock wait | QUESTION |
| 5–25 chars | Threshold | 218 | Reason length | QUESTION |
| 28 / 14 | Magic-number | 105, 126, 158 | Lines per screen and column (UI) | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVMST (matrix M, DIM 30)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 3 | L.REQ | Status rule input | units (MD0Z) | Purpose unclear: committed or required qty? Confirm |
| 4 | DESC | Display | — | |
| 15 | STATUS | Product status | code | Values 2/3 set here; meaning unclear, confirm |
| 20 | PO.NO | Open POs (MV) | — | |
| 21 | PO.QTY | Open qty (MV) | units | |
| 22 | PO.CST | Unit cost (MV) | USD cents or whole yen + `Y` | `SUM()` of this field (43, 194) is meaningless |
| 23 | BO | BO qty (MV) | units | |
| 24 | QTY.REC | Layer qty (MV) | units | |
| 25 | AMT.REC | Layer value (MV) | USD cents | Entered "without decimals" (139) |
| 26 | DATE.REC | Layer date (MV) | Pick date | Reset to today on value adjustment |

### IVADJ (matrix ADJ, written)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| @ID | — | `DATE()` concatenated with `INT(TIME())` | — | Dictionary: date = @ID[1,5], time = @ID[6,5] |
| 1 | EMP | Operator initials | — | |
| 2 | PROD | Product | — | |
| 3 | QUAN | Qty change | units | |
| 4 | AMOUNT | Value change | USD cents (MD2Z) | |
| 5 | REASON | Reason VM description | — | |

### IVPO

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 2 | DATE | PO date for display | Pick date | |
| 6, 7, 9 | PROD / QTY.ORD / QTY.REC | Read in disabled code | units | |

## 7. Bug suspects

- **IVMST lock leak on discard (52, 107, 112, 128, 133, 137, 142, 145):** every "All changes ignored" path does `GO 10` without `RELEASE`, so the product stays locked until the program ends and blocks receiving (IV.ORD.REC waits indefinitely on it).
- **IVADJ key collision (192, 207):** the key has 1-second resolution, so two adjustments in the same second overwrite each other.
- **Wrong lock key (206):** `READU LCK FROM IVADJ, ID` locks the product ID, not the new key `AID`, and the lock is never released.
- **Divide by zero (173):** if the selected layer's qty is 0 or blank, `OAMT/OQ` fails.
- **Receiving corrections not reflected on PO (171–175):** a layer qty change does not update IVPO 9/12 or RECLOG, so PO receipt history and stock drift apart.
- **Value adjustment destroys layer ages (143):** all layers collapse to one dated today.
- **Disabled option 1 never wrote IVPO (75–86):** if it is ever re-enabled, IVMST and IVPO would diverge.
- **`ORIG.CST`/`NEW.CST` sum unit costs (43, 194):** a meaningless figure, and non-numeric when a yen `Y` value is present. Only used in commented-out code.
- **READU silent-fallthrough:** not present. The lock loop at 29–39 uses a LOCKED clause.

## 8. Schema-design notes for the CTO

- Entities: Inventory Adjustment (header: who, when, reason; lines: qty delta, value delta, layer affected), Inventory Cost Layer, Product Status.
- The IVADJ key packs date and time into one string. Use a surrogate key with timestamp, user id (not initials) and product FK.
- Description text inside REASON (VM 2) should become structured old/new values.
- Decide whether layer-level quantity corrections must post back to the originating PO receipt or remain stand-alone adjustments.
- Status codes on IVMST 15 need a code table, and IVMST 3 `L.REQ` needs a definition before the PIV2 product schema is finalised.
- Sibling extraction needed: whatever writes IVMST 3 (likely order entry / backorder programs) and the remaining IVMST 15 writers.

## 9. Questions for COO/CFO — consolidated

1. What do status values 2 and 3 mean, what is L.REQ, and should adjustments drive status? (IV7.10)
2. Should a stock-value overwrite collapse all cost layers (losing receipt dates), or should valuation adjustments be separate entries? (IV7.07)
3. Should a correction to a receipt quantity also correct the PO's received quantity? (IV7.06)
4. Is changing open-PO qty/cost through an adjustment screen still needed, given it has been disabled since 2003? (IV7.04, IV7.05)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 8 | 01, 03, 06, 07, 08, 09, 11, 12 |
| SIMPLIFY | 1 | 02 |
| OBSOLETE | 2 | 04, 05 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 1 | 10 |
| WAREHOUSE-ONLY | 0 | |

Total: 12 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| File | IVMST 20–26 | Same multivalues maintained by IV.ORD.REC, PO.DISC, FIX.PO.CST |
| File | IVPO | Read only here |
| File | IVADJ | Read by inventory adjustment reports (dictionary `@LPTR` heading "PRO Report of Inventory Adjustments") |
| Program | `IV.ORD.REC` / `IV6.PO` | IV6.PO tells users to "make changes in the adjustment program", meaning this one |
| Program | `IV46` | Likely the current place to change open-PO qty/cost, since option 1 here is disabled. Confirm |

**Sibling-series flag:** IV7 belongs to the numbered IV series (IV6, IV7, IV11, IV21, IV46...). No suffix variants of IV7 were found in BP. It appears to be canonical.
