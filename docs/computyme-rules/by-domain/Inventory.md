# Inventory — Computyme programs and rules

37 programs, 192 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## BLD.IVPO

**Mode:** Utility/maintenance · **Lines:** 33 · **Relevance:** VENDOR, PRODUCT, PO

One-off (2003) conversion that builds IVPO purchase-order records from the PO multivalues stored on IVMST products.

**Files:** reads IVMST · writes IVPO, IVMST  
**Calls:** EXECUTE SSELECT IVMST BY-EXP PO.NUM

| ID | Rule | Source | Tag |
|---|---|---|---|
| BLD.IVPO.01 | For each IVMST PO value: IVPO key = attr 20 PO.NUM; IVPO attr 6 product, 7 qty (attr 21 PO.QTY), 8 cost (attr 22 PO.CST) appended | L13-15 | OBSOLETE |
| BLD.IVPO.02 | IVPO attr 1 = IVMST attr 5 VENDOR and IVPO attr 2 = IVMST attr 23 PO.BO of the first product on that PO (attr 2 purpose unclear) | L31 | QUESTION |
| BLD.IVPO.03 | PO cost with a "Y" flag is stripped to its numeric part; IVPO attr 12 += qty × unit cost (dict names attr 12 COST.REC) | L17-18 | QUESTION |
| BLD.IVPO.04 | IVMST attr 23 PO.BO cleared for every converted PO line | L16 | OBSOLETE |

**Bugs / oddities:** Not idempotent (re-run appends duplicate lines and re-adds totals); a PO's vendor is taken from whichever product sorts first; "Y" cost suffix meaning undocumented.

## FIX.IVPO

**Mode:** Utility/maintenance · **Lines:** 25 · **Relevance:** PO

Fix-up (2003) re-applying receiving log (RECLOG) quantities/amounts onto PO lines in IVPO.

**Files:** reads RECLOG, IVPO · writes IVPO  
**Calls:** none (active select list)

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.IVPO.01 | For RECLOG entry (1 PROD, 2 QUAN, 3 AMOUNT, 6 PO): IVPO line for that product gets attr 9 QTY.REC = qty, attr 12 COST.REC = amount, attr 11 DATE.REC = today | L13-19 | OBSOLETE |

**Bugs / oddities:** Receive date overwritten with run date, not actual receipt date; overwrites (not adds) when multiple receipts; MATREADU no LOCKED clause.

## FIX.SERIAL.NOS

**Mode:** Utility/maintenance · **Lines:** 25 · **Relevance:** PRODUCT

One-off (2009) re-key of SERIAL.NOS to PROD:SERIAL.

**Files:** reads/writes SERIAL.NOS  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.SERIAL.NOS.01 | Serial key = product (attr 2) prefixed to serial; skipped if key already starts with product (assumes 4-char product) or target exists | L12-19 | OBSOLETE |

**Bugs / oddities:** 4-char product assumption.

## FIX.TPOCST

**Mode:** Utility/maintenance · **Lines:** 29 · **Relevance:** PO, PRICING

Recalculates total received cost per PO line in IVPO.

**Files:** reads/writes IVPO  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.TPOCST.01 | IVPO attr 12 COST.REC = attr 8 COST x attr 9 QTY.REC for lines with qty received > 0 | L13-22 | SIMPLIFY |
| FIX.TPOCST.02 | Yen-cost POs: a 'Y' in IVPO attr 8 marks the unit cost as yen; total kept in yen with 'Y' suffix | L17-18 | QUESTION |

**Bugs / oddities:** MATREAD (no lock) then MATWRITE every PO.

## INP.SERIAL.NOS

**Mode:** Interactive · **Lines:** 156 · **Relevance:** PRODUCT

Capture serial numbers of cameras received, validated against per-product serial formats.

**Files:** reads CONTROL ('SERIAL.CTRL'), IVMST · writes SERIAL.NOS  
**Calls:** EDIT.LINE (only via unused INP.DATA); INCLUDE IVMST.FIELDS, SERIAL.NOS.FIELDS

| ID | Rule | Source | Tag |
|---|---|---|---|
| INP.SERIAL.NOS.01 | Only products listed in CONTROL 'SERIAL.CTRL' (each attr: value 1 product, value 2 sub-valued serial match patterns, up to 2 formats) may be serialized | L17-25,L45 | KEEP |
| INP.SERIAL.NOS.02 | Quantity 1-999; quantities > 100 must be re-entered to confirm | L80-93 | WAREHOUSE-ONLY |
| INP.SERIAL.NOS.03 | Serial uppercased, spaces removed, leading '%' (scanner prefix) stripped; must match the product's pattern | L105-116 | KEEP |
| INP.SERIAL.NOS.04 | Hard-coded product 9527: 9-char serials truncated to first 8 | L118 | QUESTION |
| INP.SERIAL.NOS.05 | Reject serial already entered in this session or already on SERIAL.NOS (key PROD:SERIAL); record = 1 date received, 2 product | L119-133 | KEEP |

**Bugs / oddities:** Header/error text says RECV.SERIAL.NUMS; READU on existing serial leaves lock; E during serial entry STOPs the whole program.

## IV.ADJ

**Mode:** Interactive · **Lines:** 573 · **Relevance:** PRODUCT, PRICING

Multi-store retail inventory adjustments (serial change, value adjustment, warehouse reduction, delete serialized item, store bulk stock, remove batch sale date, purge log) with an IVADJ audit trail.

**Files:** reads CONTROL ('WHO','WHSE','STRS','STORES','IV','ADJPUR','ADJ'), IVMST, IVINV, IVCAT (via I_READ_IVCAT) · writes IVMST, IVINV, IVADJ, CONTROL ('ADJPUR','ADJ'); BAGS, IVSOLD opened but unused  
**Calls:** MONEY; INCLUDE IVBP I_READ_IVCAT

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.ADJ.01 | IVMST field usage here does not match the PRO IVMST dictionary: attr 3 used as description (dict: REQ), 4 as product type (dict: DESC), 7/8 unit cost (dict: QUAN/NET.1), 17 units in stock (dict: MORD), 18 inventory value (dict: MPYR), 19 per-store stock (dict: RAW), 21 (dict: PO.QTY). Appears to be a Computyme retail-package (PHOTO2K) program for a different IVMST layout — likely not used at PRO | L105-107,L161,L258,L269-275 | QUESTION |
| IV.ADJ.02 | Access: employee # plus authorization; master password 'PRIMOS' bypasses the check, else EMP:AUTH must be in CONTROL 'ADJ' attr 2 | L38-54 | QUESTION |
| IV.ADJ.03 | Adjustments blocked when IVADJ not purged for >= 370 days; warning requiring OK at 180-369 days (last purge date CONTROL 'ADJPUR', defaults to today-30) | L32-36,L71-82 | SIMPLIFY |
| IV.ADJ.04 | Hard-coded product range 500-599 = MISC & USED products: no value adjustments allowed; description and cost come from the item (IVINV attr 6/8) not the master | L106,L141-142,L207,L260,L311,L315 | QUESTION |
| IV.ADJ.05 | Serial change only for product type starting with 3 (serialized); IVINV attr 5 serial replaced, old serial logged | L110-121 | WAREHOUSE-ONLY |
| IV.ADJ.06 | Value adjustment: new value = attr 18 + entered total (cents); rejected if stock > 0 and value < 0; new average cost = value/stock rounded | L161-176 | KEEP |
| IV.ADJ.07 | Average cost = INT(value/stock + .5); if stock 0, use attr 8 cost if > 0 else attr 7; if average 0, use master cost | L273-276,L455-458 | KEEP |
| IV.ADJ.08 | Warehouse reduction: unit cost entered must be positive; confirm if greater than both average and master cost, or less than 90% of average | L209-237 | KEEP |
| IV.ADJ.09 | Reduction may not take total stock or store stock negative; whole numbers only; max 99999 per entry | L507-518 | WAREHOUSE-ONLY |
| IV.ADJ.10 | Serialized/item-tracked types (2 or 3): each item # must belong to the product and not repeat; items deleted from IVINV and store stock decremented per item; else warehouse store (CONTROL 'WHSE') stock reduced by qty | L241-286 | WAREHOUSE-ONLY |
| IV.ADJ.11 | Reduction lowers units (attr 17) by qty and value (attr 18) by qty x entered cost (or sum of item costs for 500-599) | L268-270 | KEEP |
| IV.ADJ.12 | Delete item: cost removed = item cost for 500-599, else average (or master cost if stock < 1); store and total stock -1 | L315-329 | WAREHOUSE-ONLY |
| IV.ADJ.13 | Store bulk adjustment (non-serialized only): set store stock to entered level (negative allowed with confirmation); delta changes total units and value at average cost | L190-201,L359-384,L524-529 | WAREHOUSE-ONLY |
| IV.ADJ.14 | Remove batch sale date: clears IVINV attr 9 (sale date) on an item | L393-414 | WAREHOUSE-ONLY |
| IV.ADJ.15 | Reason required (5-25 chars) on every adjustment | L472-474 | KEEP |
| IV.ADJ.16 | Every adjustment logged to IVADJ under sequential id from CONTROL 'ADJ' attr 1: 1 date, 2 employee, 3 product, 4 qty, 5 amount, 6 reason+description, 7 store, 8 item, 9 old serial, 10 unit cost, 11 option | L67,L494-499 | KEEP |
| IV.ADJ.17 | Purge deletes IVADJ entries older than 90 days and records purge date | L422-445 | SIMPLIFY |

**Bugs / oddities:** L476 tests OPTION = 1 for value increase/decrease prompts but value adjustment is option 2; option 5 logs A(5)=COST computed only in sub 600; MONEY routine units unknown; IVADJ counter read with READVU then written separately (race).

## IV.INP.RETURNS

**Mode:** Interactive · **Lines:** 77 · **Relevance:** PRODUCT, VENDOR

Records member product returns (for auto-credits) in RETURNS and accumulates returned quantities by reason in VNRET for vendor return tracking.

**Files:** reads ARMST, IVMST, IVCAT, CONTROL ('RETURN') · writes RETURNS, VNRET, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.INP.RETURNS.01 | Return header: 1 member (must exist), 2 employee (not validated), 3 date, 4 member's return ref (default 'No-Ref-#') | L18-28,L57 | KEEP |
| IV.INP.RETURNS.02 | Product entered as product #, or UPC/catalog # resolved via IVCAT attr 1 | L33-36 | KEEP |
| IV.INP.RETURNS.03 | Quantity non-zero numeric; negative allowed only with confirmation (adjustment) | L38-44 | KEEP |
| IV.INP.RETURNS.04 | Reason code D = defective, P = packaging; lines in attrs 5 prod, 6 qty, 7 reason | L45-54 | KEEP |
| IV.INP.RETURNS.05 | Return number from CONTROL 'RETURN' attr 1, incremented | L58-64 | SIMPLIFY |
| IV.INP.RETURNS.06 | VNRET<product> attr 1 += defective qty, attr 2 += packaging qty (running totals, no date) | L65-73 | QUESTION |

**Bugs / oddities:** No credit is actually computed here despite "Auto-Credits" title; VNRET totals never reset/dated.

## IV.ORD.REC

**Mode:** Interactive · **Lines:** 360 · **Relevance:** PO, VENDOR, PRODUCT, PRICING

Vendor purchase-order menu (renamed IV6): enter POs (via IV46), auto-create POs from the ORDER suggestion file, and receive merchandise against IVPO/IVMST with landed cost, yen conversion and FIFO stock layers.

**Files:** reads IVMST, IVPO, ORDER, IVCAT, CONTROL ('YEN.CONV','ABO','BORUN','BATCH') · writes IVMST, IVPO, ORDER (CLEARFILE), RECLOG, POADJ, CONTROL ('BATCH','YEN.CONV'), PGM.AUDIT  
**Calls:** IVPO.ON.ORD, IV.UPD.COGS; EXECUTE RUN IVBP IV46; CHAIN RUN BP IV11.AUTO; INCLUDE UTLBP I_GETWHO

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.ORD.REC.01 | Option 1 (enter/change vendor orders) hands off to IV46 | L65 | KEEP |
| IV.ORD.REC.02 | Only one receiver at a time: CONTROL 'BATCH' attr 2 = 'O' while receiving; attr 1 = batch number, incremented when the receiver exits; operator told to record batch # | L67-86, L116-127 | SIMPLIFY |
| IV.ORD.REC.03 | PO number format: 5 digits, 1 letter + 5 digits, or 5 digits + 1 letter | L130-132 | QUESTION |
| IV.ORD.REC.04 | Receiving requires an existing IVPO record; receipt date MM.DD.YY, defaults to today, no future dates | L133-148 | KEEP |
| IV.ORD.REC.05 | Yen-to-dollar rate entered as whole number in hundredths (22505 = 225.05 yen/$); saved to CONTROL 'YEN.CONV' (date, rate); blank reuses last rate | L150-161 | KEEP |
| IV.ORD.REC.06 | Additional-charges % (freight/duty landed cost) entered in hundredths of a percent (1200 = 12%) per receiving session | L162-168 | KEEP |
| IV.ORD.REC.07 | Receiving by product number or catalog number via IVCAT | L192 | KEEP |
| IV.ORD.REC.08 | Product must carry the PO in IVMST attr 20 and be a line on IVPO attr 6; remaining qty = IVMST attr 21 (PO qty) + attr 23 (backorder qty); unit cost = attr 22 (cents, or yen with 'Y' suffix) | L198-207 | KEEP |
| IV.ORD.REC.09 | Over-receipt allowed after re-entering the quantity to confirm | L225-229 | QUESTION |
| IV.ORD.REC.10 | 'C' or '-' with "YES" cancels the remaining backorder: PO removed from the product's attr 20-23, POADJ log written (cancelled qty), IVPO ordered qty reset to received total, a 0 receipt appended | L213-218, L314-326 | KEEP |
| IV.ORD.REC.11 | Receipt ≥ remaining removes the PO from IVMST attrs 20-23; partial receipt blanks attr 21 and sets attr 23 (backorder) = remaining − received | L278-283 | KEEP |
| IV.ORD.REC.12 | Extended receipt cost TCST = cost × qty; yen cost converted INT(TCST/rate × 10000 + .5) into cents; landed TCST += INT(TCST × pct/10000 + .05) | L284-288 | KEEP |
| IV.ORD.REC.13 | Last cost IVMST LAST.COST (attr 28 per dict) = INT(TCST/qty + .5) | L289 | KEEP |
| IV.ORD.REC.14 | Stock layers: if first layer qty ≤ 0 (negative/zero stock), receipt nets into that layer, value = TCST − /neg qty × last cost/, layer deleted if it nets to 0; otherwise a new layer (qty, TCST, date) is appended | L290-300 | KEEP |
| IV.ORD.REC.15 | When receiving against negative stock, IV.UPD.COGS is called with the negative qty and unit cost to back out profit on prior shipments | L309-312 | QUESTION |
| IV.ORD.REC.16 | RECLOG<date*time*user*seq>: product, qty, amount, PO, batch, last cost | L302-305 | KEEP |
| IV.ORD.REC.17 | IVPO receipts kept as subvalues: attr 9 qty, attr 11 date, attr 12 cost; PO flagged complete (attr 13 = 1) when ordered − received = 0 for all lines | L187-189, L247-249, L307-308 | KEEP |
| IV.ORD.REC.18 | Automatic receiving receives every IVPO line in full at PO cost | L232-250 | KEEP |
| IV.ORD.REC.19 | Automatic PO creation: every product in ORDER file (qty attr 1, from IV21) is added to the PO — IVMST attr 20/21/22 (PO no., qty, cost = RAW attr 19) and IVPO header vendor = IVMST attr 5, date; ORDER is then cleared | L251-275 | QUESTION |
| IV.ORD.REC.20 | Automatic backorders: on exit, if CONTROL 'ABO' = 1 and something was received and the last BO run (CONTROL 'BORUN') is before today, chain to IV11.AUTO (forced if > 3 days since last run, else operator confirms "last receiving for today") | L88-108 | QUESTION |
| IV.ORD.REC.21 | Usage logged to PGM.AUDIT 'IV6' | L327-332 | SIMPLIFY |

**Bugs / oddities:** automatic PO creation uses RAW cost which may be yen and puts all ORDER products on one PO with the vendor of whichever product created the header (no per-vendor split). If the program aborts while receiving, CONTROL 'BATCH' stays 'O' and blocks all receiving. LOCATE(ORDER,M(20)) takes the first occurrence only. X computed and unused (L288). LAST.COST divides by Q (Q>0 guaranteed). DIM M(30) vs larger IVMST. Yen rate date only stored when a new rate is typed. Hard-coded 'IVBP-IV6' message.

## IV.ORD.REC.N

**Mode:** Test-variant · **Lines:** 523 · **Relevance:** PO, PRODUCT, PRICING

May 2012 rework of IV.ORD.REC with a full-screen line editor, customs entry number capture and decimal yen entry.

**Files:** same as IV.ORD.REC · writes same plus IVMST ENTRY.NO  
**Calls:** EDIT.LINE, IVPO.ON.ORD, IV.UPD.COGS; EXECUTE RUN IVBP IV46; CHAIN IV11.AUTO

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.ORD.REC.N.01 | A PO already flagged received in full (IVPO attr 13 = 1) cannot be received again | L166-169 | KEEP |
| IV.ORD.REC.N.02 | Customs/broker entry number required in format AA#-#######-# (e.g. RS3-1234567-1) or 'XXX' to bypass; stored on IVMST ENTRY.NO (attr 55 per dict) on every received product | L223-232, L400 | QUESTION |
| IV.ORD.REC.N.03 | Yen rate may be entered with 2 decimals (×100) or whole; always re-saved to CONTROL 'YEN.CONV' attr 2 | L200-208 | KEEP |
| IV.ORD.REC.N.04 | IVMST dimensioned to 360 attributes | L38 | KEEP |

**Bugs / oddities:** L206 updates the rate but not the rate date (attr 1). L208 turns YEN.CONV into a scalar, so the next PO's prompt re-reads. ENTRY.NO is product-level, overwritten by each receipt (no history per PO). Unclear whether this or IV.ORD.REC is the production program.

## IV.PI.COUNT

**Mode:** Interactive · **Lines:** 46 · **Relevance:** PRODUCT

Physical inventory count entry for warehouse scanners, logging counts per product and employee.

**Files:** reads IVMST, IVEMP, IVCAT, PHYSLOG · writes PHYSLOG  
**Calls:** SUMM; INCLUDE I_READ_IVCAT

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.PI.COUNT.01 | Employee number must be numeric and exist in IVEMP | L17-20 | WAREHOUSE-ONLY |
| IV.PI.COUNT.02 | Product resolved through IVCAT cross-reference; must exist in IVMST | L28-29 | WAREHOUSE-ONLY |
| IV.PI.COUNT.03 | Each count appends EMP to PHYSLOG<prod> attr 1 and QTY to attr 2 (counts accumulate); 'Q' shows current summed count | L31-44 | WAREHOUSE-ONLY |
| IV.PI.COUNT.04 | Count qty must be numeric and not > 1000 (string comparison) | L39-40 | QUESTION |

**Bugs / oddities:** QTY > '1000' compares as string/number ambiguously; READU ELSE PREC='' conflates locked and not-found (silent fallthrough). Lock held while waiting for operator input.

## IV.UPD.COGS

**Mode:** Subroutine · **Lines:** 101 · **Relevance:** PRODUCT, PRICING

When a product's on-hand goes negative, backs out profit already booked on the most recent billed shipments of that product (product YTD profit and member warehouse profit) using an average cost.

**Files:** reads SCANORD, IVMST, ARMST, CONTROL 'UPD' · writes IVMST, ARMST  
**Calls:** EXECUTE SSELECT SCANORD WITH BILLED AND WITH PROD = ... BY-DSND DATE.BILLED BY-DSND TIME.BILLED

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.COGS.01 | Called with QOH as a negative quantity; walk billed SCANORD shipments of the product newest first, consuming shipped qty until QOH reaches 0 (last shipment partially) | L9, L26-52 | QUESTION |
| IV.UPD.COGS.02 | For each consumed qty, subtract QUAN × AVG from IVMST YPROF (monthly profit bucket; equate IVMST.YPROF from FILE.INCLUDES not in extract, attr number unconfirmed) | L75 | QUESTION |
| IV.UPD.COGS.03 | Month bucket = CONTROL 'UPD' attr 2 (IVMON, current inventory month) − billed month, where billed month advances by 1 if billed day > 26 and month < 12; 0 → 1; negative → +13 | L71-74 | QUESTION |
| IV.UPD.COGS.04 | Subtract QUAN × AVG from member ARMST WH.PROFIT (attr 40 per dict) of the shipment's member | L83-96 | QUESTION |
| IV.UPD.COGS.05 | Waits (6-second sleep) on IVMST/ARMST locks indefinitely | L59-67, L84-92 | SIMPLIFY |

**Bugs / oddities:** "IF MON = 0 THEN MON = 1" collapses current month and previous month; "+13" wrap implies 13 buckets — confirm. SLEEP 1 per update and debug CRT left in. Error message on open failure always says SCANORD. AVG units (cents?) not stated by caller.

## IV.UPD.PLOG

**Mode:** Batch · **Lines:** 89 · **Relevance:** PRODUCT, PRICING

Posts physical inventory counts (PHYSLOG) to IVMST stock cost layers and logs adjustments to IVADJ.

**Files:** reads PHYSLOG, IVMST · writes IVMST, IVADJ, PHYSLOG (attr 5 UPD flag)  
**Calls:** EXECUTE SSELECT PHYSLOG WITH NO UPD BY PROD

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.PLOG.01 | Operator must enter alphabetic initials (recorded as adjustment employee) | L21-25 | KEEP |
| IV.UPD.PLOG.02 | Only PHYSLOG records not yet updated (attr 5 UPD empty) processed; counted qty = SUM(PHYSLOG attr 2); book qty = SUM(IVMST attr 24 stock layers) | L27, L33 | WAREHOUSE-ONLY |
| IV.UPD.PLOG.03 | Stock is held as FIFO-style layers: IVMST attr 24 qty, attr 25 value (cents, AMT.REC), attr 26 date received | L57-58, L65-70 | KEEP |
| IV.UPD.PLOG.04 | Average unit cost = SUM(attr 25)/SUM(attr 24); if book stock 0 use attr 19 RAW cost | L36-40 | QUESTION |
| IV.UPD.PLOG.05 | Count > book: add a new layer qty DIFF, value INT(AVG×DIFF+.5), dated today | L56-61 | KEEP |
| IV.UPD.PLOG.06 | Count < book: remove qty from oldest layers first; partially consumed layer revalued at STK×AVG | L62-76 | KEEP |
| IV.UPD.PLOG.07 | IVADJ record (key date+time*seq): emp, product, qty change, value change, reason "PI Adjustments - <date>" + before/after text; PHYSLOG attr 5 set to 1 | L48, L77-88 | KEEP |

**Bugs / oddities:** raw cost attr 19 may carry a 'Y' yen suffix — used as AVG unconverted. Divide-by-zero impossible but negative book stock gives negative AVG. Remaining layer revalued at overall average rather than its own cost (fixed in .TST). PHYSLOG UPD written even when DIFF=0 (ok) but IVADJ only on change. MATREADU THEN with no ELSE/LOCKED — locked records block.

## IV.UPD.PLOG.TST

**Mode:** Test-variant · **Lines:** 101 · **Relevance:** PRODUCT, PRICING

Later (2012) version of IV.UPD.PLOG run against IVMST.TEMP / IVADJ.TEMP using saved list PLOG.

**Files:** reads PHYSLOG, IVMST.TEMP · writes IVMST.TEMP, IVADJ.TEMP (CLEARFILE), PHYSLOG  
**Calls:** EXECUTE GET-LIST PLOG

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.PLOG.TST.01 | Count > book with existing layers: add DIFF to the first (oldest) layer at that layer's own unit cost, instead of a new layer | L61-69 | QUESTION |
| IV.UPD.PLOG.TST.02 | Count < book: value removed/revalued at each layer's own cost (VAL/QTY), not average | L73-85 | KEEP |
| IV.UPD.PLOG.TST.03 | IVADJ description values divided by 100 (cents → dollars); totals of qty and value adjusted displayed | L94-96, L56 | KEEP |
| IV.UPD.PLOG.TST.04 | Clears the adjustment file before run | L28 | QUESTION |

**Bugs / oddities:** works on .TEMP files — test copy; confirm whether production IV.UPD.PLOG ever received these fixes. Layer with QTY=0 gives divide-by-zero at L66/L76.

## IV13

**Mode:** Utility/maintenance · **Lines:** 25 · **Relevance:** PRODUCT

Rebuild IVMST member-order requirement (attr 3 REQ) from open member orders in IVORD.

**Files:** reads IVMST, IVORD · writes IVMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV13.01 | Zero IVMST attr 3 (REQ = member quantity on order) for every product, then for each IVORD order add each line qty (IVORD attr 3) to IVMST attr 3 of the line product (IVORD attr 2) | L8-22 | SIMPLIFY |
| IV13.02 | Maximum 300 lines per order processed; message says "OVER 200 ITEMS" | L17, L23 | QUESTION |

**Bugs / oddities:** FILELOCK ... LOCKED only prints a message, does not wait or stop. Message at L23 says 200 but loop is 300. Products missing from IVMST are skipped silently aside from a print. Rebuild is not atomic with order entry.

## IV17

**Mode:** Utility/maintenance · **Lines:** 18 · **Relevance:** PO

Rewrites IVMST dictionary I-descriptor formulas QR (quantity to reorder) and SUPPLY (months of supply) for an entered months-of-supply target, then compiles the dictionary.

**Files:** reads DICT IVMST · writes DICT IVMST  
**Calls:** EXECUTE 'CD IVMST QR SUPPLY'

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV17.01 | Elapsed-period divisor D = (current month − 1) concatenated with INT(day/3+.5) — intended as months elapsed with a fractional tenth | L8-9 | QUESTION |
| IV17.02 | QR = INT(((REQ+YTDORD)*10/D) * M/10 − (STOCK+ORDERED−REQ)) where M = target months of supply ×10 (entered as M.M) | L10-14 | KEEP |
| IV17.03 | SUPPLY = (STOCK+ORDERED−REQ)*10 / ((REQ+YTDORD)*10/D), 0 if no demand | L15-16 | KEEP |

**Bugs / oddities:** D is a string concatenation (e.g. month 3 day 15 → "25") rather than an arithmetic months value; in January D starts with "0". Rewriting shared dictionary items makes the result global for all users.

## IV19

**Mode:** Interactive · **Lines:** 35 · **Relevance:** PO, PRODUCT

Displays outstanding vendor purchase orders stored on a product record.

**Files:** reads IVMST · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV19.01 | Open POs for a product are the parallel multivalues IVMST attr 20 PO.NO, attr 21 PO.QTY, attr 22 PO.CST (cents), attr 23 used as PO date (dict names attr 23 BO/PO.BO) | L19-24 | QUESTION |
| IV19.02 | A PO cost suffixed 'Y' denotes yen; total = numeric part × qty with 'Y' re-appended | L25 | QUESTION |

**Bugs / oddities:** attr 23 is treated as a date here but the dictionary labels it backorder qty — confirm. Mixed-currency costs stored in the same field with a 'Y' suffix.

## IV20

**Mode:** Report/print · **Lines:** 53 · **Relevance:** PO, VENDOR

Prints a purchase order document for a PO number from the products in an active select list.

**Files:** reads IVMST · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV20.01 | PO lines found by locating PO number in IVMST attr 20 and taking qty attr 21 and unit cost attr 22 (cents, MD2) at the same position; total = cost × qty | L29-42 | KEEP |
| IV20.02 | Yen costs ('Y' suffix) print with 'Y' and grand total is marked 'Y' if any line was yen | L39-41, L46 | QUESTION |
| IV20.03 | Hard-coded letterhead "PHOTOGRAPHIC RESEARCH ORGANIZATION, 360 Tunxis Hill Rd, PO Box 320236, Fairfield CT 06432, 203-336-0183" | L20-25 | OBSOLETE |

**Bugs / oddities:** YEN flag is set per line (L40) — only the last line's yen status drives the grand-total format, and yen and dollar amounts are summed together into GTOT. Relies on a pre-built select list (no vendor filter in program).

## IV21

**Mode:** Batch · **Lines:** 70 · **Relevance:** PO, PRODUCT

Calculates a tentative reorder quantity per product for a product group/sub-group and writes it to ORDER.

**Files:** reads IVMST · writes ORDER  
**Calls:** EXECUTE SSELECT IVMST WITH GRP/SUB, EXECUTE DHPRT

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV21.01 | Current month MON = this month, minus 1 if day < 20 (Jan→12); FMON = 12 − MON remaining months | L6-10 | QUESTION |
| IV21.02 | Products with attr 15 STATUS > 0 (suspended) are skipped | L26 | KEEP |
| IV21.03 | Available = SUM(attr 21 PO qty) + SUM(attr 24 stock) − attr 3 REQ | L29 | KEEP |
| IV21.04 | Prior-year average PAVG from attr 18 (MPYR) first MON months over non-empty months; current average CAVG from attr 17 (MORD) | L28-38 | KEEP |
| IV21.05 | If no prior-year sales in period: qty = CAVG × months − available; else trend PCT = CAVG/PAVG capped at 2, qty = INT(PFUT×PCT/FMON)×months − available, floored at CAVG×months − available | L42-49 | KEEP |
| IV21.06 | Quantities under 100 round to nearest 12 for group 8 (bags) else 10 | L51-53 | QUESTION |
| IV21.07 | Group 19 (filters) with qty < 30: multiply by (12 − months) if months < 12, zero if below CAVG, cap at 50 | L54-58 | QUESTION |
| IV21.08 | Qty ≥ 100 rounds to case pack attr 2 (default 10 when blank); group 19 uses double case; if > 2 cases round to case | L61-65 | QUESTION |
| IV21.09 | Quantities under 10 are not written; otherwise ORDER<product> attr 1 = qty | L67-68 | QUESTION |
| IV21.10 | Hard-coded group menu: LENSES=1, FLASH=4, MODULES=5, BAGS=8, STRAPS=9, TRIPODS=10, FILTERS=19, FILM=20 | L15-16 | QUESTION |

**Bugs / oddities:** attr 2 is ORD.QTY/QO in dict but used as case quantity — confirm. L36-37 CMOS logic: the L37 IF/ELSE always overwrites L36's result. PCT = CAVG/PAVG divides by zero when PAVG=0 but PREV ≥ 1 is impossible only if PMOS>0; ok. Debug PRINTs left in.

## IV45

**Mode:** Report/print · **Lines:** 247 · **Relevance:** PO, VENDOR, PRICING

Displays or prints vendor purchase orders from IVPO with vendor address, bill-to/ship-to, terms, instructions and priced lines.

**Files:** reads IVMST, IVPO, APMST, VNMST, CONTROL ('WHO','P.ON','P.OFF','EOP.CLAUSE'), CUSTOM, IVEMP · writes none  
**Calls:** P.ASSIGN.SUB; INCLUDE UTLBP I_PRINTER; EXECUTE RESETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV45.01 | Vendor address from IVPO attr 17 for vendor 9999, else APMST then VNMST record of IVPO attr 1 | L88-97 | QUESTION |
| IV45.02 | If the vendor record attr 21 (dealer/account no. PRO holds with the vendor) is set, "DEALER NO. <ref>" heads the Bill-To block (PRO address from CONTROL 'WHO' attrs 2-5, fax attr 7) | L98-107 | KEEP |
| IV45.03 | Terms printed from IVPO attr 3, else vendor attr 9 % + attr 10 ("DAYS" or "OF THE MONTH") | L162-168 | KEEP |
| IV45.04 | Line unit cost = IVMST attr 38 (PO.COST) when non-blank, overriding the IVPO line cost attr 8; yen costs ('Y') printed unconverted | L208-216 | QUESTION |
| IV45.05 | Line description from IVPO attr 15 (special order desc) else IVMST attr 4; catalog no. IVMST attr 30 else product no. | L189-195 | KEEP |
| IV45.06 | Up to 15 special-instruction lines (IVPO attr 4) printed | L173-182 | KEEP |
| IV45.07 | Employee who placed PO (IVPO attr 22, name IVEMP attr 5) printed when CUSTOM flag 19 on | L231-235 | QUESTION |
| IV45.08 | Hard-coded ship-to "PRO Warehouse Facility, 2950 Turnpike Drive, Building Section 6-9, Hatboro PA 19040" | L13-16, L239-240 | QUESTION |

**Bugs / oddities:** printed cost can differ from the PO's stored cost because IVMST attr 38 overrides it (comment 10-09-03). Yen and dollar extended costs summed into one total marked 'Y'. EOP.CLAUSE is read (CUSTOM flag 25) but never printed. Secondary vendor name read from APMST only.

## IV46

**Mode:** Interactive · **Lines:** 311 · **Relevance:** PO, VENDOR

Manual purchase-order header entry/maintenance (PO number, date, vendor, terms, special instructions), handing line entry to IV46.PROD.

**Files:** reads PROMPTS, SCREENS, APMST, VNMST, APCOD, CONTROL ('WHO','IVPO'), IVCAT, IVMST, TREES, IVPO, IVSPORD, THROWAYS, CUSTOM, IVEMP · writes IVPO (via IV46.PROD), CONTROL 'IVPO'  
**Calls:** IV46.9999, IV46.PROD, IDATE, EDIT.LINE, DSP.REPORT; EXECUTE SORT IVPO

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV46.01 | 'A' generates a new PO number from CONTROL 'IVPO' (default 1000), skipping numbers already on IVPO; counter = number + 1 | L86-98 | KEEP |
| IV46.02 | Existing PO numbers must be 3-7 characters with no spaces | L99-104 | QUESTION |
| IV46.03 | 'LIST <vendor>' shows open POs (IVPO RECV ≠ 1) for a vendor with date and total cost | L80-84, L190-205 | KEEP |
| IV46.04 | PO fully received (IVPO attr 13 = 1) cannot be changed; partially received (attr 11 receipts present) requires confirmation | L140-149 | KEEP |
| IV46.05 | PO date validated by IDATE with no past limit and up to 15 days in the future (PAST='', FUTURE=15) | L50, L153-158 | QUESTION |
| IV46.06 | Vendor number looked up first in APMST (AP vendor), then VNMST (PRO vendor); stored in IVPO attr 1 value 1 | L180-186, L215 | QUESTION |
| IV46.07 | Default PO terms (IVPO attr 3): from APMST attr 9 (%) + attr 10, or from VNMST attr 8 + '%' | L216-222 | QUESTION |
| IV46.08 | Hard-coded vendor 9999 = miscellaneous/one-time vendor; name and details captured in IVPO attr 17 via IV46.9999 | L126-127, L151, L207-210 | QUESTION |
| IV46.09 | Special instructions: up to 15 lines × 70 chars in IVPO attr 4; terms editable (35 chars) | L254-286 | KEEP |
| IV46.10 | If CUSTOM<WHO> attr 3 value 19 is set, the employee number (IVEMP) is captured into IVPO attr 22 | L294-302 | QUESTION |
| IV46.11 | Secondary vendor (SVND) logic entirely commented out | L226-252 | OBSOLETE |

**Bugs / oddities:** L129 typo READV PAPAME then re-reads into PVNAME (works by accident). VNMST attr 8 is the surcharge %, so VNMST-vendor POs get the surcharge rate as payment terms. IVEMP is never opened (L45 commented) but used at L296 when CUSTOM flag 19 is on. Vendor number space shared between APMST and VNMST — same number could mean two different vendors.

## IV46.DSCR

**Mode:** Subroutine · **Lines:** 16 · **Relevance:** PO, VENDOR

Paints the IV46 PO entry screen header (PO number, PO date, primary and second vendor).

**Files:** reads SCREENS · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV46.DSCR.01 | Screen layout only; displays ORDER, PO.DATE, PVND/PVNAME, SVND/SVNAME from common | L6-15 | OBSOLETE |

## IV46.PROD

**Mode:** Subroutine · **Lines:** 1003 · **Relevance:** PO, PRODUCT, PRICING, VENDOR

Multi-line PO line entry (product, qty, unit cost) for IV46; on update rewrites IVPO and the PO arrays on each IVMST product; supports special-order products.

**Files:** reads PROMPTS, SCREENS, IVMST, IVCAT, IVSPORD, ARMST, IVCUST, CONTROL 'SPORD' · writes IVPO, IVMST (attrs 19-23), IVSPORD, CONTROL 'SPORD'  
**Calls:** DRAW.BOX, SUMM, MONEY, IDATE, IV46.SPORD (unreachable)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV46.PROD.01 | Lines cannot be deleted once the PO is partially received (IVPO attr 11 non-empty) | L91-93, L462-466, L830-832 | KEEP |
| IV46.PROD.02 | Product entry resolves catalog numbers via IVCAT; numeric products < 1000 rejected | L689-690, L692, L742 | QUESTION |
| IV46.PROD.03 | Hard-coded product 555 = special-order placeholder: operator enters an IVSPORD number; line takes IVSPORD product attr 1, qty attr 3, cost attr 6, desc attr 2, ext sale attr 12; IVSPORD attr 4 set to the PO (must be blank or this PO) and ship-to name/address filled from ARMST (attr 3/4-6) or IVCUST | L693-739 | QUESTION |
| IV46.PROD.04 | Product prefixed or suffixed '*' = tracked special order: new special-order number from CONTROL 'SPORD' (default 1000, skip existing) stored in IVPO attr 18 | L680-688, L779-789 | QUESTION |
| IV46.PROD.05 | Product not on IVMST may be entered as a special order (new SPORD number in IVPO attr 14) | L791-807 | QUESTION |
| IV46.PROD.06 | Warn if product's IVMST vendor (attr 5) ≠ PO vendor unless vendor 9999; operator may confirm or Ignore all | L766-778 | KEEP |
| IV46.PROD.07 | Warn if product already on this PO | L810-817 | KEEP |
| IV46.PROD.08 | Qty 0 deletes the line (unless partially received); qty cannot be reduced below received qty; multiple-of check uses hard-coded OQ=1 (effectively off) | L829-875 | QUESTION |
| IV46.PROD.09 | 'C' at qty lets the operator change unit cost; unit cost entered as money (cents) or yen with 'Y' suffix | L846-852, L876-884 | KEEP |
| IV46.PROD.10 | Default unit cost = IVMST attr 19 RAW cost | L900-903 | KEEP |
| IV46.PROD.11 | When unit cost differs from IVMST raw cost, operator may push the new cost to IVMST attr 19; restored to original if operator exits without update | L187-210, L253-260 | QUESTION |
| IV46.PROD.12 | PO value = Σ qty × unit cost; any yen line marks total 'Y' | L366-379 | QUESTION |
| IV46.PROD.13 | Update rebuild: for each line with open qty (ordered − Σ received subvalues) or changed qty/cost, IVMST attr 20 PO no., attr 22 cost; if PO partially received remaining qty goes to attr 23 (backorder) with attr 21 blank, else attr 21 = qty; entry removed when both 0; deleted lines removed from IVMST | L277-364 | KEEP |
| IV46.PROD.14 | Update with no product lines deletes the IVPO record | L114-124 | KEEP |

**Bugs / oddities:** vendor-mismatch message prints R(12) (surcharge %) instead of R(5) vendor (L771). Products not found in IVMST are redirected to IVMST record '555' (L285-287, L310) so PO arrays get written onto product 555. ARMST and IVCUST are not opened by IV46 (commented) but used in the 555 path. POST ENTRY (L957-965) is an empty CASE, so IV46.SPORD (L710-989) is unreachable. Yen and dollar values are summed together in the PO value.

## IV52

**Mode:** Interactive · **Lines:** 787 · **Relevance:** PO, PRODUCT, PRICING

Generic Computyme retail-package receiving from IVPO with multi-store stock, serialized item numbers (IVINV/IVNEW), labels, and special-order customer distribution (2000).

**Files:** reads IVMST, IVPO, IVSPORD, IVCAT, APMST, SCREENS, CONTROL ('WHSE','STORES','STRS','PHYS','SYSTEM','WHO','IV','IV.REC.<user>','RECLOG'), CUSTOM, ARMST, IVPHYS/IVINV/IVSOLD/IVNEW/IVCUST (not opened) · writes IVPO, IVMST, IVSPORD, IVINV, IVNEW, RECLOG, CONTROL  
**Calls:** MONEY; INCLUDE UTLBP I_GETWHO

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV52.01 | Single receiver lock via CONTROL 'IV' attr 5 (override by typing OVERRIDE); multi-receiving (CUSTOM flag 24) uses per-user control record; attr 4 > 1 forces labels/receiving report to be printed first | L63-97 | OBSOLETE |
| IV52.02 | Receipt cost = lower of PO cost and IVMST attr 8 (or attr 7) unless CUSTOM flag 14 (always use PO cost) or product 555 | L274-277 | QUESTION |
| IV52.03 | Receiving options: entire PO, exclude backorder products, receive specific with/without prompting; qty > ordered or > 100 needs confirmation; max 9999 | L170-370 | OBSOLETE |
| IV52.04 | Cost change on receipt warns if above sale price (special-order average unit sale or IVMST attr 6) | L329-359 | OBSOLETE |
| IV52.05 | Serialized item numbers from CONTROL 'IV' attr 2 stepping by 7, skipping IDs used in IVMST/IVCAT/IVINV/IVSOLD, wrapping at 999999 | L627-651 | OBSOLETE |
| IV52.06 | Special-order receipts distributed to customers; explode into individual items optional (forced by product type), > 25 requires typing EXP | L418-541 | OBSOLETE |
| IV52.07 | Hard-coded product 555 = special-order bucket; products 500-599 carry their own description/cost on the item | L140, L586-590, L720-771 | QUESTION |
| IV52.08 | RECLOG keyed date*time*user*seq (seq from CONTROL 'RECLOG', default 1000) with product, qty, ext cost, items, store, PO | L773-786 | OBSOLETE |

**Bugs / oddities:** written for a different IVMST layout (attr 15/19 per-store stock, 17/18 qty/value, PO in attrs 28-30, description attr 3) — incompatible with PRO's layout (PO in 20-23, stock layers 24-26); running it would corrupt PRO product records (e.g. overwrite attr 1 with 1, add to RAW cost attr 19). IVNEW, IVINV, IVSOLD, IVPHYS, IVCUST are used but never opened. Treat as dead legacy code superseded by IV.ORD.REC.

## IV54

**Mode:** Interactive · **Lines:** 116 · **Relevance:** PO, VENDOR

Cancel (delete) an open, unreceived purchase order, removing it from products and deleting attached special orders.

**Files:** reads IVPO, IVMST, IVINV, APMST, IVSPORD, CONTROL · writes IVMST, IVSPORD (delete), IVPO (delete)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV54.01 | PO that is fully received (IVPO attr 13) or partially received (attr 9 present) cannot be cancelled | L59-66, L79-82 | KEEP |
| IV54.02 | Gross value shown = Σ qty (attr 7) × cost (attr 8), cents | L74-78 | KEEP |
| IV54.03 | On cancel, special orders listed in IVPO attr 14 are deleted from IVSPORD and the IVPO record deleted | L107-111 | QUESTION |
| IV54.04 | Products missing from IVMST are redirected to hard-coded product record 555 | L93-98 | QUESTION |

**Bugs / oddities:** uses an obsolete IVMST layout — PO number/qty/backorder equated to IVMST attrs 28/29/30 (dict: LAST.COST, UPC, CAT.NO) and description to attr 3, whereas current code keeps POs in attrs 20-23. The LOCATE will normally fail, leaving the cancelled PO on the products (IVMST attrs 20-23) as phantom on-order quantity; if it ever matches it would delete last cost/UPC/catalog values. Likely dead/broken; IV.ORD.REC's cancel-backorder is the working path. Allows a "PO not on file" path that still proceeds.

## IV56

**Mode:** Interactive · **Lines:** 199 · **Relevance:** PO, PRODUCT

Cancel remaining backorder quantities on a vendor PO, either all lines or selected products (modified for PRO IVMST fields in 2003).

**Files:** reads IVMST, IVPO, IVCAT, APMST, SCREENS, CONTROL · writes IVMST, IVPO  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV56.01 | Option 1 lists all lines with open backorder (ordered − Σ received) and cancels all after confirmation; option 2 cancels chosen products (product or catalog no. via IVMST/IVCAT) | L59-98, L167-198 | KEEP |
| IV56.02 | Cancelling a line sets IVPO received qty attr 9 = ordered qty attr 7 (cancellation recorded as received, no POADJ log) | L115 | QUESTION |
| IV56.03 | IVMST open PO qty recomputed per product across PO lines: remaining > 0 → attr 21 (if PO never received, attr 11 empty) or attr 23 (backorder); 0 → PO removed from attrs 20-23 | L118-139 | KEEP |
| IV56.04 | PO complete flag attr 13 = 1 when every line ordered ≤ received, else 0 | L145-154 | KEEP |
| IV56.05 | Lines with a special-order description (IVPO attr 15) are applied to hard-coded product record 555 | L101, L183 | QUESTION |

**Bugs / oddities:** L128 checks PO(11) (receipt dates) for the whole PO, not per line. Unlike IV.ORD.REC's cancel, no POADJ audit trail. QR left from a previous PO can trigger "CANCELLATION ABANDONED" text.

## IV6

**Mode:** Test-variant · **Lines:** 312 · **Relevance:** PO, PRICING

Jan 2007 predecessor of IV.ORD.REC (PO ordering/receiving menu).

**Files:** reads IVMST, IVPO, ORDER, IVCAT, CONTROL · writes IVMST, IVPO, ORDER, RECLOG, POADJ, CONTROL, PGM.AUDIT  
**Calls:** IVPO.ON.ORD; EXECUTE RUN IVBP IV46; CHAIN IV11.AUTO

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV6.01 | PO number must be 5 digits or 5 digits + letter (no leading-letter form) | L118-120 | OBSOLETE |
| IV6.02 | Receipt into a zero/negative first stock layer simply adds qty and TCST to that layer (no last-cost netting, no COGS correction, no LAST.COST update) | L274-283 | OBSOLETE |

**Bugs / oddities:** MATREADU ... LOCKED LCK=1 ELSE (L180) handles locks but L228/L249 MATREADU THEN with no LOCKED/ELSE block silently. Superseded.

## IV6.PO

**Mode:** Test-variant · **Lines:** 182 · **Relevance:** PO, PRICING

2002 earlier version of IV6 with manual PO creation product-by-product.

**Files:** reads IVMST, IVPO, ORDER, RECLOG · writes IVMST, IVPO, ORDER (CLEARFILE), RECLOG  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV6.PO.01 | Manual PO line: IVMST attr 20 PO no., 21 qty, 22 cost = RAW attr 19 (no longer entered/confirmed), attr 23 = PO date; a product cannot be added twice to the same PO | L75-95 | QUESTION |
| IV6.PO.02 | Manual receipt cannot exceed the ordered qty | L104-106 | OBSOLETE |
| IV6.PO.03 | Auto PO creation accumulates IVPO attr 12 as running extended cost (Q × raw cost), 'Y' suffix if yen | L173-176 | OBSOLETE |

**Bugs / oddities:** file variable MST used at L119/L131/L145/L166/L178 but the file is opened as IVMST — program would fail at runtime. PO complete test sums attr 11 (dates) against attr 7 qty (L155). Auto-receipt logs ID (unset) instead of PROD (L146). Shows attr 23 was historically the PO date (as IV19 still assumes) while current receiving treats it as backorder qty.

## IV7

**Mode:** Interactive · **Lines:** 222 · **Relevance:** PRODUCT, PRICING, PO

Manual inventory adjustments to a product's stock layers (quantity) or total stock value, logged to IVADJ with a reason.

**Files:** reads IVMST, IVPO · writes IVMST, IVADJ  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV7.01 | Operator must enter non-numeric initials | L21-24 | KEEP |
| IV7.02 | Locked product waits up to 120 seconds then asks for another product | L28-39 | SIMPLIFY |
| IV7.03 | Option 1 (adjust vendor-order qty/raw cost on IVMST attr 20-23) disabled since 7-7-03 ("NOT NOW") | L5, L48-49, L90-113, L177-190 | OBSOLETE |
| IV7.04 | Option 2: change quantity of an individual stock layer (attr 24); layer value attr 25 re-prorated = INT(old value / old qty × new qty + .5) | L114-134, L171-176 | KEEP |
| IV7.05 | Option 3: set total stock value (cents, no decimals): all layers collapse to one layer (qty = total, value = entered, date = today) | L135-146 | QUESTION |
| IV7.06 | Reason required, 5-25 chars, upper-cased, defaults to last reason | L209-221 | KEEP |
| IV7.07 | On save, suspended-product status recalculated (3 when PO+BO+stock+REQ = 0; 2 when PO+BO+stock = 0 and REQ ≠ 0); zero-qty PO entries and zero-qty stock layers removed | L53-74 | KEEP |
| IV7.08 | IVADJ record keyed DATE():TIME(): emp, product, qty change, value change, reason + description | L191-208 | KEEP |

**Bugs / oddities:** IVADJ key has no sequence — two adjustments in the same second overwrite (IV.UPD.PLOG adds *SEQ). READU lock taken on IVADJ key ID (product) but write is to AID. Division by zero if a layer has qty 0 (L173). Reason prompt for option 2 only reached via <RETURN> at the line prompt.

## IVPO.ON.ORD

**Mode:** Subroutine · **Lines:** 7 · **Relevance:** PO

Computes open (still on order) quantity per PO line.

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IVPO.ON.ORD.01 | For each value I: on-order = QO<1,I> − SUM(QR<1,I>) (ordered minus all received sub-values) | L2-5 | KEEP |

## I_BLD.MEQHIST

**Mode:** Subroutine · **Lines:** 32 · **Relevance:** none

Include routine for IV.PI.MEQ and IV.TRAN.MEQ that archives the current MEQDATA (hand-held scanner/MEQ transfer) records into MEQHIST and purges old history.

**Files:** reads MEQHIST, MEQDATA · writes MEQHIST (write/delete)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_BLD.MEQHIST.01 | MEQHIST entries whose key date (first '*' field, internal date) is older than TODAY-30 are deleted (30-day retention) | L5-16 | WAREHOUSE-ONLY |
| I_BLD.MEQHIST.02 | Header record MEQDATA 'RECS' (default '0,0') holds the record count in its 2nd comma field; it is copied to MEQHIST key TODAY*TIME*RECS, then each MEQDATA record 1..RECS is copied to MEQHIST key TODAY*TIME*n | L17-31 | WAREHOUSE-ONLY |

**Bugs / oddities:** READVU locks taken at L20/L28 are never explicitly released before WRITE (WRITE releases). Records read with ELSE REC='' are still written to history as empty records.

## I_IV46_COMMON

**Mode:** Subroutine · **Lines:** 29 · **Relevance:** PO

COMMON/EQU include for the IV46 PO programs: a 50-slot FILES() array plus PO header globals (ORDER, PO.DATE, PVND/PVNAME = PRO vendor, SVND/SVNAME = ship/secondary vendor).

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_IV46_COMMON.01 | PO header context carried in COMMON: PO number, PO date, primary vendor number+name and second vendor number+name (SVND purpose not stated here) | L2 | QUESTION |
| I_IV46_COMMON.02 | Fixed file-handle slot map (FILES(1..23): PROMPTS, SCREENS, APMST, ARMST, CONTROL, CUSTIDX, IVCAT, IVCUST, IVEMP, IVINV, IVSOLD, IVMST, THROWAYS, ZIPPREF, TERMINALS, APIDX, TREES, IVORD, IVPO, IVNEW, IVSPORD) | L7-29 | OBSOLETE |

## I_MEQ.ERROR

**Mode:** Report/print · **Lines:** 95 · **Relevance:** PRODUCT

Include used by IV.MEQ.ERRORS, IV.PI.MEQ, IV.TRAN.MEQ to print/display MEQ (scanner transfer) errors and purge old error lists.

**Files:** reads IVINV, IVMST, IVCAT, ERROR · writes ERROR (delete)  
**Calls:** FOLD

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_MEQ.ERROR.01 | Error report lists Emp, Store, Seq, Product, Qty, message and the prior record's product + description (IVINV attr 6 description, else IVMST attr 3 — attr 3 per D_IVMST is REQ, so "attr 3 (purpose unclear)" used as description) | L13-38 | WAREHOUSE-ONLY |
| I_MEQ.ERROR.02 | Catalog-number resolution fallback: look up IVCAT with full product; if length < 10 use as is; else try substrings [2,10], [2,12], [1,10], [1,11]; else use raw value | L69-82 | SIMPLIFY |
| I_MEQ.ERROR.03 | ERROR file entries are purged when the date in the 4th '.'-field of the key + 185 days < today (comment at L5 says 120 days) | L83-94 | QUESTION |

**Bugs / oddities:** header comment says purge over 120 days, code and message use 185 days. READU ... ELSE NULL then DELETE (lock failure ignored). Description read from IVMST attr 3, which the dictionary names REQ, not DESC (attr 4) — possible wrong attribute.

## LOOKUP

**Mode:** Interactive · **Lines:** 15 · **Relevance:** PRODUCT

Operator looks up a lens part number in PARTS and sees its description (attr 2) and bin location (attr 1).

**Files:** reads PARTS · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| LOOKUP.01 | PARTS record: attr 1 = location, attr 2 = description (lens parts) | L12-13 | WAREHOUSE-ONLY |

## PO.DISC

**Mode:** Batch · **Lines:** 135 · **Relevance:** PO, PRODUCT, PRICING

Reconciles open purchase orders between IVPO (PO file) and the PO multivalues on IVMST (attrs 20-23), adding missing open POs to IVMST and removing fully received or orphaned POs, printing each discrepancy.

**Files:** reads IVPO, IVMST, IVSPORD (ERROR opened unused) · writes IVMST attrs 20 PO.NUM, 21 PO.QTY, 22 PO.CST, 23 PO.BO  
**Calls:** SUMM (subroutine); EXECUTE SSELECT IVPO, SSELECT IVMST

| ID | Rule | Source | Tag |
|---|---|---|---|
| PO.DISC.01 | IVPO line is open when qty ordered (IVPO attr 7) > total received (sum of IVPO attr 9 subvalues via SUMM) | L28-29 | KEEP |
| PO.DISC.02 | Open IVPO line whose PO # is not in IVMST attr 20 is appended to IVMST: PO # -> attr 20, PO cost (IVPO attr 8, cents) -> attr 22 (PO.CST, added 01-09-12) | L37-39,98-102 | KEEP |
| PO.DISC.03 | If nothing received yet (IVPO attr 9 blank): IVMST attr 21 = qty ordered, attr 23 = blank; if partially received: attr 21 = blank and attr 23 (backorder) = ordered - received | L100-110 | QUESTION |
| PO.DISC.04 | Product on IVPO not in IVMST but whose IVPO attr 14 special-order id exists in IVSPORD is booked against hard-coded catch-all product 555 | L42-48 | QUESTION |
| PO.DISC.05 | IVPO product found in neither IVMST nor IVSPORD is only reported ("NOT FOUND ON IVMST OR IVSPORD"), no fix | L51 | KEEP |
| PO.DISC.06 | Pass 2: for every IVMST PO entry, delete it (attrs 20-23 at that position) if PO not on IVPO, if product not on that PO and no IVSPORD record, or if received >= ordered | L74-90,115-121 | KEEP |
| PO.DISC.07 | Waits indefinitely (5s sleep loop) on locked IVMST records rather than skipping | L30-35,65-70 | SIMPLIFY |

**Bugs / oddities:** PO open-qty stored in attr 21 or attr 23 depending on receipt state (inconsistent semantics for downstream readers). Pass 2 for special-order/product-555 path uses PRODS(14)<1,I> where I is the IVMST PO index, not the IVPO line, and WHERE is stale when LOCATE fails (L82-89). Product 555 read with MATREAD (no lock) then MATWRITE (L45, L112). Label 170 is dead code. MATWRITEU at L120 holds locks until RELEASE.

## UPD.IVMST.QREC

**Mode:** Utility/maintenance · **Lines:** 43 · **Relevance:** PRODUCT

One-off 2008 fix-up that folds the physical-inventory (PLOG) adjustment receipt layers dated on PI days into the preceding (older) receiving layer in IVMST.

**Files:** reads IVMST · writes IVMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.IVMST.QREC.01 | Hard-coded physical inventory dates 01/03/08, 01/03/07, 01/04/06, 01/04/05 | L7-10 | OBSOLETE |
| UPD.IVMST.QREC.02 | When a receipt layer has DATE.REC (attr 26) equal to a PI date and is not the first layer, its QTY.REC (attr 24) and AMT.REC (attr 25) are added to the previous layer and the layer is deleted. Inventory cost layers therefore treat PI adjustments as part of the earlier receipt. | L29-39 | OBSOLETE |

**Bugs / oddities:** SELECT is commented out, so it needs an active select list. MATREADU has no ELSE/LOCKED, so it blocks on a lock.

## WH.DATA

**Mode:** Interactive · **Lines:** 309 · **Relevance:** PRODUCT

Warehouse product maintenance screen for case qty, carton qty, weight, dimensions and primary/secondary bin locations on IVMST, with a field-level change log to IVMST.LOG.

**Files:** reads IVCAT, IVMST, IVMST.DISC, SCREENS ('WH.DATA','WH.DATA.PRMTS') · writes IVMST, IVMST.LOG  
**Calls:** EDIT.LINE

| ID | Rule | Source | Tag |
|---|---|---|---|
| WH.DATA.01 | Product lookup accepts a product number, UPC or catalog number, resolved through IVCAT (attr 1 = product). The product must already exist in IVMST, because this screen never creates products. | L55-91 | KEEP |
| WH.DATA.02 | A 4-digit product number found in IVMST.DISC is reported as "discontinued and cannot be reused", so PRO product numbers are never recycled | L75-84 | KEEP |
| WH.DATA.03 | Editable fields: CASE.QTY (IVMST attr 27) and CARTON.QTY (attr 33), free entry. The help text says "whole number" but this is not validated. | L179-197 | SIMPLIFY |
| WH.DATA.04 | WEIGHT (attr 49) in lbs, normalised to 2 decimals (accepts N, N.N, N.NN) | L199-222 | KEEP |
| WH.DATA.05 | DIMENSIONS (attr 50) as L x W x H. The delimiter may be ':', '/', space, 'X' or 'x', each part an integer or 1-decimal number, stored as "LxWxH" (the dict header says Ln:Wth:Ht) | L224-258 | KEEP |
| WH.DATA.06 | Primary (attr 47) and secondary (attr 48) bin locations must match letter-dash-digits (Aisle-Section, e.g. A-12). Invalid input silently reverts to the old value. | L260-280 | WAREHOUSE-ONLY |
| WH.DATA.07 | Audit: on Update, every changed field is logged to IVMST.LOG `<date>*<time>` with user (from @LOGNAME), product, field name, attr, old value and new value | L282-307 | KEEP |
| WH.DATA.08 | Lock handling: a locked IVMST record is reported with the locking user and is not edited (correct locked/not-found separation) | L69-88 | KEEP |

**Bugs / oddities:** The '\' clear-field help text is not implemented in this code (it may be in EDIT.LINE). The LOG key has one-second resolution, so two updates in the same second overwrite each other. `CASE IP[1,1]='E' OR EXIT IP='E'` (L105) is malformed. The screen layout comes from the SCREENS file.

## X

**Mode:** Test-variant · **Lines:** 3 · **Relevance:** PRODUCT

Developer call of IV.UPD.COGS for one product.

**Files:** none directly · writes whatever IV.UPD.COGS writes  
**Calls:** IV.UPD.COGS

| ID | Rule | Source | Tag |
|---|---|---|---|
| X.01 | Hard-coded product 6507, negative QOH -1, average cost 1492 passed to IV.UPD.COGS. Running it would post a real COGS adjustment. | L1-2 | OBSOLETE |

**Bugs / oddities:** A test script with live side effects.
