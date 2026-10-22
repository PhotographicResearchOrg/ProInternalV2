# Orders — Computyme programs and rules

59 programs, 375 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## AUTO.ORDER

**Mode:** Staging-processor · **Lines:** 172 · **Relevance:** VENDOR, PRODUCT, PO, PRICING

Creates member orders (IVORD/ORDHIST) and vendor order lines (VNORD) from TEAMPRO staging records (one record per member: PO, instructions, discount, future date, then product/qty pairs), then prints vendor orders.

**Files:** reads TEAMPRO, ARMST, IVMST, CONTROL ('UPD','ORD'), ZIPREF · writes IVORD, ORDHIST, VNORD, IVMST, ARMST, CONTROL; deletes TEAMPRO  
**Calls:** EXECUTE PR1, RUN IV10 (via SSELECT VNORD ... DATA)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AUTO.ORDER.01 | TEAMPRO staging: key = member #; record = attr 1 PO, 2 special instructions, 3 discount, 4 future date (D4/), then repeating product/qty pairs; record "ID" (header row) skipped; record deleted after order created | L42-75, L162 | OBSOLETE-INTEGRATION |
| AUTO.ORDER.02 | Unit cost = ROUND(base × multiplier) where multiplier = "1.0" concatenated with IVMST attr 12 PCT (e.g. PCT 5 → 1.05; PCT 15 → 1.015); base = IVMST attr 9 NET.2 when attr 7 QUAN (break qty) > 0, ordered qty ≥ QUAN and NET.2 > 0, otherwise attr 8 NET.1/COST (cents) | L79-82 | QUESTION |
| AUTO.ORDER.03 | Order total (cents) added to ARMST attr 17 ORDERS (open orders, used in credit exposure) | L83, L91, L144 | KEEP |
| AUTO.ORDER.04 | Order number = CONTROL 'ORD' attr 1 (then +1); if missing, operator enters last known number and the program scans IVORD for the next free one | L99-108 | SIMPLIFY |
| AUTO.ORDER.05 | Order header: ORDER 1 member, 2 products, 3 qtys, 4 unit costs (original entry order kept, 05-22-06), 6 date = today, 7 PO, 8 ship date blank, 9 special instructions, 10 total cost, 11 DISC, 12 FUTURE date; written to both IVORD and ORDHIST | L64-71, L86-89, L145-161 | KEEP |
| AUTO.ORDER.06 | One VNORD record per vendor per order, key = IVMST attr 5 VENDOR : order #; holds member, products, qtys, date, PO, ship date, instructions | L110-142 | KEEP |
| AUTO.ORDER.07 | Freight prepaid flag (VNORD attr 8 value 1) when order total > 59999 cents ($600) | L128 | QUESTION |
| AUTO.ORDER.08 | Hard-coded members 1000, 1819, 1846 ("Larmon & Cutler & Camera Shop Inc"): freight always prepaid; 1000 and 1819 also start the order total at 60000 cents | L63, L126-127 | QUESTION |
| AUTO.ORDER.09 | Hard-coded product group 10: quantities of IVMST attr 6 GRP = 10 products accumulated in VNORD attr 8 value 2 (purpose unclear) | L141 | QUESTION |
| AUTO.ORDER.10 | IVMST attr 3 REQ (quantity requested/on order) += qty; IVMST attr 17 MORD (monthly ordered qty, multivalued by AR month CONTROL 'UPD' attr 2) += qty | L136-139 | KEEP |
| AUTO.ORDER.11 | Order discount (attr 11) is stored but not applied to cost | L69, L79-82 | QUESTION |

**Bugs / oddities:** "No vendor" check compares IVMST vendor to VEND<1,POS> before it is appended, so it only fires when the product has no vendor and the message is misleading; ORDER(10)<1,2> TQTY never set; missing IVMST product CHAIN ABORTs mid-run leaving earlier orders created and TEAMPRO partially processed; ZIPREF zones read but unused; locks left on IVMST between WRITEVU and WRITEV.

## BLD.SCANORD.UPS

**Mode:** Staging-processor · **Lines:** 137 · **Relevance:** none

Loads UPS shipping export CSV content (UPS.PERM records keyed EXP...) onto SCANORD pick/ship records: tracking numbers, package counts, published and negotiated freight cost.

**Files:** reads UPS.PERM, SCANORD · writes SCANORD  
**Calls:** EXECUTE SSELECT UPS.PERM IDLIKE EXP..., SSELECT SCANORD WITH PACKAGES > "1"; INCLUDE SCANORD.FIELDS

| ID | Rule | Source | Tag |
|---|---|---|---|
| BLD.SCANORD.UPS.01 | Every run first clears tracking #, packages, published cost and negotiated cost on ALL SCANORD records, then rebuilds (10-14-11) | L5, L20-32 | SIMPLIFY |
| BLD.SCANORD.UPS.02 | UPS export staging: records whose key starts "EXP" hold CSV lines (line 1 header); columns 1 SCANORD id, 2 tracking #, 3 published cost, 4 negotiated cost (dollars → cents via MD2), 5 package count, 6 void flag | L36-43, L63-70, L86-88 | OBSOLETE-INTEGRATION |
| BLD.SCANORD.UPS.03 | Voided shipments (col 6 = "Y") are ignored | L7, L67-68 | KEEP |
| BLD.SCANORD.UPS.04 | Each new tracking # appended to SCANORD attr 15 with matching packages (16), published cost (17), negotiated cost (18); duplicates skipped | L92-98 | WAREHOUSE-ONLY |
| BLD.SCANORD.UPS.05 | For multi-package shipments, package counts and costs are summed into single totals while all tracking numbers are kept | L46-57, L103-129 | WAREHOUSE-ONLY |

**Bugs / oddities:** Header note "only update if neg.cost different" is not implemented; REMOVE.EXTRA.INFO falls through into SET.VALS.TO.NULL when only one tracking #; error text says "PURGE.UPS"; uses both SCANORD.PKGS and SCANORD.PACKAGES names (include not in extract).

## CHANGE.INST

**Mode:** Interactive · **Lines:** 119 · **Relevance:** PO

Changes the special instructions on a PRO order (ORDHIST, IVORD and all its vendor orders) if the order has not been started.

**Files:** reads ORDHIST, ARMST, VNORD · writes VNORD (attr 7), ORDHIST (attr 9), IVORD (attr 9)  
**Calls:** EDIT.LINE; EXECUTE SELECT VNORD WITH ORDER

| ID | Rule | Source | Tag |
|---|---|---|---|
| CHANGE.INST.01 | Order must exist in ORDHIST and its member in ARMST | L28-29 | KEEP |
| CHANGE.INST.02 | "Dated" orders — special instructions (attr 9) starting with "1" or "2" — cannot be changed | L30 | KEEP |
| CHANGE.INST.03 | No change allowed once any VNORD record for the order has a STATUS (attr 12) value (order started) | L63-73 | KEEP |
| CHANGE.INST.04 | Instructions = two lines of max 24 chars joined by a space; line 1 cannot start with 1 or 2; shortcut "D1" → "1st Dated Order", "D2" → "2nd Dated Order" (which then makes the order a dated order) | L37-58 | QUESTION |
| CHANGE.INST.05 | New instructions written to every VNORD for the order (attr 7 INST), ORDHIST attr 9 and IVORD attr 9 | L75-90 | KEEP |

**Bugs / oddities:** Blank line 1 means no update (instructions cannot be cleared); open-error text says "BP IV3"; dated-order status encoded in free-text instructions.

## CHANGE.VNORD

**Mode:** Utility/maintenance · **Lines:** 60 · **Relevance:** VENDOR, PRODUCT, PO

After a product's vendor changes, moves that product's open vendor-order lines from the old vendor's VNORD records to the new vendor's and updates NUMBER records.

**Files:** reads IVMST, VNMST, VNORD, NUMBER · writes VNORD, NUMBER  
**Calls:** EXECUTE SELECT VNORD, SELECT NUMBER

| ID | Rule | Source | Tag |
|---|---|---|---|
| CHANGE.VNORD.01 | Old vendor must exist in VNMST; product in IVMST; new vendor = IVMST attr 5 VENDOR | L12-15, L39 | KEEP |
| CHANGE.VNORD.02 | Product line (VNORD attr 2 product, attr 3 qty) removed from old vendor order; old VNORD deleted if no lines remain | L22-35 | KEEP |
| CHANGE.VNORD.03 | New VNORD key = new vendor : chars 4-10 of old key (assumes 3-digit vendor prefix); line appended to existing new-vendor order or a new one created copying header attrs 1, 4-11 | L39-44 | QUESTION |
| CHANGE.VNORD.04 | Hard-coded product group 10 (IVMST attr 6): VNORD attr 8 value 2 qty moved with the line | L33, L42-43 | QUESTION |
| CHANGE.VNORD.05 | NUMBER records whose VN is one of the changed vendor orders get attr 4 = new vendor (NUMBER purpose not documented here) | L48-59 | QUESTION |

**Bugs / oddities:** Write to the new vendor runs even when the old record was locked/missing or the product wasn't found, re-using the previous line (duplicate lines possible); fixed 3-char vendor prefix breaks for 4-digit vendors; old vendor validated against VNMST while key uses IVMST vendor.

## CHG.DATING

**Mode:** Utility/maintenance · **Lines:** 31 · **Relevance:** PO

Marks an order as 1st dated, 2nd dated, or not dated by overwriting its special-instructions field.

**Files:** reads IVORD, ARMST · writes IVORD (attr 9), ORDHIST (attr 9), VNORD (attr 7)  
**Calls:** EXECUTE SELECT VNORD WITH ORDER

| ID | Rule | Source | Tag |
|---|---|---|---|
| CHG.DATING.01 | Dated status is stored as text in special instructions: "1st Dated Order", "2nd Dated Order" or blank (other instructions are overwritten) | L18-24 | QUESTION |
| CHG.DATING.02 | Same value written to IVORD attr 9, ORDHIST attr 9 and every VNORD attr 7 for the order, with no started-order check (unlike CHANGE.INST) | L23-28 | QUESTION |

**Bugs / oddities:** Destroys existing special instructions; no locks; dated-order business meaning (billing/terms timing) not defined in code.

## CONVERT.DATED

**Mode:** Interactive · **Lines:** 41 · **Relevance:** PO

Converts a not-yet-started order to a 1st or 2nd dated order (2007).

**Files:** reads ORDHIST, ARMST, VNORD · writes VNORD (attr 7), ORDHIST (attr 9), IVORD (attr 9)  
**Calls:** EXECUTE SELECT VNORD WITH ORDER

| ID | Rule | Source | Tag |
|---|---|---|---|
| CONVERT.DATED.01 | Refused if any VNORD for the order has STATUS (attr 12) set | L22-27 | KEEP |
| CONVERT.DATED.02 | Sets instructions to "1st Dated Order" / "2nd Dated Order" on all vendor orders, ORDHIST and IVORD (overwriting existing instructions) | L17-38 | QUESTION |

**Bugs / oddities:** Duplicates CHG.DATING/CHANGE.INST logic; READVU locks taken in the check loop are not released before "GO 5"; existing special instructions lost.

## CONVERT.TERMS

**Mode:** Interactive · **Lines:** 62 · **Relevance:** PO, PRICING

Changes the terms value (attr 11) on an unbilled, active PRO order (03-09-11).

**Files:** reads ORDHIST, IVORD, ARMST (VNORD opened, unused) · writes ORDHIST (attr 11), IVORD (attr 11)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CONVERT.TERMS.01 | Not allowed if ORDHIST attr 15 DELETED is set (deleted/cancelled order) | L28-29 | KEEP |
| CONVERT.TERMS.02 | Not allowed if any line has a billed date (ORDHIST attr 14 DT.BILLED) | L30-36 | KEEP |
| CONVERT.TERMS.03 | New terms must be numeric 2-10 and are written to ORDHIST and IVORD attr 11 (dict name DISC — terms/discount meaning, e.g. % or days, not stated) | L50-58 | QUESTION |

**Bugs / oddities:** Lock owner taken from SYSTEM(0) instead of STATUS(); billed-date loop never ends if attr 14 holds only value marks; terms not propagated to VNORD.

## CS.UPD.UPS

**Mode:** Outbound-generator · **Lines:** 100 · **Relevance:** PO

For a shipped sale transaction (TRANSLOG), appends a UPS WorldShip import line to the DOWNLOADS 'UPS.CSV' staging record and indexes invoice → transaction in UPSIDX.

**Files:** reads CONTROL ('UPS.HDRS','UPS.SHIP.PRODS','UPS.VALUES','ENCRYPT.CODES'), TRANSLOG, IVCUST · writes DOWNLOADS ('UPS.CSV'), UPSIDX  
**Calls:** ENCRYPTOR; INCLUDE CSBP I_CS_COMMON, TRANSLOG.FIELDS, IVCUST.FIELDS (not in extract)

| ID | Rule | Source | Tag |
|---|---|---|---|
| CS.UPD.UPS.01 | Only transactions whose first type is S, R, OS or OR and that contain at least one sale line (S) are sent | L31-35 | KEEP |
| CS.UPD.UPS.02 | Shipping is identified by sale lines whose product is in CONTROL 'UPS.SHIP.PRODS'; UPS service code = that line's misc-desc subvalue 2; service 9 or none → no UPS record | L64-76 | QUESTION |
| CS.UPD.UPS.03 | Declared insurance value = INT(merchandise COST / 10000) × 100 (cost in cents → whole hundreds of dollars); if below CONTROL 'UPS.VALUES' value 1 INS.MIN (comment: 400) it is set to 100 | L8, L23, L77-78 | QUESTION |
| CS.UPD.UPS.04 | Delivery confirmation when merchandise sale dollars > UPS.VALUES value 3; adult signature when > value 2 | L23, L82-84 | KEEP |
| CS.UPD.UPS.05 | Customer PO is encrypted with seed CONTROL 'ENCRYPT.CODES' attr 1 (default literal "TOTALLYENCRYPTED") before export (08-06-08) | L5, L22, L59-63 | QUESTION |
| CS.UPD.UPS.06 | Ship-to taken from customer fields; "Last, First" names reversed; email notification flagged when IVCUST has an email | L38-57, L80-81 | KEEP |
| CS.UPD.UPS.07 | CSV layout (invoice, acct, names, address, zip, city, state, phone, fax, service, package, insured value, PO, refs, notify, email, conf, signature, Saturday) appended to DOWNLOADS 'UPS.CSV' with header CONTROL 'UPS.HDRS' attr 2 | L85-91 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Insurance based on cost not sale; values under INS.MIN declared as $100 rather than INS.MIN; when an alternate ship-to name exists, address/CSZ/phone are taken from shifted fields (ADDR from CSZ<1,3>, CSZ from PHONE<1,3>) — likely wrong; hard-coded default encryption seed.

## DEL.NUMBER

**Mode:** Utility/maintenance · **Lines:** 24 · **Relevance:** PO

Deletes a shipping number record from NUMBER and resets the related vendor order (VNORD) attr 12 to 0.

**Files:** reads NUMBER, IVORD, ARMST, VNORD · writes NUMBER (delete), VNORD  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| DEL.NUMBER.01 | NUMBER attr 2 ORDER = IVORD order id, attr 4 VENDOR; VNORD key = VENDOR:ORDER | L12-19 | KEEP |
| DEL.NUMBER.02 | Default answer (blank) to confirm prompt = Yes, deletes the shipping number | L16-17 | QUESTION |
| DEL.NUMBER.03 | After deleting the shipping number, VNORD attr 12 STATUS reset to 0 (meaning of status codes unclear) | L19-20 | QUESTION |

**Bugs / oddities:** L14 on missing ARMST shows stale/undefined NAME; blank = confirm is dangerous.

## ENV.1

**Mode:** Interactive · **Lines:** 153 · **Relevance:** none

1984 log of mailing envelopes/packages (date shipped, AM/PM, method, origin office) in PRO.ENV, purging old entries on exit.

**Files:** reads/writes PRO.ENV, DICT PRO.ENV ('ENV' counter)  
**Calls:** EXECUTE SORT/SELECT PRO.ENV; CALL !SLEEP$

| ID | Rule | Source | Tag |
|---|---|---|---|
| ENV.1.01 | New envelope number from DICT PRO.ENV 'ENV' attr 2, incremented | L26-29 | OBSOLETE |
| ENV.1.02 | Ship date defaults to today, may not be more than 3 days in the future | L66-71 | OBSOLETE |
| ENV.1.03 | Ship type M=Mail, U=UPS, N=Next Day UPS; origin A=Abington, H=Huntingdon Valley (hard-coded office locations) | L84-100,L130-135 | OBSOLETE |
| ENV.1.04 | On exit, deletes envelopes with SHIP.DATE older than today-12 days | L137-151 | OBSOLETE |

**Bugs / oddities:** Bill date (field 5) prompt disabled in add loop but still offered on edit; L67 `R(1)ELSE` spacing.

## FIX.CAN.UPS

**Mode:** Utility/maintenance · **Lines:** 75 · **Relevance:** none

Fix-up for Canadian UPS shipments not combined: merges dependent shipping numbers into the master's line in the UPS_DOM CSV staging records and re-keys UPS_INT lines to the master.

**Files:** reads SCANORD, UPS ('UPS_DOM.CSV', '_2.CSV', '_4.CSV', 'UPS_INT...') · writes UPS (same records)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.CAN.UPS.01 | Master and dependent shipping numbers must exist in SCANORD | L13-24 | WAREHOUSE-ONLY |
| FIX.CAN.UPS.02 | Combine: dependent lines removed from UPS_DOM; dependent numbers inserted after CSV column 14 of the master line; UPS_INT dependent lines re-keyed to master number | L25-64 | WAREHOUSE-ONLY |
| FIX.CAN.UPS.03 | Filename-keyed CSV staging records in file UPS (UPS_DOM.CSV, UPS_DOM_2.CSV, UPS_DOM_4.CSV, same for UPS_INT) all overwritten with the same content | L41-43,L62-72 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Writes the files inside the per-line loop (L41-44) and runs UPD.INT once per line; _2/_4 variants are overwritten with the base file content; READU locks never released before STOP.

## FIX.COST

**Mode:** Utility/maintenance · **Lines:** 27 · **Relevance:** PRICING, PRODUCT

Fix-up that re-prices lines of selected IVORD orders from current IVMST cost and recalculates order total.

**Files:** reads IVMST, IVORD · writes IVORD  
**Calls:** none (active select list)

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.COST.01 | Line price = INT(('1.0' concatenated with IVMST attr 12 PCT) x unit cost + .5); the markup factor is built by string concatenation (PCT 5 → 1.05, but PCT 12 → 1.012) | L14-18 | QUESTION |
| FIX.COST.02 | Quantity break: if IVMST attr 7 QUAN > 0 and order qty >= QUAN and attr 9 NET.2 > 0 use NET.2, else attr 8 NET.1/COST (cents) | L15-19 | KEEP |
| FIX.COST.03 | IVORD attr 4 COST per line set; attr 10 COST.QTY = sum(qty x price) | L20-24 | OBSOLETE |

**Bugs / oddities:** One-off fix; MATREADU no LOCKED clause; PCT concatenation unit ambiguity (confirm against order-entry pricing).

## FIX.DUP.PROD

**Mode:** Utility/maintenance · **Lines:** 205 · **Relevance:** PO, PRODUCT

Fix-up (2011) removing a second occurrence of a product from SCANORD, IVORD, ORDHIST and VNORD order lines and adjusting order totals.

**Files:** reads/writes SCANORD, IVORD, ORDHIST, VNORD, DICT SCANORD, DICT ORDHIST; reads IVMST  
**Calls:** INCLUDE *.FIELDS; EXECUTE SELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.DUP.PROD.01 | Creates I-descriptor DUP.PROD = COUNT(PROD,<product>) in SCANORD/ORDHIST dicts to find orders with the product more than once | L30-34,L54-58 | OBSOLETE |
| FIX.DUP.PROD.02 | Second occurrence's prod/qty/cost removed; COST.QTY<1> -= cost x qty and COST.QTY<2> -= qty | L108-121,L144-157,L180-194 | OBSOLETE |
| FIX.DUP.PROD.03 | Hard-coded vendor 497 prefixed to ORDHIST order to form the VNORD key (VNORD key = vendor:order); SCANORD VORD minus 3-char prefix = IVORD order | L64,L88-91 | QUESTION |

**Bugs / oddities:** REMOVE.DUP never sets UPD=1 so SCANORD is never written, and FCNT is never reset; product validated via IVMST attr 3 (dict says REQ; DESC is 4); 'D' at prompts drops into debugger.

## IV.INP.SCANORD

**Mode:** Interactive · **Lines:** 270 · **Relevance:** PRODUCT

Warehouse pick/pack scanning of a shipment (NUMBER → VNORD order): validates scanned products/quantities, captures serials, pends or closes the shipment in SCANORD, triggers UPS staging and packing list.

**Files:** reads NUMBER, IVEMP, VNORD, IVMST, IVCAT, CONTROL ('SERIAL.CTRL','UPS.PARAMS'), ARMST, IVORD · writes SCANORD, VNORD, SERIAL.NOS, SERIAL.CARD  
**Calls:** UPD.UPS; EXECUTE RUN IV.PRT.PACKLIST; INCLUDE I_READ_IVCAT, IVMST.FIELDS, VNORD.FIELDS

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.INP.SCANORD.01 | Employee # (max 4 digits) must exist in IVEMP | L85-91 | WAREHOUSE-ONLY |
| IV.INP.SCANORD.02 | Shipping number must exist in NUMBER; order = NUMBER attr 4 VENDOR : attr 2 ORDER → VNORD key; skip if VNORD locked or missing | L98-110 | WAREHOUSE-ONLY |
| IV.INP.SCANORD.03 | Future shipment hold: if VNORD attr 6 SHIP (ship-after date) > today-1 (i.e. today or later) scanning requires hard-coded override code 'THE.CODE' | L111-116 | QUESTION |
| IV.INP.SCANORD.04 | New SCANORD record: 1 prods, 2 qty ordered (from VNORD 2/3), 4 emp, 5 date, 6 start times (MV per session), 8 member, 11 status 'O', 12 VNORD key, 13 type (NUMBER attr 3) | L117-129 | WAREHOUSE-ONLY |
| IV.INP.SCANORD.05 | Already billed (SCANORD attr 10 BILLED set) shipments cannot be rescanned; closed ('C') can be reopened with "O" | L130-140 | KEEP |
| IV.INP.SCANORD.06 | VNORD attr 12 STATUS set to 2 when scanning starts | L141-142 | QUESTION |
| IV.INP.SCANORD.07 | Scanned product must be on the order; IVMST attr 46 HOLD = 1 → "on hold", cannot ship | L154-160,L23 | KEEP |
| IV.INP.SCANORD.08 | Quantity whole number, default = ordered qty; 'X' clears previous; scanning a UPC (>=12 chars) at qty prompt counts IVMST attr 16 MULT units, but if MULT > 1 operator must key the qty | L163-179 | WAREHOUSE-ONLY |
| IV.INP.SCANORD.09 | Cannot ship more than ordered (shipped attr 3 + qty <= ordered attr 2) | L180-184 | KEEP |
| IV.INP.SCANORD.10 | Serial capture for products in CONTROL 'SERIAL.CTRL' with format match; SERIAL.NOS PROD:SERIAL appends shipment # (attr 3) and emp (attr 5); new ones get date, prod, 'ISO' in attr 4 | L187-212 | WAREHOUSE-ONLY |
| IV.INP.SCANORD.11 | Hard-coded product 9527: 9-char serials truncated to 8 | L206 | QUESTION |
| IV.INP.SCANORD.12 | Hard-coded member 1810 with product group 12 / sub-group 2: custom serials (min 8 chars) captured to SERIAL.CARD | L190,L215-232 | QUESTION |
| IV.INP.SCANORD.13 | P = pend, PP = pend + packing list, C = complete + packing list; on C, status 'NS' (needs shipping charge) if VNORD attr 8 TORD<1> < 1 (purpose of TORD test unclear); if shipped <> ordered, must confirm C else pended (backorders) | L152,L234-248 | QUESTION |
| IV.INP.SCANORD.14 | Commented-out rule: member 9985 orders got shipping product 9991 at default $10.00 (DEF.SHIP.CHG = 1000 cents) | L20-22,L79,L249-258 | OBSOLETE |
| IV.INP.SCANORD.15 | UPS staging update via UPD.UPS when UPS/UPS.IDX files and CONTROL 'UPS.PARAMS' exist | L68-75,L261 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** L261 passes UPSIDX (undefined) instead of UPS.IDX file var; future-hold test blocks orders whose ship date is today; MATWRITEU after each scan keeps locks; error text says IV.INP.SCANNORD.

## IV.INP.SHPCHG

**Mode:** Interactive · **Lines:** 52 · **Relevance:** none

Enter shipping charges for shipments (SCANORD) awaiting shipping, adding a 9999 shipping line and marking them complete.

**Files:** reads SCANORD, NUMBER, ARMST · writes SCANORD  
**Calls:** MONEY; EXECUTE SSELECT SCANORD WITH COMP = "NS"

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.INP.SHPCHG.01 | Shipments with SCANORD attr 11 STATUS = "NS" (no shipping) are presented; operator enters amount (##.## or whole dollars via MONEY, stored cents) or S to skip | L12-15,L26-33 | KEEP |
| IV.INP.SHPCHG.02 | Zero shipping must be confirmed by re-entering 0 | L35-38 | KEEP |
| IV.INP.SHPCHG.03 | Non-zero charge: add line product 9999 (hard-coded shipping product) qty ordered 1, shipped 1; attr 9 SHIPPING = charge; status → 'C' | L44-47 | QUESTION |

**Bugs / oddities:** L8 opens CONTROL into the NUMBER file variable, so NUMBER reads hit CONTROL (likely aborts every record); confirmed zero charge leaves status NS forever; ORD computed but unused.

## IV.PRT.PACKLIST

**Mode:** Report/print · **Lines:** 132 · **Relevance:** VENDOR, PRICING

Prints the packing slip for an auto-billed shipment (SCANORD record) at the warehouse, showing ordered/shipped/backordered quantities and payment terms.

**Files:** reads SCANORD, VNORD, ARMST, IVMST, IVORD, VNMST · writes none  
**Calls:** EXECUTE SETPTR (printer PROWH)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.PRT.PACKLIST.01 | Shipping number may be entered as "SN*MASTER" (Canada master shipment) | L4, L29 | QUESTION |
| IV.PRT.PACKLIST.02 | SCANORD attr 12 holds the VNORD key (vendor 3 + order 5); SCANORD attr 1/2/3 = product/qty ordered/qty shipped; backorder = ordered − shipped | L37-39, L69-70 | KEEP |
| IV.PRT.PACKLIST.03 | SCANORD attr 13 = 'B' labels the order as a BACKORDER | L49 | KEEP |
| IV.PRT.PACKLIST.04 | Checked-by = SCANORD attr 4 (EMP) | L64 | WAREHOUSE-ONLY |
| IV.PRT.PACKLIST.05 | Terms: billing month = next month, +1 more if today's day > 25; due day the 10th | L108-110, L130 | QUESTION |
| IV.PRT.PACKLIST.06 | Future-dating (FTR) from VNMST attr 17 (FTR), else IVORD attr 12; terms % from VNMST attr 16, else IVORD attr 11 (DISC). If FTR date > the 10th of billing month, months offset = FTR month − billing month (wrap 12) else 0 | L111-122 | QUESTION |
| IV.PRT.PACKLIST.07 | Terms text: "<pct>% MM/10/YY" when terms ≠ 0, else "NET MM/10/YY" using billing month | L124-130 | QUESTION |
| IV.PRT.PACKLIST.08 | Ship-to precedence VNORD 9/10 → ARMST 31/32 → ARMST bill address; "CHARGE SHIPPING" unless VNORD attr 8 > 0 | L45-47, L67 | QUESTION |
| IV.PRT.PACKLIST.09 | Hard-coded "PRO WAREHOUSE, 2950 Turnpike Drive, Hatboro PA 19040" | L21-22 | OBSOLETE |

**Bugs / oddities:** L29 sets SN=FIELD(SN,'*',1) before computing MASTER.SN=FIELD(SN,'*',2), so MASTER.SN is always empty; MASTER.SN is then unused. L109 compares DM (full date string) to 12 so year rollover for December→January never triggers there. IVORD is read by ORDER (5-digit) though VNORD/IVORD keying differs — confirm. VNMST attr 16 is SPC.PCT in dict, used here as terms %.

## IV.PRT.PACKLIST.CT

**Mode:** Test-variant · **Lines:** 102 · **Relevance:** none

Office reprint of IV.PRT.PACKLIST that reads order header from ORDHIST (VNORD is deleted after billing).

**Files:** reads SCANORD, ORDHIST, ARMST, IVMST · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.PRT.PACKLIST.CT.01 | Header from ORDHIST: member attr 1, order date attr 6, ship-after attr 8, instructions attr 9, ship-to attr 19/20, attr 18 (TORD) for shipping flag | L34-62 | KEEP |
| IV.PRT.PACKLIST.CT.02 | Terms are not reprinted (left blank) | L50-51 | QUESTION |
| IV.PRT.PACKLIST.CT.03 | Shipping charge flag: blank when ORDHIST attr 18 > 0 or empty | L62 | QUESTION |
| IV.PRT.PACKLIST.CT.04 | Ship date from SCANORD attr 5 | L60 | KEEP |

**Bugs / oddities:** "MEMBER ORDER" prints PRO ORDER number, not the member PO (L48). Comment date 09-12-12 vs header 2002. ORDHIST attr 19 is SHIP.INFO and attr 20 is WEBORDER per dict — used here as ship-to line 2 (possible bug).

## IV.SCAN.ORD

**Mode:** Utility/maintenance · **Lines:** 1 · **Relevance:** none

VOC-style alias "$ USE IV.INP.SCANORD" — points to the real program IV.INP.SCANORD.

**Files:** reads none · writes none  
**Calls:** IV.INP.SCANORD (via $USE)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.SCAN.ORD.01 | Program body is only "$ USE IV.INP.SCANORD"; no logic of its own | L1 | OBSOLETE |

## IV.UPD.BILLPEND

**Mode:** Utility/maintenance · **Lines:** 1 · **Relevance:** none

Alias "$ USE IV.UPD.SCANORD" — billing-pending update is the IV.UPD.SCANORD program.

**Files:** reads none · writes none  
**Calls:** IV.UPD.SCANORD (via $USE)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.BILLPEND.01 | Program body is only "$ USE IV.UPD.SCANORD"; no logic of its own | L1 | OBSOLETE |

## IV.UPD.SCANORD

**Mode:** Batch · **Lines:** 476 · **Relevance:** VENDOR, PRODUCT, PO, PRICING

Auto-billing of scanned/completed warehouse shipments (SCANORD): invoices members, relieves stock FIFO layers, posts AR, sales/profit history, vendor totals, and FotoSource (Canada) invoice files. Main production billing run.

**Files:** reads SCANORD, NUMBER, IVORD, ORDHIST, VNORD, ARMST, IVSOLD, IVMST, MSALES, VNMST, ARINV, CONTROL ('UPD','YEN.CONV','FS.SURCHG','FSINV.FIELDS','FSINV.EMAIL.PARAMS','ORDB','INV','MS') · writes SCANORD, IVORD, ORDHIST, VNORD, ARMST, IVSOLD, IVMST, IVMST.DISC, MSALES, VNMST, ARINV, ARSHIP, BILLLOG, NUMBER (delete), CONTROL, FSINV  
**Calls:** IV.UPD.FSINV.XLS, EMAIL.FSINV; EXECUTE SELECT SCANORD

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.SCANORD.01 | Run blocked when CONTROL 'UPD' attr 1 > 2 | L96 | QUESTION |
| IV.UPD.SCANORD.02 | Shipment cutoff date defaults to yesterday; operator may enter 'TODAY' to include today; future dates rejected | L105-117 | KEEP |
| IV.UPD.SCANORD.03 | Bill SCANORD records with no BILLED (attr 10), STATUS (attr 11) = 'C' (complete) and DATE (attr 5) ≤ cutoff; skip again at read time if billed or not 'C' | L118, L145-146 | KEEP |
| IV.UPD.SCANORD.04 | NUMBER<shipping no> supplies PRO order (attr 2) and vendor (attr 4); shipments missing from NUMBER are skipped | L147-149 | KEEP |
| IV.UPD.SCANORD.05 | Billing month BM = next month (year +1 when current month is 12); if day > 21 add one month (ADM=1); if day > 25 and the prior-to-BM month ≠ CONTROL 'UPD' attr 2 (inventory month) then BM advances one more and ADM=0 | L119-130 | QUESTION |
| IV.UPD.SCANORD.06 | Terms % from VNMST attr 16 and future-dating FTR from VNMST attr 17; fall back to IVORD attr 11 / attr 12 | L158-160 | QUESTION |
| IV.UPD.SCANORD.07 | FTR (internal date) converted to a month offset from BM (minus ADM, wrap +12) if FTR is after the 10th of BM, else 0; then FTR += ADM | L161-170 | QUESTION |
| IV.UPD.SCANORD.08 | Due/terms text "<pct>% MM/10/YY" (or "NET MM/10/YY" with DM=BM+ADM when terms = 0); ARINV aging = −FTR (or −ADM when NET) | L174-181 | QUESTION |
| IV.UPD.SCANORD.09 | Lines with shipped qty < 1 are counted as backorder (TBO) and not billed | L233-236 | KEEP |
| IV.UPD.SCANORD.10 | Product numbers > 9989 are charge lines: amount = SCANORD attr 9 (SHIPPING), excluded from member YTD sales (R(9) −= TOT), counted in ETOT; product 9999 also adds to CONTROL MS attr 2 | L237-243 | QUESTION |
| IV.UPD.SCANORD.11 | A shipped product must be on both the IVORD order and the VNORD vendor order; else operator warning and line skipped | L244-249 | KEEP |
| IV.UPD.SCANORD.12 | Ship qty ≥ ordered: order line removed; over-shipment (Q − ordered) × cost added to ETOT. Ship qty < ordered: remaining qty stays open on IVORD and VNORD (backorder) | L252-261 | QUESTION |
| IV.UPD.SCANORD.13 | Billed price = IVORD line cost attr 4 (cents, includes surcharge); line total = qty × cost | L252, L266 | KEEP |
| IV.UPD.SCANORD.14 | ORDHIST line added if missing (prod, qty, cost); shipped qty and post date appended to ORDHIST attr 13/14 subvalues | L262-265 | KEEP |
| IV.UPD.SCANORD.15 | MSALES<prod> attr 1 += qty, attr 2 += line total | L268-275 | KEEP |
| IV.UPD.SCANORD.16 | Surcharge portion of each line = INT(TOT − TOT/(1000 + IVMST attr 12)×1000 ± .5) accumulated to member SC, vendor VSC and CONTROL MS attr 1 | L276-277 | KEEP |
| IV.UPD.SCANORD.17 | Average cost = INT(SUM(attr 25 value)/SUM(attr 24 qty)) when on-hand > 0, else 0 (old yen/110 fallback commented out) | L279-284 | QUESTION |
| IV.UPD.SCANORD.18 | Stock relieved FIFO from oldest layer (attr 24/25/26); if the last layer is exhausted stock goes negative on that layer, value forced negative; empty layer valued at AVG | L285-302 | KEEP |
| IV.UPD.SCANORD.19 | IVMST attr 3 REQ −= ordered qty (net of over-ship); attr 13 monthly shipped qty, attr 44 monthly sales, attr 45 monthly profit (TOT − AVG×qty) in bucket CONTROL 'UPD' attr 2 | L303-307 | KEEP |
| IV.UPD.SCANORD.20 | If product is suspended (attr 15 > 0): status 3 when PO qty+stock+REQ all 0, status 2 when PO qty+stock 0 but REQ ≠ 0; in either case a copy is written to IVMST.DISC with attr 11 = today (product remains in IVMST) | L308-322 | QUESTION |
| IV.UPD.SCANORD.21 | Member IVSOLD history += shipped qty per product | L323-328 | KEEP |
| IV.UPD.SCANORD.22 | ARSHIP invoice lines: product, qty, total (cents); attr 15 = AVG×qty cost (except product 9999) | L329-332 | KEEP |
| IV.UPD.SCANORD.23 | CONTROL 'ORDB' high-water order number updated only for orders < 90000 (rollover guard) | L338-343 | QUESTION |
| IV.UPD.SCANORD.24 | Fully shipped IVORD deleted and ORDHIST attr 15 (DELETED) = 1; empty VNORD deleted, else VNORD attr 12 (STATUS) = 0 and instructions attr 7 starting '1'/'2' trimmed to chars 5-16 ("Dated Order") | L344-357 | QUESTION |
| IV.UPD.SCANORD.25 | Canada: members with ARMST ZONE = 10 get a surcharge line product 9990, qty 1, amount INT(GTOT × pct/1000 + .5) where pct comes from CONTROL 'FS.SURCHG' by province (ARMST STATE) default 50 (5.0%) | L359-361, L463-468 | QUESTION |
| IV.UPD.SCANORD.26 | ARMST updates: attr 9 YTD sales, 15 balance += total; 21 surcharge += SC; 18 last sale = date; 10 NEW.MON += total if no FTR else 24 FUTURE += total; 16 HI.CRED and 36 CY.HI.CRED raised to INT(balance/100) (whole dollars); 17 open orders −= total − ETOT (floor 0); 26 PRO.SALES += total − ETOT − SC; 40 WH.PROFIT += profit | L364-373 | KEEP |
| IV.UPD.SCANORD.27 | Vendor billing guarantee: if VNMST attr 13 = 1, ARMST attr 22 VN.CRED += total and ARINV attr 8 flag = 1 on the invoice | L371, L396-398 | QUESTION |
| IV.UPD.SCANORD.28 | Invoice number from CONTROL 'INV' + 1, wraps to 1 at 999999; ARINV<member> appends invoice, date, amount, terms %, aging | L375-399 | KEEP |
| IV.UPD.SCANORD.29 | BILLLOG<inv> logs member, terms, FTR, pct, aging, ADM, cutoff date, BM | L400-402 | SIMPLIFY |
| IV.UPD.SCANORD.30 | NUMBER<shipping no> deleted after billing; SCANORD attr 10 = billed date@VMtime | L403-409, L433-434 | KEEP |
| IV.UPD.SCANORD.31 | ARSHIP<member:inv>: date posted, PO (IVORD attr 7), terms text, shipping no, surcharge, posted date | L417-419 | KEEP |
| IV.UPD.SCANORD.32 | CONTROL 'MS' attrs 1-6 accumulate month-to-date totals (1 surcharge, 2 product-9999 charges, 3 billing) | L420-431 | QUESTION |
| IV.UPD.SCANORD.33 | Per vendor: VNMST attr 7 (YTD.SALES) += vendor total and attr 9 (SURCHARGES) += surcharge, written on vendor change; vendor 0 → "No orders" stop | L442-462 | KEEP |
| IV.UPD.SCANORD.34 | Members with ARMST TYPE = 3 (FotoSource Canada) get an invoice row via IV.UPD.FSINV.XLS; at end the FSINV file is emailed via EMAIL.FSINV | L435-438, L470-474 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** MATREADU on IVMST with ELSE sets M(4)='MISSING' and later MATWRITE creates a bogus IVMST record for unknown products (L227-229, L317). IVSOLD READU ELSE H='' conflates locked/missing (L213; lock message prints H not ID). CR is reset to 0 and never set to 1, so 'GO 380' path is dead (L182, L337). PCT is overwritten by the Canada surcharge pct (L465) before being logged to BILLLOG (L400). Canada surcharge is added to GTOT but not to VTOT/SC or vendor totals. Product > 9989 lines all take the same SCANORD attr 9 amount. YEN.CONV read but unused. LC set but unused (L251). DIM M(52) is smaller than IVMST's ~69 attributes — trailing attributes ride in the last element; confirm no data loss. A shipment where the ARMST record is missing is skipped without billing but IVORD/VNORD locks released inconsistently. Status 2/3 products are copied to IVMST.DISC on every billing.

## IV.UPD.SCANORD.PRO

**Mode:** Test-variant · **Lines:** 378 · **Relevance:** PRICING, PRODUCT

March 2004 copy of IV.UPD.SCANORD (pre-profit, pre-Canada).

**Files:** same as IV.UPD.SCANORD minus ARLOG, IVEMP, IVMST.DISC, FSINV · writes same minus IVMST.DISC/FSINV  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.SCANORD.PRO.01 | Charge-line threshold is product > 9950 (vs > 9989) | L187 | QUESTION |
| IV.UPD.SCANORD.PRO.02 | Empty FIFO layer valued at LC (never assigned except 0) — no average cost, no profit buckets, no ARSHIP cost, no IVMST.DISC copy, no ORDB < 90000 guard, no Canada surcharge/FSINV | L201, L237, L264-265 | OBSOLETE |
| IV.UPD.SCANORD.PRO.03 | NET terms do not set aging to −ADM | L125-126 | OBSOLETE |

**Bugs / oddities:** superseded; DIM M(30) truncates IVMST.

## IV.UPD.SCANORD.SJL

**Mode:** Test-variant · **Lines:** 402 · **Relevance:** PRICING, PRODUCT

Feb 2005 developer copy of IV.UPD.SCANORD (between .PRO and current).

**Files:** same as IV.UPD.SCANORD.PRO · writes same  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.SCANORD.SJL.01 | Charge-line threshold product > 9990 | L197 | QUESTION |
| IV.UPD.SCANORD.SJL.02 | When on-hand ≤ 0, AVG falls back to raw cost attr 19; yen raw costs ('Y' suffix) converted at a hard-coded 110 yen/$ (INT(yen/110)) | L239-243 | QUESTION |
| IV.UPD.SCANORD.SJL.03 | No ORDB < 90000 guard, no IVMST.DISC copy, no CY.HI.CRED, no WH.PROFIT, no Canada handling | L287-291 | OBSOLETE |

**Bugs / oddities:** a bare DEBUG statement at L121 would drop into the debugger in production.

## IV10

**Mode:** Report/print · **Lines:** 99 · **Relevance:** VENDOR

Prints new member orders (VNORD) since the last printed order on pre-printed shipping-memo stock for the warehouse, assigning a shipping number to each.

**Files:** reads VNORD, ARMST, IVMST, CONTROL ('SN','LASTORD'), VNMST · writes CONTROL ('SN','LASTORD'), NUMBER  
**Calls:** EXECUTE SETPTR, SSELECT VNORD

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV10.01 | Only orders with order number > CONTROL 'LASTORD' are printed; LASTORD is advanced to the highest printed order | L27-37, L35 | KEEP |
| IV10.02 | Orders whose description matches "...DISPLAY..." are excluded (comment: Fuji Film displays) | L8, L34 | QUESTION |
| IV10.03 | VNORD key = 3-char vendor + 5-digit PRO order number (ID[1,3], ID[4,5]) | L36, L61-62 | KEEP |
| IV10.04 | Each printed order gets the next shipping number from CONTROL 'SN'; NUMBER<SN> = date, order no (attr 2), vendor (attr 4) | L60-63 | KEEP |
| IV10.05 | Ship-to precedence: VNORD attr 9/10 ship info → ARMST attr 31/32 ship street/CSZ → ARMST bill address attr 3-6 | L46-48 | KEEP |
| IV10.06 | UPS zone from VNORD attr 11 else ARMST attr 25 | L64 | WAREHOUSE-ONLY |
| IV10.07 | "** CHARGE SHIPPING **" printed unless VNORD attr 8 first value > 0 (attr 8 dict TORD; purpose unclear) | L65-66 | QUESTION |
| IV10.08 | '*' flag next to a line when product stock (SUM IVMST attr 24) < 1 and the order has no ship-after date | L7, L51, L69-70 | WAREHOUSE-ONLY |
| IV10.09 | Hard-coded warehouse address "PRO 2950 Turnpike Drive, Hatboro PA 19040" | L23, L73 | OBSOLETE |

**Bugs / oddities:** CONTROL 'SN' locked via READVU for the whole run (single-user). LASTORD read with READVU ELSE STOP. Selection is a string comparison "ORDER > LASTORD" — breaks when order numbers roll over (IV10.LJ handles this).

## IV10.LJ

**Mode:** Report/print · **Lines:** 134 · **Relevance:** VENDOR, PRODUCT

Laser-jet version of IV10 with barcoded shipping number and lines sorted by product group; current production variant.

**Files:** reads VNORD, ARMST, IVMST, CONTROL, VNMST · writes CONTROL ('SN','LASTORD'), NUMBER  
**Calls:** EXECUTE SETPTR (printer WH8100), SSELECT VNORD

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV10.LJ.01 | Excludes orders with description matching "...FUJI DISPLAY..." (narrower than IV10's "...DISPLAY...") | L47 | QUESTION |
| IV10.LJ.02 | Order sequence rollover: if LASTORD > 99997 reset to 9999 so next selected is 10000 | L37-41 | QUESTION |
| IV10.LJ.03 | Shipping number rolls over from >99998 to 10000 | L88 | QUESTION |
| IV10.LJ.04 | Pick lines sorted ascending by IVMST attr 6 group (2-digit, 99 if product missing) then product number | L61-71 | WAREHOUSE-ONLY |
| IV10.LJ.05 | Ship-to name/address from VNORD attr 9 values 1-3 (name, street, CSZ) else ARMST 31/32 else bill address | L72-75 | KEEP |
| IV10.LJ.06 | Shipping number printed as Code 39 barcode *SN* | L18-19, L125-129 | WAREHOUSE-ONLY |

**Bugs / oddities:** zero-stock flag uses SUM(STOCK)=0 here vs <1 in IV10 (negative stock not flagged). Barcode at first page prints SN+1 before SN is incremented — relies on increment order.

## IV10.RP

**Mode:** Test-variant · **Lines:** 84 · **Relevance:** none

Reprint variant of IV10 for an externally built select list of VNORD orders; does not use or update LASTORD.

**Files:** reads VNORD, ARMST, IVMST, CONTROL · writes CONTROL 'SN', NUMBER  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV10.RP.01 | Reprint still assigns a NEW shipping number (increments CONTROL 'SN' and writes NUMBER) for every reprinted order | L49-52 | QUESTION |
| IV10.RP.02 | No zero-stock '*' flag and no DISPLAY exclusion; uses active select list | L25, L56-67 | OBSOLETE |

**Bugs / oddities:** reprinting creates duplicate shipping numbers for the same order.

## IV11

**Mode:** Report/print · **Lines:** 146 · **Relevance:** PRODUCT

Prints backorder pick tickets ("backorders ready to ship") for open VNORD orders containing products of a chosen group or a typed list of up to 300 products, assigning shipping numbers.

**Files:** reads VNORD, ARMST, IVMST, CONTROL ('SN','SHIP','GRP') · writes CONTROL 'SN', NUMBER  
**Calls:** EXECUTE SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV11.01 | If CONTROL 'SHIP' starts with 'Y' (post-ship on), operator sets a maximum post-ship date; orders with ship-after (VNORD attr 6) later than that date (or than today when off) are skipped | L11-17, L65 | KEEP |
| IV11.02 | Selection by product group (IVMST attr 6, must exist in CONTROL 'GRP') or by up to 300 entered products; only matching lines of each order are printed | L36-79 | KEEP |
| IV11.03 | Members on credit hold (ARMST attr 27 CRED.STAT > 0) get no backorder tickets | L82-83 | KEEP |
| IV11.04 | Each ticket gets a new shipping number; NUMBER<SN> = date, order no, 'B' (backorder type), vendor | L21, L101-104 | KEEP |
| IV11.05 | Case count = qty / IVMST attr 27 CASE (default 20 when missing or < 1), accumulated only when product stock (SUM attr 24) ≥ 1 | L110-115 | QUESTION |
| IV11.06 | Optional operator message printed on all backorder tickets | L19, L139 | OBSOLETE |
| IV11.07 | Ship-to, UPS zone and "CHARGE SHIPPING" rules as IV10 | L86-107 | KEEP |

**Bugs / oddities:** stock check only skips TOTCASE (unused) — lines print even if product has no stock. Return address "1957-B Pioneer Rd" differs from the 2950 Turnpike Dr used elsewhere (unused WHO variable). Does not set VNORD status. Relies on an external active select of VNORD.

## IV11.AUTO

**Mode:** Batch · **Lines:** 320 · **Relevance:** PRODUCT

Automatic backorder allocation and printing: finds products with stock, allocates available stock to oldest open orders, builds BKORD, then prints barcoded backorder tickets and marks orders printed. Runs from receiving when CONTROL ABO = 1 (per comment).

**Files:** reads VNORD, BKORD, ARMST, IVMST, NUMBER, IVORD (via SELECT), CONTROL ('SN','SKIP','SKIP.MEMB','ORDB') · writes BKORD (CLEARFILE + write/delete), BKEXP, VNORD attr 12, NUMBER, CONTROL ('SN','BORUN'), PGM.AUDIT  
**Calls:** EXECUTE SSELECT NUMBER / SELECT IVORD / SELECT VNORD / SSELECT BKORD, WH8100, DHPRT

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV11.AUTO.01 | VNORD attr 12 status codes: '' new, 1 backorder printed, 2 being scanned, 0 billed (from comment header) | L31-35 | QUESTION |
| IV11.AUTO.02 | Order cutoff = (oldest unshipped, non-backorder NUMBER record's order) − 1; if none, CONTROL 'ORDB' | L91-109 | QUESTION |
| IV11.AUTO.03 | Order-number rollover handled by selecting orders > 93999 OR ≤ cutoff | L115, L160 | QUESTION |
| IV11.AUTO.04 | Candidate products: on IVORD lines for members not on credit hold, ship date before today, with stock > 0 and stock ≥ order multiple (MULT) | L116 | KEEP |
| IV11.AUTO.05 | Skip product if it equals the operator skip product or IVMST attr 46 HOLD = 1 | L127-130 | KEEP |
| IV11.AUTO.06 | Stock exactly 1 with REQ (attr 3) > 4 is not allocated; written to BKEXP (qty, date) for review | L148-153 | QUESTION |
| IV11.AUTO.07 | Orders considered: VNORD status < 1 and member credit status < 1, oldest order first; skip Canadian members (ARMST attr 25 zone = 10) when SC on; skip CONTROL 'SKIP.MEMB' member; skip orders never printed (attr 14 empty) or post-ship (attr 6 set) never started (attr 12 empty) | L160-174 | QUESTION |
| IV11.AUTO.08 | Dated orders: instructions starting with the SKIP digit are skipped; when SKIP = 1 also skip those starting '2' | L176-177 | QUESTION |
| IV11.AUTO.09 | Allocation: each order line gets its full ordered qty while the product's remaining stock > 0 (stock may go negative; no partial allocation) | L182-192 | QUESTION |
| IV11.AUTO.10 | BKORD is cleared on first allocation then one record per order (member, products, qtys) | L194-200 | KEEP |
| IV11.AUTO.11 | Tickets printed sorted by TP, UPS zone (descending), member; credit-hold members' BKORD deleted | L205, L229 | KEEP |
| IV11.AUTO.12 | Printing sets VNORD attr 12 = 1 (backorder printed), new shipping number (rolls 99999→10000) with NUMBER type 'B'; CONTROL 'BORUN' = run date/time | L210-211, L260-265 | KEEP |
| IV11.AUTO.13 | Ship-after not shown if > 60 days old; pick location attr 47 printed | L250, L283-284 | WAREHOUSE-ONLY |
| IV11.AUTO.14 | Hard-coded users: logins with chars 11-12 'dh' or 'mi' are prompted to skip Canada / a member / a product; user 'dharrar' gets DHPRT at end | L60-71, L217, L226 | QUESTION |
| IV11.AUTO.15 | Run start/stop/errors logged to PGM.AUDIT 'IV11.AUTO' (date, time, user, message) | L314-319 | SIMPLIFY |
| IV11.AUTO.16 | Commented-out December air-shipping days and Pentax ZX-60 kit rules (inactive) | L131-142, L273-279 | OBSOLETE |

**Bugs / oddities:** debug INPUT XX / INPUT XXX and CRT statements at L92, L111, L117 would pause an "automatic" run waiting for keyboard input. "IF V(8)<1,1> > 0 THEN ... ELSE P(19)='CHARGE' ; GO 90" — GO 90 binds to ELSE only (harmless). I counter not reset before L154 (relies on unassigned = 0). VNORD MATREADU ELSE RELEASE conflates locked/missing (L222) and lock is never released after WRITEV. BKORD only cleared if at least one allocation found, so a stale BKORD from a previous run prints again when nothing new is allocated.

## IV11.DHPRT

**Mode:** Test-variant · **Lines:** 171 · **Relevance:** PRODUCT

2010 manual backorder print (IV11.LJ lineage) routed to printer DHPRT; adds dated-order skip and pick location.

**Files:** reads VNORD, ARMST, IVMST, CONTROL ('SN','SHIP','SKIP','GRP') · writes CONTROL 'SN', NUMBER  
**Calls:** EXECUTE SETPTR (printer DHPRT)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV11.DHPRT.01 | If CONTROL 'SKIP' = 1, orders whose instructions (VNORD attr 7) start with '2' (2nd dated order) are skipped | L23-25, L79-80 | QUESTION |
| IV11.DHPRT.02 | Ship-to from VNORD attr 9 values 1-3 | L101-103 | KEEP |
| IV11.DHPRT.03 | Shipping number rolls 99999 → 10000 | L118 | QUESTION |
| IV11.DHPRT.04 | Pick location IVMST attr 47 (P.LOC) printed on each line | L130-133 | WAREHOUSE-ONLY |
| IV11.DHPRT.05 | Missing VNORD record no longer stops the run (skips) | L76 | KEEP |

**Bugs / oddities:** name suggests a personal printer copy (user dharrar).

## IV11.LJ

**Mode:** Test-variant · **Lines:** 157 · **Relevance:** none

Laser-jet version of IV11 (2001) with barcoded shipping number.

**Files:** same as IV11 · writes same  
**Calls:** EXECUTE SETPTR (printer HP4SI)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV11.LJ.01 | Ship-after date not printed when more than 60 days old | L97 | KEEP |
| IV11.LJ.02 | Shipping number printed as Code 39 barcode | L7-10, L148-152 | WAREHOUSE-ONLY |

**Bugs / oddities:** superseded by IV11.DHPRT / IV11.AUTO.

## IV12

**Mode:** Utility/maintenance · **Lines:** 23 · **Relevance:** none

Add or delete "shipping numbers" in the NUMBER file, each stored with a date.

**Files:** reads NUMBER · writes NUMBER  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV12.01 | Option 1 deletes an existing NUMBER record (error if not on file); option 2 adds a NUMBER record with attr 1 = entered date (MM.DD.YY converted to internal) and refuses duplicates | L5-21 | QUESTION |

**Bugs / oddities:** purpose of the NUMBER file ("shipping numbers") is not documented; READV DT at L17 overwrites the entered date variable when the record exists (harmless since it then refuses). No date validation (ICONV of bad input gives '').

## IV18

**Mode:** Report/print · **Lines:** 49 · **Relevance:** PRODUCT

Report of open member orders (IVORD) grouped by product with quantity, cost, extended value, member name, PO and ship date.

**Files:** reads IVORD, ARMST, IVMST · writes none  
**Calls:** EXECUTE SSELECT IVORD BY.EXP PROD

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV18.01 | Line value = IVORD qty (attr 3) × cost (attr 4, cents, printed MD2); subtotal per product (only when ≥2 lines) and grand total | L20-47 | KEEP |
| IV18.02 | Users with @USERNO > 10 get output routed to printer | L11 | OBSOLETE |

**Bugs / oddities:** header date "09/08/1983". Printer/terminal selection by port number.

## IV3

**Mode:** Interactive · **Lines:** 645 · **Relevance:** PRICING, PRODUCT, VENDOR

Member order entry ("new order received"): terms, member credit check, ship-to, product lines with pricing tiers, freight-prepaid threshold; writes IVORD/ORDHIST and one VNORD per vendor, updates product requirements and member open orders.

**Files:** reads ARMST, IVORD, VENDORD, IVMST, VNORD, IVCAT, SHIPTO, ZIPREF ('UPS','STATES'), CONTROL ('UPD','ORD') · writes IVORD, ORDHIST, VNORD, IVMST (attrs 3, 17), ARMST (attr 17), CONTROL 'ORD'  
**Calls:** EDIT.LINE, SEL.SHIPTO, MONEY, DSP.REPORT; EXECUTE RUN AR.SHIP.MNT, SORT ARMST

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV3.01 | Standard terms = 2% (due 10th); else discount 0-50% (0 = NET) and optional future due date; terms stored IVORD attr 11 (disc) and attr 12 (FTR due date) | L76-118, L517-518 | QUESTION |
| IV3.02 | Member lookup by number or name search (SORT ARMST NAME LIKE) | L139-141, L561-570 | KEEP |
| IV3.03 | Members on credit hold (ARMST attr 27 > 0) cannot order | L152 | KEEP |
| IV3.04 | Hard-coded member 1000 (comment: Larmon): freight always prepaid (order value forced to 60000 and VNORD/IVORD freight flag set) | L153-154, L488-489 | QUESTION |
| IV3.05 | Hard-coded member 9985 (comment: IPI): must enter a misc ship-to address, never freight prepaid, exempt from the "close to prepaid" prompt | L206-208, L377, L481, L490 | QUESTION |
| IV3.06 | Member number suffixed 'X' = expedited order; only honoured between internal dates 14938-14958 (23 Nov–13 Dec 2008); air service 1/2/3 not offered for UPS zone < 3 | L134-138, L176-184 | OBSOLETE |
| IV3.07 | Order date defaults to today and must be within 150 days past / 30 days future; ship-after date before order date needs confirmation | L156-198 | KEEP |
| IV3.08 | Ship-to: member default (ARMST attr 31/32), temporary address (validated state from ZIPREF STATES, 5 or 5-4 zip, UPS zone from ZIPREF UPS by zip3), or SHIPTO code; missing code offers AR.SHIP.MNT | L200-242, L571-607 | KEEP |
| IV3.09 | Product entered by number or catalog no. (IVCAT); re-entering a product offers change qty / delete | L261-284 | KEEP |
| IV3.10 | Products with negative basic cost (attr 8 < 0) cannot be ordered | L288 | KEEP |
| IV3.11 | Suspended products (attr 15 > 0): available = PO qty (21) + backorder (23) + stock (24) − REQ (3); no orders if < 1, qty capped at available | L289-294, L304 | KEEP |
| IV3.12 | Large-quantity confirmation: group 10 > 144, group 19 > 900, any product > 100 (comment says lenses 50, tripods 144, filters 300) | L305-314 | QUESTION |
| IV3.13 | Quantity not a multiple of IVMST attr 16 (order multiple) needs approval | L315-321 | KEEP |
| IV3.14 | Price tiers (cents, including surcharge factor '1.0':attr 12): prefix 'S' → low/promo price attr 10 (NET.3, error if blank); prefix '*' → operator-keyed price (flag in IVORD attr 23 MCOST); qty ≥ attr 7 with attr 9 > 0 → special price attr 9 (NET.2); else basic cost attr 8 | L301-302, L322-348 | KEEP |
| IV3.15 | Credit check: exposure = (order total + vendor-direct open orders [VENDORD attr 4 − attr 5] + balance ARMST 15 + open orders ARMST 17 − vendor-guaranteed ARMST 22)/100 vs credit limit ARMST attr 7 (whole dollars); over limit requires typed OK | L146-147, L244, L371-393 | KEEP |
| IV3.16 | Past-due shown = (ARMST 30+60+90-day buckets)/100 | L148-150 | KEEP |
| IV3.17 | Freight prepaid threshold: order total > 59999 cents ($600) sets VNORD attr 8 v1 / IVORD attr 18 v1 = 1; orders $570.00-$599.99 prompt to add product or approve prepaid (forces 61000) | L377-385, L490 | QUESTION |
| IV3.18 | Group 10 unit count accumulated in VNORD attr 8 v2 / IVORD attr 10 v2 / attr 18 v2 | L352, L512, L517 | QUESTION |
| IV3.19 | Special instructions 2×24 chars; cannot start with '1' or '2'; 'D1'/'D2' become "1st/2nd Dated Order"; for vendor 992 dated-order text is not copied to VNORD | L397-428, L480 | QUESTION |
| IV3.20 | Order number from CONTROL 'ORD' (search forward from operator-entered last number if missing); rolls over 99998 → 10000 | L440-459 | QUESTION |
| IV3.21 | One VNORD per vendor (key vendor:order) with member, dates, PO, instructions, ship-to (attr 9), zone (attr 11), air (attr 13) | L460-515 | KEEP |
| IV3.22 | IVMST attr 3 (REQ) += qty and attr 17 monthly ordered += qty (month = CONTROL 'UPD' attr 2) | L508-510 | KEEP |
| IV3.23 | Member open orders ARMST attr 17 += order total (cents) | L429, L516 | KEEP |
| IV3.24 | IVORD attr 21 = timestamp + login user; same record written to ORDHIST | L518-535 | KEEP |
| IV3.25 | Products with no vendor (IVMST attr 5 blank) block with "call Computyme" until OK typed | L367, L431-438 | SIMPLIFY |
| IV3.26 | Qty 0 line triggers "CRITICAL ERROR - contact Computyme 215-886-8520" until 'OK.TO.CONTINUE' typed | L354-361 | OBSOLETE |

**Bugs / oddities:** surcharge factor built by string concatenation '1.0':attr 12 (wrong for 1-digit or 3-digit values). Future-due-date error text says "MUST BE Before Today" while the check rejects dates before today. L480 precedence: "starts with 1 OR (starts with 2 AND vendor 992)" — dated-order text dropped for any vendor when it starts with '1' (though entry already forbids leading 1/2 after D1/D2 expansion). IVMST lock wait ELSE writes a blank M (MAT M='') then MATWRITE creates/overwrites an IVMST record with only REQ/attr 17 for a missing product (L504-510). Expedite window is a hard-coded 2008 date range.

## IV3.NEW

**Mode:** Test-variant · **Lines:** 418 · **Relevance:** PRICING

May 2006 copy of IV3 (before 2008-09 changes: no SHIPTO codes, no expedite, no '*' manual price, no 9985 freight exception).

**Files:** as IV3 minus SHIPTO · writes as IV3  
**Calls:** as IV3

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV3.NEW.01 | Freight-prepaid nudge and flag apply to all members including 9985 | L246, L342 | OBSOLETE |
| IV3.NEW.02 | Member PO limited to 8 characters | L105 | QUESTION |

**Bugs / oddities:** superseded.

## IV3.ORIG

**Mode:** Test-variant · **Lines:** 419 · **Relevance:** PRICING

Dec 2005 copy of IV3; products inserted in group/product sorted order rather than entry order.

**Files:** as IV3.NEW · writes as IV3.NEW  
**Calls:** as IV3.NEW

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV3.ORIG.01 | Order lines kept sorted by group+product ('AR' locate/insert) | L174, L233-237 | OBSOLETE |

**Bugs / oddities:** superseded.

## IV3.TEST

**Mode:** Test-variant · **Lines:** 384 · **Relevance:** PRICING

Oct 2001 copy of IV3.

**Files:** as IV3.NEW · writes as IV3.NEW  
**Calls:** as IV3.NEW

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV3.TEST.01 | Discount limited to 0-10% | L46 | OBSOLETE |
| IV3.TEST.02 | Credit exposure excludes vendor-guaranteed amount ARMST attr 22 | L215 | OBSOLETE |

**Bugs / oddities:** superseded.

## IV3A

**Mode:** Batch · **Lines:** 98 · **Relevance:** PRODUCT, PRICING, VENDOR

Mass-creates a "SAMPLE" order of qty 1 of chosen products for every member with zero credit status (minus an exclusion list).

**Files:** reads ARMST, IVMST, CONTROL ('UPD','ORD') · writes IVORD, VNORD, IVMST (attrs 3, 17), ARMST attr 17, CONTROL 'ORD'  
**Calls:** EXECUTE SSELECT ARMST WITH CREDIT = 0

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV3A.01 | Operator lists member accounts to exclude and products to ship; product with negative cost rejected; zero cost billed at no charge; a product can be listed once | L30-58 | KEEP |
| IV3A.02 | Every included member gets: qty 1 per product, order date today, member PO 'SAMPLE', IVORD attr 10 = 40000@VM36 ("freight is always prepaid") | L26-28 | QUESTION |
| IV3A.03 | Price = INT(('1.0' concatenated with surcharge attr 12) × basic cost attr 8 + .5) | L51-52 | QUESTION |
| IV3A.04 | New order number from CONTROL 'ORD'; one VNORD per vendor (key vendor:order) with VNORD attr 8 = 40000@VM36; member open orders ARMST attr 17 += order total; IVMST attr 3 (REQ) += qty and attr 17 monthly ordered += qty in month CONTROL 'UPD' attr 2 | L65-92 | KEEP |

**Bugs / oddities:** surcharge multiplier built by string concatenation — correct only for 2-digit attr 12 values (10-99 = 1.0%-9.9%); 5 (0.5%) becomes 1.05 and 100 (10%) becomes 1.0100. N(8)/N(9) (ship-after, instructions) never set. MATREADU ARMST ELSE RELEASE conflates locked/missing (member silently skipped).

## IV4

**Mode:** Interactive · **Lines:** 369 · **Relevance:** VENDOR, PRODUCT, PRICING

Manual (operator-keyed) billing of PRO merchandise shipments per vendor and order: relieves stock, invoices the member, posts AR and vendor totals. Interactive predecessor of IV.UPD.SCANORD.

**Files:** reads ARMST, IVORD, ORDHIST, IVMST, VNORD, VNMST, IVSOLD, NUMBER, MSALES, ARINV, CONTROL ('UPD','ORDB','INV','MS') · writes same plus ARSHIP; deletes IVORD/VNORD/NUMBER when complete  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV4.01 | Run blocked when CONTROL 'UPD' attr 1 > 2 | L37-38 | QUESTION |
| IV4.02 | Billing date defaults to today; after the 25th billing month advances an extra month, and entries after the 25th are refused while the previous month (CONTROL 'UPD' attr 2) is still open | L42-52 | QUESTION |
| IV4.03 | Terms keyed by operator: default 2% 10th; discount 0-10% (0 = NET); optional future billing of 0-9 extra months (aging = −months) | L53-70 | QUESTION |
| IV4.04 | Order 'CR…' = credit/ad-hoc invoice to a member with no order | L90-95 | KEEP |
| IV4.05 | Shipping number must exist in NUMBER and match the order, else re-key to confirm; backorder tickets (type 'B') force product-entry mode | L129-146 | KEEP |
| IV4.06 | Billing options: 1 complete order, 2 prompted products, 3 keyed products | L146-170 | SIMPLIFY |
| IV4.07 | Product < 9900 must belong to the vendor being billed (IVMST attr 5) | L183 | KEEP |
| IV4.08 | Products > 9900 are keyed-amount charges: 9999 shipping (MS attr 2), 9995 (MS attr 5), 9992 (MS attr 6); excluded from member YTD sales | L184-193 | QUESTION |
| IV4.09 | Product not on order may be billed after confirmation, priced at special cost (attr 9) if qty ≥ special qty attr 7, else basic cost attr 8, plus surcharge INT(cost × attr 12/1000 + .5) | L195-204, L240-244 | KEEP |
| IV4.10 | Warnings: shipment driving stock negative, negative quantity, over-shipment vs order all require confirmation; qty below −500 rejected | L213-231, L247-252 | KEEP |
| IV4.11 | If product has no stock layers, operator keys a unit landed cost (cents) used to value the negative layer | L232-239, L280 | QUESTION |
| IV4.12 | Stock relief, IVMST/ORDHIST/MSALES/IVSOLD/ARMST/ARINV/ARSHIP/vendor updates as IV.UPD.SCANORD (without profit buckets) | L260-366 | KEEP |
| IV4.13 | "CHARGE SHIPPING" forces operator to add a shipping line unless VNORD attr 8 > 0 or a 9999 line was billed | L305-308 | QUESTION |
| IV4.14 | Vendor billing guarantee (VNMST attr 13 = 1) or IVORD attr 12 = 1 (CL) credits ARMST attr 22 and flags ARINV attr 8 | L108, L334, L337, L350-352 | QUESTION |
| IV4.15 | Invoice numbers wrap to 1 at 99999 (current billing wraps at 999999) | L340 | QUESTION |

**Bugs / oddities:** invoice number wrap differs from IV.UPD.SCANORD/IV.UPD.RETURNS (99999 vs 999999) — risk of duplicate ARSHIP keys if both run. IVSOLD READU ELSE conflates locked/missing. ETOT not reset between members if a vendor change occurs mid-order.

## IV4.NEW

**Mode:** Test-variant · **Lines:** 290 · **Relevance:** PRICING

Older (1997-99) copy of IV4 despite the name; no ORDHIST update.

**Files:** as IV4 minus ORDHIST · writes as IV4 minus ORDHIST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV4.NEW.01 | Shipped qty limited to 500 (−500..510) | L153 | OBSOLETE |

**Bugs / oddities:** year rollover DY=DY+1 (no 2-digit wrap) at L59; READU/MATREADU ELSE conflate locked/missing (L80). Superseded.

## IV46.SPORD

**Mode:** Subroutine · **Lines:** 629 · **Relevance:** PO, PRICING

Special-order customer distribution: splits a special-order PO line across end customers (members or mailing-list customers) with quantities and extended sale, writing IVSPORD and IVCUST.

**Files:** reads TREES, ZIPREF, SCREENS, PROMPTS, IVSPORD, ARMST, IVCUST, CONTROL 'CUST' · writes IVSPORD (incl. 'O'-prefixed original copy), IVCUST, CONTROL 'CUST', name/phone index trees  
**Calls:** DRAW.BOX, PREP.ID, IDX.SEARCH, INS.ROOT, SUMM, IDATE, MONEY

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV46.SPORD.01 | IVSPORD layout: 1 product, 2 desc, 3 qty, 4 PO, 5 order date, 6 unit cost, 7 customer, 8 address, 9 CSZ, 10 store no., 11 qty per customer, 12 extended sale, 16 phone | L22-28, L65-66 | QUESTION |
| IV46.SPORD.02 | Customer quantities must sum to the ordered qty before update; cannot exceed it | L95-99, L362-379 | KEEP |
| IV46.SPORD.03 | Warn when extended cost ≥ extended sale; unit sale 0 or below unit cost needs confirmation | L101-110, L542-559 | KEEP |
| IV46.SPORD.04 | 'SS' assigns the remaining qty to "STORE STOCK" at unit cost | L456-470 | QUESTION |
| IV46.SPORD.05 | New mailing-list customers numbered '01' + 5-digit counter from CONTROL 'CUST', skipping IDs in ARMST/IVCUST; indexed by name and last-4 phone digits | L516-531, L113-135 | OBSOLETE |
| IV46.SPORD.06 | City/state/zip validated against ZIPREF patterns (US 5/9-digit, Canada 7-char); zip-only input expanded from ZIPREF | L564-580 | SIMPLIFY |

**Bugs / oddities:** unreachable — the only caller (IV46.PROD label 710) is never invoked. Treat as dead code unless called elsewhere.

## IV5

**Mode:** Interactive · **Lines:** 293 · **Relevance:** PRICING, PRODUCT, VENDOR

Change quantities/costs on, or cancel, an open member order (IVORD/VNORD/ORDHIST) and keep IVMST requirements and member open-order totals in step.

**Files:** reads ARMST, IVORD, ORDHIST, IVMST, VNORD, SCANORD, CONTROL 'UPD' · writes IVORD, ORDHIST, IVMST, VNORD, ARMST attr 17  
**Calls:** FOLD, EDIT.LINE; EXECUTE SELECT SCANORD

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV5.01 | Products cannot be added to an existing order (must enter a new order) | L78-81 | KEEP |
| IV5.02 | New quantity must be ≥ 0; 0 removes the line; cost may be overridden (cents, incl. surcharge) | L83-89, L147-152 | KEEP |
| IV5.03 | No changes allowed while VNORD attr 12 (status) ≠ 0 (being scanned / ready to bill) | L98-102 | KEEP |
| IV5.04 | Hard-coded group 10: quantity change adjusts VNORD attr 8 value 2 and IVORD attr 10 value 2 (unit count) instead of order dollars | L108-110 | QUESTION |
| IV5.05 | Other groups except hard-coded group 11: IVORD attr 10 value 1 (order $ total, cents) adjusted; if it falls below 60000 ($600) the free-freight flag VNORD attr 8 value 1 is cleared (shipping charged) | L111-115 | QUESTION |
| IV5.06 | ORDHIST keeps original qty (attr 16) and original cost (attr 17) when changed | L131-137 | KEEP |
| IV5.07 | IVMST attr 3 (REQ) and attr 17 monthly ordered (month = CONTROL 'UPD' attr 2) adjusted by qty delta; suspended-product status recalculated (3/2) including backorder qty attr 23 | L139-144 | KEEP |
| IV5.08 | Order emptied → IVORD deleted, ORDHIST attr 9 = 'DELETED <timestamp>', attr 15 = 'D' | L154-158 | KEEP |
| IV5.09 | Cancel refused if any unbilled SCANORD shipment exists for the order | L167-182 | KEEP |
| IV5.10 | Cancel removes each line's VNORD, reverses IVMST REQ/monthly ordered, deletes IVORD, marks ORDHIST deleted, and reduces ARMST attr 17 by the order total | L184-212, L65 | KEEP |
| IV5.11 | Special instructions (24+24 chars) editable unless they start with '1' or '2' (dated orders); 'D1'/'D2' expand to "1st/2nd Dated Order" | L52-53, L234-264 | QUESTION |

**Bugs / oddities:** bare DEBUG statement at L183 in the cancel path drops the user into the debugger. Cancel deletes the whole VNORD vendor record even if other lines remain for that vendor (deleted once per line). VNORD READU ELSE conflates locked/missing (L94). Display (L213-233) shows a running cumulative total as each line's total.

## IV8

**Mode:** Interactive · **Lines:** 74 · **Relevance:** PRICING, PRODUCT

Re-prices every open member order line for one product to a new cost and adjusts each member's open-order balance.

**Files:** reads IVMST, IVORD, ARMST · writes IVORD, ARMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV8.01 | Default new price = INT((1 + attr 12 PCT/1000) × attr 8 COST + .5), i.e. cost in cents plus surcharge where attr 12 is tenths of a percent | L27-28 | KEEP |
| IV8.02 | Operator may enter any amount (cents, digits only, "including surcharge") | L32-34 | KEEP |
| IV8.03 | For each IVORD order containing the product, set every matching line's cost (attr 4) to the new price and add qty × (new − old) to ARMST attr 17 (ORDERS, member open-order total, cents) | L50-68 | KEEP |
| IV8.04 | Waits on locked IVORD/ARMST records (2-second sleep loop) | L42-57 | SIMPLIFY |

**Bugs / oddities:** amount entry is in cents (no decimal) while display divides by 100 — operator error risk. If READVU on ARMST fails (no master) it GOTOs 20 still holding IVORD lock until RELEASE. Orders where the price difference nets to zero are not rewritten (cost not updated) — L66 skips WRITE when TOT=0 even if costs changed with qty 0.

## ORD.EML

**Mode:** Outbound-generator · **Lines:** 63 · **Relevance:** PO, PRICING

Spools a "PRO warehouse order confirmation" text per IVORD order to a hold-file named <account>-<order>.EML (later emailed by an external process).

**Files:** reads IVORD, ARMST, IVMST, IVMST.DISC, CONTROL ('LASTORD', locked) · writes printer hold file <ACCOUNT>-<ID>.EML  
**Calls:** EXECUTE SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| ORD.EML.01 | Confirmation shows member account (IVORD attr 1), ARMST name/address, order date attr 6, PRO order # = IVORD key, member PO attr 7 | L26,50-56 | KEEP |
| ORD.EML.02 | Lines with qty 0 omitted; unit price = attr 4 / qty (treats IVORD attr 4 as extended amount, cents) | L38-41 | QUESTION |
| ORD.EML.03 | Email delivery via spooler hold-file naming ACCOUNT-ORDER.EML | L28 | OBSOLETE-INTEGRATION |
| ORD.EML.04 | CONTROL 'LASTORD' read with lock; if > 99997 reset to 9999 (value then unused because select is commented out) | L19-21 | OBSOLETE |

**Bugs / oddities:** IVORD attr 4 treated as extended amount here but as unit cost in ORD.EML1/ORD.EML.TEST — contradictory; LASTORD lock never released explicitly.

## ORD.EML.TEST

**Mode:** Test-variant · **Lines:** 57 · **Relevance:** PO, PRICING

Variant of ORD.EML that writes the confirmation text into the EMAIL file (key <account>-<order>.EML) instead of a spool hold file.

**Files:** reads IVORD, ARMST, IVMST, IVMST.DISC, CONTROL · writes EMAIL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| ORD.EML.TEST.01 | Differs from ORD.EML: line amount = qty * IVORD attr 4 (attr 4 treated as unit cost in cents) | L32-35 | QUESTION |
| ORD.EML.TEST.02 | Output staged as EMAIL record keyed ACCOUNT-ORDER.EML | L23,42 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** superseded by ORD.EML1; no "sent" flag so reruns resend.

## ORD.EML1

**Mode:** Outbound-generator · **Lines:** 80 · **Relevance:** PO, PRICING

Production order-confirmation generator: for every IVORD order not yet confirmed (PS < 1), writes confirmation text to EMAIL file and marks the order confirmed.

**Files:** reads IVORD, ARMST, IVMST, IVMST.DISC · writes EMAIL, IVORD attr PS (14)  
**Calls:** INCLUDE FILE.INCLUDES IVORD.FIELDS; EXECUTE SSELECT IVORD

| ID | Rule | Source | Tag |
|---|---|---|---|
| ORD.EML1.01 | Orders needing confirmation = IVORD WITH PS (attr 14) < 1; after writing email, PS set to 1 | L24,65 | KEEP |
| ORD.EML1.02 | Line extended amount = qty * IVORD attr 4 (unit cost, cents); qty 0 lines omitted; order total = sum | L48-53,57 | KEEP |
| ORD.EML1.03 | Description from IVMST attr 4, fallback IVMST.DISC attr 4 | L45-46 | KEEP |
| ORD.EML1.04 | Email text staged in EMAIL file keyed ACCOUNT-ORDER.EML (external mailer sends it) | L39,64 | OBSOLETE-INTEGRATION |
| ORD.EML1.05 | Waits (10s loop) for record locks on IVORD and EMAIL rather than skipping | L30-35,58-63 | SIMPLIFY |
| ORD.EML1.06 | Comment history: 03-19-09 selection "SHIP AFTER TODAY" replaced 03-24-09 by PS<1 (comment-only evidence) | L5-6 | QUESTION |

**Bugs / oddities:** if ARMST missing, IVORD lock released via RELEASE at L27 but PS never set — order retried forever silently; TODAY unused.

## ORD.PRINT

**Mode:** Report/print · **Lines:** 92 · **Relevance:** PO

Prints warehouse pick tickets for all new VNORD member orders above CONTROL 'LASTORD', assigning sequential shipping numbers recorded in NUMBER.

**Files:** reads VNORD, ARMST, IVMST, CONTROL ('SN','LASTORD') · writes CONTROL 'SN' attr 1 and 'LASTORD' attr 1, NUMBER  
**Calls:** EXECUTE SETPTR, SSELECT VNORD

| ID | Rule | Source | Tag |
|---|---|---|---|
| ORD.PRINT.01 | Orders to print = VNORD with ORDER > CONTROL LASTORD and DESC not matching "...DISPLAY..." (display orders excluded); LASTORD advanced to highest order printed | L19,26-29,27 | KEEP |
| ORD.PRINT.02 | VNORD key = 3-char prefix (written to NUMBER attr 4 VENDOR) + 5-digit PRO order number (ID[4,5]) | L28,54-55 | QUESTION |
| ORD.PRINT.03 | Each pick ticket gets next shipping number SN = CONTROL 'SN' +1; NUMBER record SN = date, order, prefix (attr 1,2,4) | L53-55 | KEEP |
| ORD.PRINT.04 | Ship-to precedence: VNORD attr 9/10 ship-to info, else ARMST attrs 31/32 ship address, else ARMST billing address (3-6) | L39-41 | KEEP |
| ORD.PRINT.05 | Ship-after date (VNORD attr 6) printed; when present, out-of-stock '*' flags suppressed (ZEROSTK=0) | L44 | QUESTION |
| ORD.PRINT.06 | Line flagged '*' when IVMST attr 24 (QTY.REC — dict name; used here as stock) sum < 1 (page 1) or = 0 (continuation) | L62-63,73-74 | QUESTION |
| ORD.PRINT.07 | UPS zone from VNORD attr 11 else ARMST attr 25 | L57 | KEEP |
| ORD.PRINT.08 | "** CHARGE SHIPPING **" printed unless VNORD attr 8 (TORD) first value > 0 | L58-59 | QUESTION |
| ORD.PRINT.09 | Hard-coded return address Hatboro, PA 19040 | L66 | QUESTION |

**Bugs / oddities:** ESC and MSG1/LF undefined (ESC used in BCODE L13 not equated; MSG1 L56 undefined); "VNORD attr 10" used as ship-to line 2 but dict says ALLOC; inconsistent stock test <1 vs =0; display filter on DESC field not in VNORD dict.

## PACK.LIST.COMPU

**Mode:** Report/print · **Lines:** 97 · **Relevance:** PO

Prints a packing slip for one shipping number using BILL.PEND shipped quantities, showing ordered/shipped/backordered per line.

**Files:** reads BILL.PEND, NUMBER, VNORD, ARMST, IVMST (CONTROL, VNMST opened unused) · writes none  
**Calls:** EXECUTE SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| PACK.LIST.COMPU.01 | Shipping number -> NUMBER record; VNORD key = NUMBER attr 4 (prefix/vendor) : attr 2 (order) | L27,30 | KEEP |
| PACK.LIST.COMPU.02 | NUMBER attr 3 = 'B' marks a backorder shipment (label "BACKORDER NO") else "PRO ORDER NO" | L42 | KEEP |
| PACK.LIST.COMPU.03 | BILL.PEND attr 1 products, attr 2 ordered, attr 3 shipped, attr 4 checked-by; backorder = ordered - shipped per line and in total | L32,55,59-60 | KEEP |
| PACK.LIST.COMPU.04 | Ship-to precedence same as ORD.PRINT.04 (VNORD 9/10, ARMST 31/32, ARMST address) | L38-40 | KEEP |
| PACK.LIST.COMPU.05 | Out-of-stock '*' when IVMST attr 24 sums to 0 and no ship-after date | L46,62-63 | QUESTION |
| PACK.LIST.COMPU.06 | Hard-coded warehouse address 2950 Turnpike Drive, Hatboro PA 19040 | L16-17 | QUESTION |

**Bugs / oddities:** lines whose product is missing from IVMST end the page loop (L61 LN='' -> L72 GOTO 60) so later lines are dropped.

## PROCESS.EXPORT

**Mode:** Staging-processor · **Lines:** 124 · **Relevance:** none

Parses the UPS WorldShip export CSV staged in UPS.PERM record "Export_sjl.csv" and posts tracking numbers, package counts and published/negotiated freight cost to SCANORD shipments; then consolidates multi-package shipments.

**Files:** reads UPS.PERM ("Export_sjl.csv"), SCANORD · writes SCANORD attrs 15 TRACKNO, 16 PACKAGES, 17 PUB.COST, 18 NEG.COST  
**Calls:** INCLUDE FILE.INCLUDES SCANORD.FIELDS

| ID | Rule | Source | Tag |
|---|---|---|---|
| PROCESS.EXPORT.01 | Filename-keyed staging: CSV content in UPS.PERM record 'Export_sjl.csv'; header row skipped; columns 1 shipping#, 2 tracking#, 3 published cost, 4 negotiated cost, 5 packages, 6 void flag | L23,51-54,74-75 | OBSOLETE-INTEGRATION |
| PROCESS.EXPORT.02 | Voided shipments (col 6 = 'Y') are ignored | L54-55 | KEEP |
| PROCESS.EXPORT.03 | Freight costs converted dollars -> cents (ICONV MD2) and stored per tracking number; a tracking # already on the shipment is not updated again | L75,79-84 | KEEP |
| PROCESS.EXPORT.04 | For shipments with PACKAGES > 1: totals packages, published and negotiated cost across tracking numbers into the first value and blanks per-package values | L35-44,90-116 | QUESTION |
| PROCESS.EXPORT.05 | Comment says only last 5 days are updated and only when negotiated cost differs (10-03/10-14-11); CUTOFF computed but never used and no cost-difference check exists | L5-6,22 | QUESTION |

**Bugs / oddities:** CUTOFF unused (L22); abort message names BP PURGE.UPS (copy-paste, L16); REMOVE.EXTRA.INFO with DC=1 falls through into SET.VALS.TO.NULL (missing RETURN, L95-117); uses both SCANORD.PKGS and SCANORD.PACKAGES equates; hard-coded staging key includes a user's initials.

## PURGE.UPS

**Mode:** Staging-processor · **Lines:** 96 · **Relevance:** none

Earlier version of PROCESS.EXPORT: reads UPS export CSVs (Export_1/2/4.csv) staged in UPS file, posts tracking/costs to SCANORD, and purges matching shipments from the UPS_DOM/UPS_INT outbound staging records.

**Files:** reads UPS (Export_1.csv, Export_2.csv, Export_4.csv, UPS_DOM.csv, UPS_DOM_2.csv, UPS_DOM_4.csv, UPS_INT*.csv), SCANORD · writes UPS (truncate exports to header, rewrite UPS_DOM*, delete *_2/*_4), SCANORD attrs 15-18  
**Calls:** INCLUDE FILE.INCLUDES SCANORD.FIELDS

| ID | Rule | Source | Tag |
|---|---|---|---|
| PURGE.UPS.01 | Filename-keyed staging: UPS WorldShip export CSVs from three workstations (suffix 1/2/4) concatenated; each reset to header row after reading | L15-21 | OBSOLETE-INTEGRATION |
| PURGE.UPS.02 | CSV columns: 1 shipping #, 2 tracking #, 3 published cost, 4 negotiated cost (dollars -> cents), 5 packages, 6 void (read but not acted on) | L34-36 | OBSOLETE-INTEGRATION |
| PURGE.UPS.03 | Every export line appends tracking#/packages/pub cost/neg cost to SCANORD (no duplicate check, voids included) | L37,88-91 | QUESTION |
| PURGE.UPS.04 | Shipments that appear in the export are removed from the pending UPS_DOM (and, nested, UPS_INT) import lists; UPS_DOM written back to all three station copies; UPS_DOM_2/_4 and UPS_INT_2/_4 deleted | L23-29,38-52 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** void flag read but ignored (fixed in PROCESS.EXPORT); UPS_INT only purged when the same SN is also in UPS_DOM (nested loop L41) and INTREC is never written back, so UPS_INT is never actually updated; DEL inside FOR without index adjustment skips lines; UPS_INT_2/_4 deleted though UPS_INT not rewritten.

## REM.PROD.ORDHIST

**Mode:** Utility/maintenance · **Lines:** 63 · **Relevance:** none

Removes one of two duplicate occurrences of a product line from an ORDHIST order.

**Files:** reads/writes ORDHIST  
**Calls:** INCLUDE FILE.INCLUDES ORDHIST.FIELDS

| ID | Rule | Source | Tag |
|---|---|---|---|
| REM.PROD.ORDHIST.01 | Product must appear at least twice on the order; operator picks occurrence 1 or 2 by quantity ordered | L26-50 | SIMPLIFY |
| REM.PROD.ORDHIST.02 | Deletes PROD, QUAN, QUAN.SHIP, DATE.SHIP, ORIG.QTY, ORIG.COST at that position (COST attr 4, COST.QTY, SP.PRICE etc. are not deleted) | L54-56 | QUESTION |

**Bugs / oddities:** ORDHIST.COST (attr 4) values not removed, so costs shift out of alignment with products after deletion (L54-56); READU lock not released on "product not found" re-prompt path until next order.

## REPRINT.BO

**Mode:** Report/print · **Lines:** 87 · **Relevance:** PO

Reprints pick tickets/order forms for a select list of VNORD orders on 3-part stock using operator-supplied starting shipping number (no NUMBER/CONTROL update).

**Files:** reads VNORD, ARMST, IVMST · writes none  
**Calls:** EXECUTE SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| REPRINT.BO.01 | Shipping numbers on reprint = operator start number +1 per order; not recorded in NUMBER or CONTROL 'SN' (writes commented out) | L12-13,28-30,54 | SIMPLIFY |
| REPRINT.BO.02 | Ship-to precedence, UPS zone, "CHARGE SHIPPING" (VNORD attr 8 first value not > 0) same as ORD.PRINT.04/07/08 | L39-41,56-58 | KEEP |
| REPRINT.BO.03 | Hard-coded warehouse address 2950 Turnpike Drive, Hatboro PA 19040 | L18,63 | QUESTION |

**Bugs / oddities:** no out-of-stock '*' flags (unlike ORD.PRINT); stops entirely on first missing VNORD/ARMST record (L33,35).

## REPRINT.ORDERS

**Mode:** Test-variant · **Lines:** 90 · **Relevance:** PO

Copy of REPRINT.BO pointed at printer WH8100 (2001 update).

**Files:** reads VNORD, ARMST, IVMST · writes none  
**Calls:** EXECUTE SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| REPRINT.ORDERS.01 | No rule differences from REPRINT.BO; only printer destination (AT WH8100) and DIM V(13) differ | L6,29 | OBSOLETE |

**Bugs / oddities:** duplicate of REPRINT.BO.

## SCAN.ORD

**Mode:** Interactive · **Lines:** 88 · **Relevance:** PO

Warehouse scan-pick screen. The picker scans a ship ticket number, then products and quantities against the vendor order (VNORD), and marks the ticket pending or complete, which prints a packing list.

**Files:** reads NUMBER, VNORD, IVMST, IVCAT (via include) · writes SCANORD  
**Calls:** INCLUDE I_READ_IVCAT; EXECUTE RUN IV.PRT.PACKLIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| SCAN.ORD.01 | L1 `$ USE IV.INP.SCANORD` marks this program as superseded by IV.INP.SCANORD | L1 | OBSOLETE |
| SCAN.ORD.02 | Ship number lookup: NUMBER record SN gives the VNORD key = NUMBER attr 4 : attr 2 (purpose of each part unclear). The order must exist in VNORD. | L28-32 | WAREHOUSE-ONLY |
| SCAN.ORD.03 | A new SCANORD ticket is seeded from VNORD: attr 1 products = VNORD attr 2, attr 2 ordered qty = VNORD attr 3, attr 5 date = today, attr 6 start time, attr 8 member = VNORD attr 1 | L33-36 | WAREHOUSE-ONLY |
| SCAN.ORD.04 | Tickets already billed (SCANORD attr 10 BILLED non-blank) cannot be scanned. A closed ticket (attr 11 = 'C') needs "O" to reopen. | L37-45 | WAREHOUSE-ONLY |
| SCAN.ORD.05 | The scanned product must be on the order (it is resolved through the IVCAT include, presumably UPC/alias to product). Quantities are whole numbers only. Blank qty = the full ordered qty. Cumulative shipped qty (attr 3) may not exceed the ordered qty. 'X' clears the line's previous entries. | L49-74 | WAREHOUSE-ONLY |
| SCAN.ORD.06 | A qty entry of 12+ characters is treated as a scanned barcode: it becomes the next product with qty 1 | L69 | WAREHOUSE-ONLY |
| SCAN.ORD.07 | Finishing: 'P' = pending, 'C' = complete. Stores employee (attr 4) and stop time (attr 7). If 'C' and VNORD attr 8 TORD value 1 < 1, status becomes 'NS' (meaning unclear). For anything not pending, a packing list is printed. | L77-85 | QUESTION |

**Bugs / oddities:** Superseded program. MATREADU ELSE conflates "not found" with "locked" (a locked ticket would be re-seeded as new), which is a silent-fallthrough bug suspect. 'E' at the QTY prompt STOPs while holding the lock.

## SHIP.TICKET

**Mode:** Report/print · **Lines:** 11 · **Relevance:** none

Stub of a "print shipping tickets" program. It only opens files and has no logic.

**Files:** opens VNORD, ARMST, IVMST, NUMBER, CONTROL, VNMST, BILL.PEND · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| SHIP.TICKET.01 | No business logic (the program ends after the OPEN statements) | L1-11 | OBSOLETE |

**Bugs / oddities:** Truncated/incomplete source with no END statement.

## TEST.OH

**Mode:** Test-variant · **Lines:** 11 · **Relevance:** none

Developer test that looks for 14 product numbers in the products of ORDHIST order 21154.

**Files:** reads ORDHIST · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| TEST.OH.01 | Hard-coded order 21154 and product list (8362, 7280, 2986, 2979, 7676, 6548, 6997, 7004, 6017, 4155, 7343, 2597, 7216, 4851). Test data only, no business meaning. | L4-5 | OBSOLETE |

## UPD.MEMEDI

**Mode:** Staging-processor · **Lines:** 473 · **Relevance:** PRODUCT, PO, PRICING, VENDOR

Imports member purchase orders received electronically (MEMEDI 'ORDER.TXT'). It validates each order and creates PRO orders (IVORD/ORDHIST), splits them into vendor orders (VNORD) and updates product demand and member open-order totals.

**Files:** reads MEMEDI, MEMEDIIDX, ARMST, VENDORD, SHIPTO, IVCAT, IVMST, CONTROL ('UPD','ORD'), ZIPREF ('UPS','STATES') · writes MEMEDI.PERM, MEMEDI ('EDIDUPS','EDIAMTS', deletes 'ORDER.TXT'), WEBERRORS, ARMST, IVMST, VNORD, IVORD, ORDHIST, MEMEDIIDX, CONTROL 'ORD'  
**Calls:** EXECUTE RESETPTR, SORT WEBERRORS LPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.MEMEDI.01 | Filename-keyed staging: reads MEMEDI record 'ORDER.TXT', archives it to MEMEDI.PERM as ORDER_<date>_<time>, then deletes it. Orders are delimited by 'ENDOFINVOICE'. Header field positions come from the MEMEDI.FIELDS include (not available). Detail lines are blocks of 4 (product, qty, cost, desc) starting after field 10. | L83-96, L136-141, L239-252 | OBSOLETE-INTEGRATION |
| UPD.MEMEDI.02 | Account field: chars 1-4 = member, chars 5-6 = alternate ship-to code (zero-padded), looked up as SHIPTO member*code (name, addr1, city/state/zip, zone) | L100-103, L227-233 | SIMPLIFY |
| UPD.MEMEDI.03 | Order cash discount (DISC) defaults to 2 when blank or 0 | L105-106 | QUESTION |
| UPD.MEMEDI.04 | Dating ("TERMS") field: free-form date digits are parsed into MM/DD/YY as the future-dating date (FTR). If it equals the standard due date, it is cleared (no dating). | L108-121, L187-188 | QUESTION |
| UPD.MEMEDI.05 | Standard due date = the 10th of next month. After the 22nd: if the current month is still the open AR month (CONTROL 'UPD' attr 2), the operator must type OK. Otherwise the standard due moves to the 10th of the month after next. | L62-78 | QUESTION |
| UPD.MEMEDI.06 | Duplicate guard: MEMEDIIDX member:PO holds the list of order dates already posted. The same member + PO + order date is rejected as "Already posted" and saved to MEMEDI 'EDIDUPS'. | L124-134, L457-460 | KEEP |
| UPD.MEMEDI.07 | Total check: sum(qty x cost x 100) (+ SHIP, always 0) must be within 100 cents ($1.00) of the header total (dollars to cents), otherwise the whole order is rejected and saved to MEMEDI 'EDIAMTS' | L136-162 | KEEP |
| UPD.MEMEDI.08 | Non-numeric qty or cost is logged and the line is set to qty 0/cost 0 | L142-150, L241-249 | SIMPLIFY |
| UPD.MEMEDI.09 | Member must exist in ARMST. Credit hold (ARMST attr 27 CRED.STAT > 0) rejects the whole order. | L192-199, L217-224 | KEEP |
| UPD.MEMEDI.10 | Hard-coded member 1000 ("Larmon"): order cost total is pre-seeded to 60000 cents, so freight is always prepaid (free) | L225, L234, L407-408 | QUESTION |
| UPD.MEMEDI.11 | Hard-coded member 9985: the alternate ship-to block is always written into the vendor order and IVORD ship info, even when blank | L401-405 | QUESTION |
| UPD.MEMEDI.12 | Product alias resolution: IVCAT attr 1 maps the ordered number to the PRO product. The product must exist in IVMST. | L259-267 | KEEP |
| UPD.MEMEDI.13 | Line rejected if IVMST COST (attr 8, PRICE-1) < 0 ("No Cost in IVMST") | L270-277 | KEEP |
| UPD.MEMEDI.14 | Suspended product (IVMST attr 15 STATUS > 0): available = sum PO.QTY (attr 21) + sum BO.QTY (attr 23) + sum QTY.REC (attr 24) - REQ (attr 3). If < 1 the line is rejected. If qty > available, qty is cut to available. | L278-299 | QUESTION |
| UPD.MEMEDI.15 | Hard-coded group limit: product group (IVMST attr 6) < 3 ("Lenses") rejects qty > 50 | L300-301 | QUESTION |
| UPD.MEMEDI.16 | Hard-coded group limit: group 10 ("Tripods") rejects qty > 144 | L302 | QUESTION |
| UPD.MEMEDI.17 | Hard-coded group limit: group 19 ("Filters") rejects qty > 900 | L303 | QUESTION |
| UPD.MEMEDI.18 | Any line with qty > 1000 is rejected | L304 | KEEP |
| UPD.MEMEDI.19 | PRICING: the line cost is the member-supplied EDI cost (dollars x 100 = cents). It is NOT checked against IVMST pricing in this version (UPD.MEMEDI.TST adds the check). | L250, L313-316, L327 | QUESTION |
| UPD.MEMEDI.20 | Qty = 0 after validation stops processing with "CRITICAL ERROR - contact Computyme" until the operator types OK.TO.CONTINUE | L318-325 | OBSOLETE |
| UPD.MEMEDI.21 | Credit-limit check (in dollars): exposure = INT((order total + open vendor POs (VENDORD sum attr 4 - sum attr 5 billed) + ARMST balance attr 15 + open orders attr 17 - VN.CRED attr 22) / 100). If it exceeds the credit limit (ARMST attr 7), an error is logged, but the order is STILL posted. | L212-215, L237, L330-348 | QUESTION |
| UPD.MEMEDI.22 | Missing vendor (IVMST attr 5 VEND blank) forces an operator OK ("internal program error") but the order continues | L317, L355-360 | QUESTION |
| UPD.MEMEDI.23 | Order number = CONTROL 'ORD' attr 1 (if missing, the operator enters the last known number and the program scans IVORD forward). Above 99998 it wraps to 10000. | L361-379 | SIMPLIFY |
| UPD.MEMEDI.24 | Vendor split: each line goes to VNORD `<IVMST vendor><order#>`. New VNORD gets member (1), date (4), PO (5), ship (6), instructions (7), ship-to (9), UPS zone (11). Product/qty are appended to 2/3. | L381-412, L435 | KEEP |
| UPD.MEMEDI.25 | Hard-coded vendor 992: instructions are suppressed on the vendor order when they start with "2" and the vendor is 992 (also when they start with "1" for any vendor, depending on AND/OR precedence) | L400 | QUESTION |
| UPD.MEMEDI.26 | Free freight: VNORD attr 8 value 1 and IVORD FREE.SHIP = 1 when the order cost total > 59999 cents ($600). The threshold is hard-coded. | L409 | QUESTION |
| UPD.MEMEDI.27 | Group 10 (tripod) quantities are accumulated in VNORD attr 8 value 2, IVORD FREE.SHIP value 2 and the order's COST.QTY value 2 (purpose of the tripod count is unclear) | L315, L431-434, L438 | QUESTION |
| UPD.MEMEDI.28 | Demand update: IVMST attr 3 REQ (member ordered) += qty, and attr 17 MORD value <open month> += qty (monthly ordered) | L427-429 | KEEP |
| UPD.MEMEDI.29 | ARMST attr 17 ORDERS += order total (cents) | L353, L437 | KEEP |
| UPD.MEMEDI.30 | IVORD and ORDHIST `<order#>` written with member, products, qty, cost, date, PO, instructions (folded to 2 x 24 chars), COST.QTY (total cost, tripod qty), DISC, FTR, WEBORDER = online order number, timestamp | L349-352, L438-456 | KEEP |
| UPD.MEMEDI.31 | Every validation error is written to WEBERRORS key `<date>*<time>*<n>` (online#, member, PO, product, message), and today's WEBERRORS are printed at the end | L179, L467-472 | SIMPLIFY |

**Bugs / oddities:** An unconditional `DEBUG` at L97 drops into the debugger on every order. ARMST lock wait: the loop exits at WAIT > 60 but the skip test is WAIT > 180, so after ~65 s the order proceeds with no ARMST record read (R is stale or empty) and is then written back. Typing DEBUG at the 22nd-of-month prompt bypasses the check. MATREADU IVMST ELSE conflates not-found and locked: a not-found product is written as a new near-empty IVMST record. ERR is used as both a string and a counter. The over-limit check does not block posting. Contact phone numbers are hard-coded. VNORD/IVMST writes are not transactional with IVORD.

## UPD.MEMEDI.TST

**Mode:** Test-variant · **Lines:** 512 · **Relevance:** PRODUCT, PRICING

2011 test copy of UPD.MEMEDI that reads an operator-entered MEMEDI id, with all file writes commented out (dry run). It contains newer rules not present in the production UPD.MEMEDI.

**Files:** reads same as UPD.MEMEDI (+ARLOG opened) · writes MEMEDI dup/amount error records, WEBERRORS only (main writes disabled)  
**Calls:** same as UPD.MEMEDI

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.MEMEDI.TST.01 | Staging id is entered by the operator instead of 'ORDER.TXT'. No archive to MEMEDI.PERM. No writes to IVMST, VNORD, ARMST, IVORD, ORDHIST, MEMEDIIDX or CONTROL 'ORD'. | L91-96, L408-499 | OBSOLETE |
| UPD.MEMEDI.TST.02 | Header-vs-detail total tolerance raised to 10,000,000 cents, which effectively disables the check | L163 | QUESTION |
| UPD.MEMEDI.TST.03 | Lens limit (group < 3) raised from 50 to 200 (comment dated 12-29-10) | L312-314 | QUESTION |
| UPD.MEMEDI.TST.04 | New rule: if IVMST attr 16 MULT (order multiple) > 0, the qty must be a multiple of it or the line is rejected | L318-319 | QUESTION |
| UPD.MEMEDI.TST.05 | New PRICING rule ("Always use PRO pricing from IVMST", 04-20-11). Price = INT(SC x IVMST attr 8 PRICE-1 + 0.5), where SC is the string '1.0' concatenated with IVMST attr 12 (S/C PCT), e.g. 5 -> 1.05. If attr 7 SP-QTY > 0, attr 9 PRICE-2 > 0 and qty > SP-QTY, PRICE-2 is used instead (quantity break). When this differs from the member-sent cost, a "Price Change" error is logged and the PRO price replaces it. | L330-342 | QUESTION |
| UPD.MEMEDI.TST.06 | ARMST lock wait is 120 s and then requires the operator to type OK. The DEBUG at L97 is removed. | L209-219 | SIMPLIFY |

**Bugs / oddities:** The SC string concatenation breaks for a 2-digit surcharge percent (10 -> 1.010 = 1%) and for blank values. Confirm whether this pricing logic made it into production (UPD.WEBORDERS should be checked as the likely home). The price-change message mixes 'MC2' and 'MD2' conversions.

## UPD.SCANORD.UPS

**Mode:** Staging-processor · **Lines:** 124 · **Relevance:** none

Imports UPS WorldShip export results (UPS.PERM 'EXP...' records from the last 5 days) and writes tracking numbers, package counts and published/negotiated freight cost onto the SCANORD ship tickets. It then consolidates multi-package tickets.

**Files:** reads UPS.PERM, SCANORD · writes SCANORD  
**Calls:** EXECUTE SSELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.SCANORD.UPS.01 | Staging: UPS.PERM records with ids like EXP... dated within the last 5 days, as CSV lines (header skipped) with field 1 ship#, 2 tracking#, 3 published cost, 4 negotiated cost (dollars to cents), 5 packages, 6 void flag | L22-31, L50-57, L74-75 | OBSOLETE-INTEGRATION |
| UPD.SCANORD.UPS.02 | Voided shipments (field 6 = 'Y') are ignored | L54-55 | KEEP |
| UPD.SCANORD.UPS.03 | A tracking number not already on the ticket is appended to SCANORD attr 15 with matching packages (16), published cost (17) and negotiated cost (18). Duplicates are skipped. | L73-88 | KEEP |
| UPD.SCANORD.UPS.04 | For tickets with PACKAGES > 1, package count and published/negotiated costs are summed into a single value per ticket while all tracking numbers are kept | L35-44, L90-116 | QUESTION |

**Bugs / oddities:** The comment says "only update if neg.cost different" but the code does not do this. The consolidation pass scans ALL SCANORD (not just the last 5 days) on every run. SET.VALS.TO.NULL edits arrays that are then discarded. The DC = 1 branch falls through into SET.VALS.TO.NULL. Both SCANORD.PACKAGES and SCANORD.PKGS equates are used (both must exist in the include). The error text says PURGE.UPS.

## UPD.UPS

**Mode:** Outbound-generator · **Lines:** 143 · **Relevance:** PRODUCT

Subroutine that appends a ship ticket to the UPS WorldShip import CSVs (UPS_DOM, plus UPS_INT customs lines for Canada) held as records in the UPS file. It writes 3 copies (.CSV, _2.CSV, _4.CSV).

**Files:** reads ARMST, IVMST, UPS · writes UPS ('UPS_DOM.CSV', 'UPS_DOM_2.CSV', 'UPS_DOM_4.CSV', 'UPS_INT*.CSV')  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.UPS.01 | Ship-to address: the vendor order's SHIP.INFO if present, else ARMST SHIP.STREET (attr 31) / SHIP.CSZ (attr 32), else ARMST street/city/state/zip. Name 2 defaults to 'RECEIVING'. | L45-63 | KEEP |
| UPD.UPS.02 | Hard-coded zone 10 = Canada: ARMST UPS zone (attr 25) other than 10 becomes 1. ARMST AIR (attr 39), if set, overrides the zone. Zone 10 means country 'CA', otherwise 'US'. | L68-70 | QUESTION |
| UPD.UPS.03 | Backorder tickets (SCANORD type 'B') always ship ground (zone 1) unless Canada | L71 | QUESTION |
| UPD.UPS.04 | Declared insurance value is hard-coded at "100.00" per shipment | L38 | QUESTION |
| UPD.UPS.05 | A ship# already in today's file is not written again | L77-79 | KEEP |
| UPD.UPS.06 | Canada consolidation: if the member already has a line in the file, the first ship# becomes the master and later ship#s are appended to REF4. The existing line is replaced. | L81-86 | QUESTION |
| UPD.UPS.07 | DOM CSV layout (19 fields: ship#, member, names, address, zip, city, state, phone, zone, country, insurance, PO as REF2, REF3-5, notes, internal date, zone) | L14-18, L90-95 | OBSOLETE-INTEGRATION |
| UPD.UPS.08 | Canada customs lines per shipped product on the vendor order: description = IVMST attr 4 (default 'MERCHANDICE', quotes/commas stripped), country of origin = IVMST COO (attr 52, default 'USA'), HS code = IVMST attr 53 without dots, unit value = IVMST NET.1 (attr 8, PRICE-1) in dollars, USD, UOM EACH, general description "PHOTO PRODUCTS" | L101-129 | QUESTION |
| UPD.UPS.09 | Three identical copies of each CSV (.CSV, _2.CSV, _4.CSV) are maintained, presumably one per WorldShip station | L97-99, L127-129 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** City/state/zip parsing uses MCA/MCN on "ST ZIP". For Canadian postal codes (letters + digits) this mangles both the province and the postal code, which matters because Canada is the only zone-10/international path. Zip+4 hyphens are lost. PHONE is not set on the SHIP.INFO path (stale value from a prior call). The date is written in internal Pick format. MATREAD ARMST failure waits on INPUT inside a batch subroutine.

## UPD.WEBORDERS

**Mode:** Staging-processor · **Lines:** 413 · **Relevance:** PRODUCT, PO, PRICING, VENDOR

Imports member web orders (CSV staged in WEBORDERS 'TEST_ORDER.TXT'), groups them into PRO orders, and creates IVORD/ORDHIST and per-vendor VNORD orders. It updates product demand and member open orders, and archives the lines to WEBORD.PERM.

**Files:** reads WEBORDERS, WEBORD.PERM, ARMST, VENDORD, IVCAT, IVMST, CONTROL ('UPD','ORD'), ZIPREF · writes WEBORD.PERM, WEBORDERS (staging per line, then deleted), WEBERRORS, ARMST, IVMST, VNORD, IVORD, ORDHIST, CONTROL 'ORD'  
**Calls:** EXECUTE SSELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.WEBORDERS.01 | Filename-keyed staging: WEBORDERS 'TEST_ORDER.TXT' is archived to WEBORD.PERM ORDER_<date>_<time> and deleted. Each CSV line (1 member, 2 web order#, 3 PO, 4 product, 5 qty, 6 price in dollars, 7 dating date MMDDYY, 8 terms/discount, 9 ship-after MMDDYY) is re-staged as WEBORDERS record <seq> | L67-84 | OBSOLETE-INTEGRATION |
| UPD.WEBORDERS.02 | Duplicate guard: if WEBORD.PERM `<member>*<web order#>` already exists, an error is logged and ALL remaining lines for that member in this run are skipped | L109-114, L405-412 | QUESTION |
| UPD.WEBORDERS.03 | Order grouping: lines sorted by member, web order, bill date, discount. A new PRO order is started when member, dating date or discount changes. Web order number alone does NOT start a new order, so several web orders with the same member/date/discount merge into one PRO order. | L87, L115-142 | QUESTION |
| UPD.WEBORDERS.04 | Standard due date = the 10th of next month (moved a month later after the 22nd when the AR month is already closed). The operator must type OK after the 22nd when the month is still open, and "DEBUG" bypasses this. A web dating date equal to the standard due means no future dating (FTR = ''). | L47-63, L116-121 | QUESTION |
| UPD.WEBORDERS.05 | Member must exist in ARMST. If locked for more than 60 s, the member is skipped. Credit hold (ARMST attr 27 > 0) skips the member's orders. | L144-170 | KEEP |
| UPD.WEBORDERS.06 | Hard-coded member 1000 ("Larmon"): freight always prepaid (order cost total pre-seeded to 60000 cents) | L171-172, L331-332 | QUESTION |
| UPD.WEBORDERS.07 | Hard-coded member 9985 ("IPI members"): the special ship-to logic is commented out, but blank ship-to info is still written to VNORD/IVORD for this member | L176-186, L325-329 | QUESTION |
| UPD.WEBORDERS.08 | Product alias via IVCAT attr 1. The product must be in IVMST. IVMST COST (attr 8) < 0 rejects the line. | L189-207 | KEEP |
| UPD.WEBORDERS.09 | Suspended product (IVMST attr 15 > 0): rejected if on-order + backorder + received - requested < 1. Then, using available = received (attr 24) - requested (attr 3) only, a line with qty > available is rejected (not reduced, unlike UPD.MEMEDI). | L208-224 | QUESTION |
| UPD.WEBORDERS.10 | PRICING: the line cost is the web price x 100 (cents) as sent by the web site. The IVMST price calculation (PRICE-1 x (1.0 & S/C pct), or PRICE-2 when qty >= SP-QTY) is commented out, so web prices are trusted without validation. | L219, L234-239 | QUESTION |
| UPD.WEBORDERS.11 | Hard-coded group 1-2 (group < 3, "Lenses"): qty > 50 is flagged "Large Quantity" but the line is still accepted | L225-226, L230-233 | QUESTION |
| UPD.WEBORDERS.12 | Hard-coded group 10 ("Tripods"): qty > 144 is flagged but accepted | L227 | QUESTION |
| UPD.WEBORDERS.13 | Hard-coded group 19 ("Filters"): qty > 900 is flagged but accepted (comment says 300) | L228 | QUESTION |
| UPD.WEBORDERS.14 | Any qty > 100 is flagged but accepted (comment "Other mds=100"; UPD.MEMEDI rejects > 1000) | L229 | QUESTION |
| UPD.WEBORDERS.15 | Credit-limit exposure = (order total + open vendor POs + balance + open orders - VN.CRED)/100 compared to ARMST attr 7. If over, an error is logged and the order is STILL posted. | L161-164, L187, L259-268 | QUESTION |
| UPD.WEBORDERS.16 | Ship-after date (field 9) goes to IVORD SHIP | L272-276 | KEEP |
| UPD.WEBORDERS.17 | Order number from CONTROL 'ORD' (wraps 99998 to 10000). Vendor split into VNORD `<vendor><order#>`, same as UPD.MEMEDI.23-24. | L285-336 | KEEP |
| UPD.WEBORDERS.18 | Hard-coded vendor 992: instruction suppression on the vendor order (always blank here since web instructions are blank) | L269-271, L324 | QUESTION |
| UPD.WEBORDERS.19 | Free freight when the order cost total > 59999 cents ($600). Group 10 qty is accumulated in VNORD attr 8 value 2 / IVORD FREE.SHIP value 2. | L333, L355 | QUESTION |
| UPD.WEBORDERS.20 | IVMST attr 3 REQ += qty and attr 17 MORD <open month> += qty. ARMST attr 17 ORDERS += order total. | L277, L351-353, L358 | KEEP |
| UPD.WEBORDERS.21 | IVORD/ORDHIST get COST.QTY, DISC, FTR and WEBORDER = web order#. Special instructions are blank. | L269-271, L359-377 | KEEP |
| UPD.WEBORDERS.22 | Processed lines are appended to WEBORD.PERM `<member>*<web order#>` (this is also the duplicate key), and the WEBORDERS seq records are deleted | L378-398 | SIMPLIFY |
| UPD.WEBORDERS.23 | Errors go to WEBERRORS key `<date>*<time>`, with a 1-second sleep to avoid key collisions | L399-404 | SIMPLIFY |

**Bugs / oddities:** Repeated product in one order: the prior line's cost is subtracted from the totals but the prior line is not removed, so both lines go to the vendor order. The VEND2 "no vendor" check compares against VEND<1,POS> with POS from an unrelated LOCATE, so it is effectively meaningless. The over-limit message prints R(7)-MAX (negative). When ARMST is not found, the error text is just "NOT ON FILE" and the member is not skipped. WEBORD.PERM is only written for the last web order# per member group (OLD.WEBORD is never updated after the first). Validation is softer than UPD.MEMEDI's (large qty accepted). MATREADU IVMST ELSE creates a stub record on not-found.
