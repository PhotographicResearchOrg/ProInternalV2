# IV.DSP.PROD — Product display (read-only copy of product maintenance)

**Source program:** `BP/IV.DSP.PROD`
**Domain:** Products
**Integration mode:** Interactive
**Lines of code:** 310
**Last code change:** 11 May 2012 (header line 3; "05-11-12 - sjl - Add Entry.no, Duty and move Dim")
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

> Note: the header still reads "PRODUCT MAINTENANCE", and change-log entries before 03-19-04 belong to IV.MNT.PROD ("COPY MAINTENANCE TO BE DISPLAY"). Those older entries (e.g. "Prompt for order update on PRICE.1 change") describe the maintenance program, not this one. They are **not** rules of this program.

## 1. Purpose — what this program does

An inquiry screen. The user enters a product number, UPC or catalog number and sees the full product record. Alongside the stored fields it shows computed stock figures: units on hand, average cost, member-requested quantity, quantity on order from the vendor and YTD shipments. The user can pop up 24-month member-order history ("O") or shipment history ("S"), comparing this year with last year. Nothing is written and no lock is taken. It is the closest legacy equivalent of the PIV2 product page's stock / purchase-order summary.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master (current year) | READ |
| IVMST.<YY> | Prior-year snapshot of the product master (e.g. IVMST.25), opened by computed name | READ |
| IVCAT | UPC/catalog-number → product index | READ |
| VNMST | PRO vendor name | READ |
| APMST | AP vendor name | READ |
| IGROUPS / EGROUPS | Group descriptions | READ |
| CONTROL | `UPD` attr 2 = current processing month; `COO` = country-of-origin table; also passed to DRAW.BOX | READ |
| SCREENS | `IV.DSP.PROD`, `IV.DSP.PROD.PRMTS` | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `CALL EDIT.LINE` (305) | Input |
| `CALL DRAW.BOX` (254, 279) | Draws the history pop-up frame |
| `CHAIN 'ABORT'` (32, 36, 44, 56, 60) | Fatal-error exit |
| `CALL LIST.BOX` | Commented out (252, 277), retired 03-22-04 |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| DSP.FLDS | 147–211 | DSP.PROD (144) |
| DSP.HIST | 239–263 | INP.OPT (129) |
| DSP.SHIP | 264–288 | INP.OPT (130) |

## 4. Business rules — extracted

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.DSP.PROD.01 | The entry is resolved through IVCAT (UPC or catalog number) first, otherwise used as a product number. An unknown product shows "not on file" and returns to the prompt. | 92–110 | KEEP |
| IV.DSP.PROD.02 | Display is read-only: the product and prior-year records are read without locks and nothing is written. | 105, 111 | KEEP |

### 4.2 Authorization

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.DSP.PROD.03 | There is no access check: any user who can run the program sees raw cost, PO (special) cost, average cost, all price levels, surcharge and rebate %. | 21–90 (no check); 159–168, 174–178 | QUESTION |

QUESTION .03: Which roles may see cost (raw, PO cost, average/landed cost) versus sell prices on the PIV2 product page?

### 4.3 Pricing and cost display

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.DSP.PROD.04 | Average cost = INT(SUM(receipt amounts, attr 25) / SUM(receipt quantities, attr 24) + 0.5), in **cents**, shown with 2 decimals; blank when quantity is 0. | 174–178 | KEEP |
| IV.DSP.PROD.05 | Raw cost is shown exactly as stored if it contains "Y" (foreign-currency amount), otherwise as dollars.cents. No currency conversion is shown. | 159–161 | QUESTION |

QUESTION .05: For foreign-currency raw costs, should the product page show the vendor-currency amount, the converted USD amount, or both, and from which exchange-rate source?

### 4.4 Quantity rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.DSP.PROD.06 | Units on hand = SUM of receipt quantities (attr 24, multi-valued). This implies attr 24 holds the remaining quantity of each receipt layer, not the original received quantity. | 179 | QUESTION |
| IV.DSP.PROD.07 | Member requested quantity = SUM(attr 3 REQ). | 180 | KEEP |
| IV.DSP.PROD.08 | **On order (from vendors) = SUM(open PO quantities, attr 21) + SUM(PO backorder quantities, attr 23).** | 181 | KEEP |
| IV.DSP.PROD.09 | YTD shipped = SUM(monthly shipments, attr 13). | 189 | KEEP |

QUESTION .06: Confirm that receipt quantities are decremented as stock ships (FIFO layers). This decides how on-hand and average/landed cost are rebuilt in SQL.

### 4.5 Date / period rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.DSP.PROD.10 | Prior-year data comes from file `IVMST.<YY>`, where YY is last calendar year (2 digits). If the system's processing month (CONTROL UPD attr 2) is still 12 while the calendar month is January (year-end not yet run), the year before that is used. The program aborts if the file does not exist. | 34–45 | SIMPLIFY |
| IV.DSP.PROD.11 | Member-order history ("O") shows 12 current-year monthly order quantities (attr 17) with their total. The prior-year row (attr 18) shows 12 months, the total for the same period (months 1 through the processing month) and the full-year total. | 239–263 | KEEP |
| IV.DSP.PROD.12 | Shipment history ("S") shows 12 current-year monthly shipments (attr 13) with their total, and the prior-year monthly shipments from IVMST.<YY> attr 13 with a same-period total and a full-year total. | 264–288 | KEEP |

### 4.6 Status / flag display

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.DSP.PROD.13 | Discard and do-not-ship display "YES" when the value is 1, otherwise "No". Weight is suffixed "lbs". Country of origin is decoded to the first 6 characters of the name in CONTROL COO. Delete status, warehouse rebate/IPI, HS code, duty, entry number and warehouse UPC are shown as stored. | 171–173, 190–208, 58–61 | KEEP |
| IV.DSP.PROD.14 | A missing group/web-group shows "* MISSING *", a missing PRO vendor shows "* MISSING VNMST *", and a missing AP vendor shows a blank name (the AP vendor value itself is still shown). | 212–233 | SIMPLIFY |

### 4.7 Navigation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.DSP.PROD.15 | At the option prompt: Enter = new product, "O" = order history, "S" = shipment history, "E" = end. Anything else is treated as a new product lookup. | 118–136 | SIMPLIFY |

Customer-specific exceptions (hard-coded member numbers): N/A — none.
Vendor-specific exceptions (hard-coded vendor numbers): N/A — none.
Product-group rules: N/A — none.
Persistence: N/A — read-only (rule .02).
Concurrency: N/A — no locks taken (rule .02).
Wire format / parsing: N/A — interactive.

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `'UPD'` attr 2 (CONTROL) | Other | 34 | Current processing month | QUESTION |
| `12` / `01` | Magic-date | 41 | Year-end-not-yet-run test (processing Dec, calendar Jan) | QUESTION |
| `'IVMST.'` + 2-digit year | File-path | 42 | Prior-year snapshot file naming | QUESTION |
| `'COO'` (CONTROL) | Other | 58 | Country-of-origin table | QUESTION |
| `.5` rounding | Magic-number | 177 | Average-cost rounding to the nearest cent | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVMST and IVMST.<YY> (matrices IVM and IVMPY, DIM 70)

Display-only. Attribute mapping is the same as `IV.MNT.PROD.md` / `IV.MNT.PROD.N.md` Section 6. Attributes used *only* by this program's computed fields:

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 3 | IVMST.REQ | Member requested qty, summed | units | D_IVMST marks it single-valued, but the code SUMs it. Confirm |
| 13 | IVMST.YTD | Monthly shipments (MV, value n = month n) | units | Also read from IVMST.<YY> |
| 17 | IVMST.MORD | Monthly member orders, current year (MV) | units | |
| 18 | IVMST.MPYR | Monthly member orders, prior year (MV) | units | **Duplicates** what IVMST.<YY> attr 17 would hold. Two sources of prior-year orders |
| 21 | IVMST.QTY.ORD | Open PO quantity per PO (MV, parallel to attr 20 PO.NO) | units | |
| 23 | IVMST.QTY.BO | Backordered PO quantity per PO (MV) | units | |
| 24 | IVMST.QTY.REC | Receipt-layer quantity (MV) | units | Summed as on-hand |
| 25 | IVMST.AMT.REC | Receipt-layer extended cost (MV) | **cents** (MD2) | |
| 51 | IVMST.W.UPC | Warehouse UPC/EAN | n/a | Display only |
| 54 | IVMST.DUTY | Duty | unknown — confirm | Overloaded with SHIP.CHG (money) in D_IVMST |
| 55 | IVMST.ENTRY.NO | Customs entry number | n/a | |

All money values shown (raw, PO cost, Price-1/2/3, retail, MAP, average cost) are stored in **cents** and displayed with MD2. Surcharge is **tenths of a percent** (MD1). Rebate % is a **whole percent**.

### CONTROL `UPD`

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 2 | — | Current processing month (1–12) | month | Drives prior-year file choice and same-period totals |

## 7. Bug suspects

1. **Display typo (line 215):** `ROW=6` instead of `MROW=6` (copied from IV.MNT.PROD line 242), so the group description prints at the wrong row.
2. **Hard abort on a missing prior-year file (lines 42–45):** if `IVMST.<YY>` was not created (year-end not run, or a new year before the snapshot), the whole inquiry is unusable, even for current-year data.
3. **Commented-out branch shows the rule changed (lines 39–41):** "Temp change on 1/4/10 until Year-End Updates create IVMST.09" replaced the `CMON = 1` test with `CMON = 12`. A "temporary" change has been live since 2010. Confirm which condition is correct.
4. **2-digit year arithmetic (lines 38, 41):** `YEAR-1 'R%2'` on a 2-digit string; it will break at the century boundary (low risk, but note for data migration of IVMST.<YY> files).
5. **Inconsistent prior-year sources:** order history takes prior year from IVMST attr 18 (MPYR), while shipment history takes it from the IVMST.<YY> snapshot file (attr 13). If the two diverge (e.g. a product created mid-year, or MPYR rolled at a different time), the screens disagree.
6. **Unused/unsafe values (lines 243, 247, 268, 272):** DC is computed and never used. Months beyond 12 in the MV are silently ignored, while SUM includes them.
7. **REQ summed although single-valued in the dictionary (line 180):** harmless if single, but confirm whether REQ can hold multiple values.

## 8. Schema-design notes for the CTO

- **Read-only consumer** of Product (IVMST) plus prior-year snapshots (IVMST.<YY>). It is the clearest specification for the PIV2 product page's stock/PO summary block: **On hand = Σ receipt-layer qty; On order = Σ open PO qty + Σ PO backorder qty; Requested = Σ member requests; Available (dictionary AVAIL/TOT.AVAIL) = on hand + on order − requested; Average cost = Σ layer cost / Σ layer qty.**
- **Overloaded / denormalised structures to split:** open-PO data (attrs 20–23) and receipt layers (24–26) are parallel multi-value arrays inside the product record. In SQL they belong to the PO-line and goods-receipt/inventory-layer entities, with product-level figures derived by query rather than stored.
- **Period history** is stored as 12-slot monthly arrays per year (MORD, MPYR, YTD, SYTD, PYTD) plus a whole-file copy per year (IVMST.<YY>). Replace with dated transaction facts (orders, shipments) aggregated by period. The year-end rollover then disappears.
- **Missing audit/security:** cost visibility is unrestricted. PIV2 needs a "can view cost" permission separate from "can edit".
- **Units:** confirm that AMT.REC is cents and includes any foreign-currency conversion at receipt (likely set by the receiving program, not here).
- **Siblings to extract before the product-page/PO schema commit:** the receiving program(s) that write attrs 24–26 and maintain layers; the PO entry/receiving programs that write attrs 20–23 (and IVPO); the year-end program that creates IVMST.<YY> and rolls MORD→MPYR; whatever writes REQ.

## 9. Questions for COO/CFO — consolidated

1. Who may see cost information on the product page? (IV.DSP.PROD.03)
2. For foreign-currency raw costs, show the native amount, USD or both? Which FX rate? (IV.DSP.PROD.05)
3. Do receipt quantities decrease as stock ships (FIFO layers)? Is average cost the official landed cost? (IV.DSP.PROD.06)
4. Is the year-end test "processing month = 12 in January" still correct, and is the prior-year snapshot still needed? (IV.DSP.PROD.10)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 9 | .01, .02, .04, .07, .08, .09, .11, .12, .13 |
| SIMPLIFY | 3 | .10, .14, .15 |
| OBSOLETE | 0 | — |
| OBSOLETE-INTEGRATION | 0 | — |
| QUESTION | 3 | .03, .05, .06 |
| WAREHOUSE-ONLY | 0 | — |

Total: 15 rules (9 + 3 + 3 = 15).

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling (origin) | IV.MNT.PROD | This program began as a copy of it (03-19-04) |
| Sibling (variant) | IV.MNT.PROD.N | Displays the fields only .N maintains (DUTY, ENTRY.NO), which supports .N being live |
| Subroutine | EDIT.LINE, DRAW.BOX | |
| Shared file | IVMST, IVMST.<YY>, IVCAT, VNMST, APMST, IGROUPS, EGROUPS, CONTROL (UPD, COO), SCREENS | |
| Related | IVPO / PO programs, receiving programs, year-end rollover | Producers of attrs 20–26 and IVMST.<YY> |
| Dictionary | D_IVMST AVAIL, TOT.AVAIL, ON.ORD, AVG.COST, QTO | Same formulas as rules .04/.08 plus available-to-sell and reorder quantity |
| Domain crossover | Inventory, Purchasing, Orders | |

**Sibling-series flag:** not a numbered/suffixed variant. It is the canonical (only) product display program, though it is a forked copy of IV.MNT.PROD.
