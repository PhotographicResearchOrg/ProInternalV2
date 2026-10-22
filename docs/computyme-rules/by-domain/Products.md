# Products — Computyme programs and rules

39 programs, 129 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## ADJ.ARHIST

**Mode:** Utility/maintenance · **Lines:** 25 · **Relevance:** PRODUCT, PRICING

One-off fix-up that recalculates the cost field (attr 15) on ARHIST lines for returns using IVMST average received cost.

**Files:** reads ARHIST, IVMST · writes ARHIST  
**Calls:** none (relies on an active select list)

| ID | Rule | Source | Tag |
|---|---|---|---|
| ADJ.ARHIST.01 | Average cost = INT(SUM(IVMST attr 25 AMT.RECD) / SUM(IVMST attr 24 QTY.REC)) when total received qty > 0 | L13-14 | QUESTION |
| ADJ.ARHIST.02 | Fallback when nothing received: use IVMST attr 19 RAW cost; if RAW ends in "Y", cost = INT(numeric part / 110), else RAW as-is (the /110 implies "Y" means a 10% loaded price and a cents→dollars shift; units inconsistent with the other branch) | L15-16 | QUESTION |
| ADJ.ARHIST.03 | ARHIST attr 15 (COST per ARSHIP naming) for each line = line qty (attr 3) × average cost | L19 | OBSOLETE |

**Bugs / oddities:** Header says "for returns" but nothing filters returns (depends on whatever list is active); MATREADU ELSE GO 5 conflates not-found and locked; RAW "Y" suffix convention is undocumented; mixed money units between branches.

## BLD.IVMST.PW

**Mode:** Outbound-generator · **Lines:** 44 · **Relevance:** PRODUCT, PRICING

Builds a tab-delimited product price list (product, description, member price, multiple, status, UPC) for Photoware users into PWDB record 'IVMST.PW'.

**Files:** reads IVMST, CONTROL (opened) · writes PWDB ('IVMST.PW')  
**Calls:** none (EXECUTE SEND_PWDB commented out); INCLUDE IVMST.FIELDS

| ID | Rule | Source | Tag |
|---|---|---|---|
| BLD.IVMST.PW.01 | Only products with IVMST attr 36 DISPLAY ≠ "N" are exported (06-09-08) | L6, L20 | KEEP |
| BLD.IVMST.PW.02 | Member price = ROUND(NET.1 (attr 8, cents) × (1000 + SCH.PCT) / 1000), i.e. surcharge percentage stored in tenths of a percent (SCH.PCT via include; IVMST dict attr 12 = PCT) | L28-29 | KEEP |
| BLD.IVMST.PW.03 | Price exported in cents (MD2 conversion commented out); description tabs replaced by spaces | L26, L30 | QUESTION |
| BLD.IVMST.PW.04 | Tab-delimited file staged as a PWDB record (07-02-08 replaced XML) | L5, L18, L31-41 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Price unit (cents) differs from BLD.IVMST.XML (dollars) for the same feed; surcharge formula differs from AUTO.ORDER's string-concatenated multiplier for single-digit or 3-digit PCT values.

## BLD.IVMST.XML

**Mode:** Outbound-generator · **Lines:** 46 · **Relevance:** PRODUCT, PRICING

Earlier XML version of the Photoware product/price feed into PWDB 'IVMST.XML'.

**Files:** reads IVMST, CONTROL ('XML.HEADER') · writes PWDB ('IVMST.XML'), CONTROL (default XML header if missing)  
**Calls:** none (SEND_PWDB commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| BLD.IVMST.XML.01 | Same selection (DISPLAY ≠ "N") and price formula ROUND(NET.1 × (1000 + SCH.PCT)/1000) as BLD.IVMST.PW, but price output in dollars (MD2) | L22, L29-31 | KEEP |
| BLD.IVMST.XML.02 | XML layout (INVENTORY/DETAIL with Product, Description CDATA, Cost, optional Multiple/Status/UPC) staged in PWDB | L20, L32-43 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Superseded 07-02-08 by BLD.IVMST.PW; literal "- " prefixes before tags make the XML invalid.

## BUILD.IVCAT

**Mode:** Utility/maintenance · **Lines:** 24 · **Relevance:** PRODUCT

Builds the IVCAT UPC→product cross-reference by generating a PRO UPC for every IVMST product (2002).

**Files:** reads IVMST · writes IVCAT  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| BUILD.IVCAT.01 | Hard-coded UPC prefix "0291440" + PRO product number + UPC-A check digit (odd positions ×3 + even, check = round-up-to-10 − total) | L11-21 | QUESTION |
| BUILD.IVCAT.02 | IVCAT key = generated UPC, attr 1 = product | L22 | OBSOLETE |

**Bugs / oddities:** Generates PRO UPCs for all products including vendor-branded ones (BUILD.UPC later restricted this); product numbers longer than 4 digits produce over-length UPCs; check digit only uses 11 positions.

## BUILD.UPC

**Mode:** Utility/maintenance · **Lines:** 28 · **Relevance:** VENDOR, PRODUCT

Assigns PRO-prefix UPCs to IVMST products that have none and records them in IVCAT (02-21-02).

**Files:** reads IVMST · writes IVMST (attr 29 UPC), IVCAT  
**Calls:** EXECUTE SELECT IVMST WITH NO UPC

| ID | Rule | Source | Tag |
|---|---|---|---|
| BUILD.UPC.01 | Only products with no UPC (IVMST attr 29) | L9 | KEEP |
| BUILD.UPC.02 | Hard-coded vendor 992: its products are skipped unless IVMST attr 4 DESC starts with "PRO" (PRO private label) | L4, L12 | QUESTION |
| BUILD.UPC.03 | UPC = "0291440" + product number + UPC-A check digit; written to IVMST attr 29 and IVCAT (key UPC → product) | L13-26 | QUESTION |

**Bugs / oddities:** Products from vendors other than 992 with no UPC also get a PRO UPC (only 992 is filtered); over-length UPCs for 5+ digit products.

## CASE.CTN

**Mode:** Interactive · **Lines:** 13 · **Relevance:** PRODUCT

Manually maintains a product's case and carton pack quantities.

**Files:** reads IVMST · writes IVMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CASE.CTN.01 | IVMST attr 27 CASE and attr 33 CARTON quantities entered per product with no validation | L9-11 | KEEP |

**Bugs / oddities:** Exit test ID[1,3]='E' only matches exactly "E"; blank entry wipes existing values; non-numeric accepted.

## COPY.UPC

**Mode:** Utility/maintenance · **Lines:** 13 · **Relevance:** PRODUCT

One-off copy of IVMST attr 29 UPC into attr 51 W.UPC/EAN for a select list.

**Files:** reads IVMST · writes IVMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| COPY.UPC.01 | IVMST attr 51 (W.UPC / EAN) = attr 29 UPC | L7 | OBSOLETE |

**Bugs / oddities:** Uses default-file OPEN/READU syntax with the record ID as file; overwrites any existing EAN.

## COPYWD

**Mode:** Outbound-generator · **Lines:** 7 · **Relevance:** PRODUCT, PO

Copies working files to web-data copies (IVMST.WD, IVDISC.WD, IVORD.WD, SCANORD.WD) for the member website.

**Files:** reads IVMST, IVMST.DISC, IVORD, SCANORD · writes IVMST.WD, IVDISC.WD, IVORD.WD, SCANORD.WD  
**Calls:** EXECUTE COPY, SSELECT SCANORD

| ID | Rule | Source | Tag |
|---|---|---|---|
| COPYWD.01 | Full overwrite copies of product master, discontinued products and open orders to web files | L2-4 | OBSOLETE-INTEGRATION |
| COPYWD.02 | SCANORD lines copied only when UPLOAD < 15, product ≠ 9999 (hard-coded pseudo-product) and qty shipped > 0 (UPLOAD meaning unclear) | L5-7 | QUESTION |

**Bugs / oddities:** `EXECUTE 'Y'` answers a prompt blindly; SCANORD copy does not overwrite-delete stale web rows.

## COUNTRY

**Mode:** Subroutine · **Lines:** 18 · **Relevance:** PRODUCT

Translates country-of-origin codes to country names using CONTROL 'COO'.

**Files:** reads CONTROL ('COO') · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| COUNTRY.01 | Country name = CONTROL 'COO' attr 2 at the position of the code in attr 1; unknown code → blank; multivalued in/out | L8-16 | KEEP |

**Bugs / oddities:** Opens and reads CONTROL on every call; CHAIN ABORT on missing COO from inside a subroutine.

## DH1

**Mode:** Batch · **Lines:** 61 · **Relevance:** PRODUCT, PO

1985 suggested-order calculator: for a product group, computes reorder quantity from monthly sales history and writes it to ORDER file.

**Files:** reads IVMST, CONTROL ('UPD') · writes ORDER (optionally CLEARFILE)  
**Calls:** EXECUTE SSELECT IVMST WITH GRP

| ID | Rule | Source | Tag |
|---|---|---|---|
| DH1.01 | Months of history = CONTROL 'UPD' attr 2; reduced by 1 if not current month or day < 20; abort if 0 | L10-15 | QUESTION |
| DH1.02 | Skip product if IVMST attr 2 (dict ORD.QTY/QO; used here as order multiple "QUAN") < 1 or attr 15 STATUS > 0 | L24-25 | QUESTION |
| DH1.03 | Trend factor = (avg nonzero monthly this-year attr 17 MORD) / (avg nonzero last-year attr 18 MPYR); if no last-year sales, AMT = INT(months_supply * this-year avg) | L26-43,L36 | QUESTION |
| DH1.04 | Projected need = sum of last-year months following current month for N months supply (wrapping into attr 17), half month subtracted if fractional supply, times trend | L44-52 | QUESTION |
| DH1.05 | Order = need - SUM(attr 24 QTY.REC) - SUM(attr 21 PO.QTY) + attr 3 REQ, rounded to nearest multiple of attr 2; skip if < 10 | L53-55 | QUESTION |

**Bugs / oddities:** L14 says wait 10-@DAY days but the test is @DAY<20; attr 2 usage conflicts with dict name ORD.QTY; HALF logic L51 likely wrong (I=B+1 after loop). Likely OBSOLETE overall (1985).

## ENTER.HST

**Mode:** Interactive · **Lines:** 17 · **Relevance:** PRODUCT

Quick entry of harmonized tariff (HS) codes onto products.

**Files:** reads/writes IVMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| ENTER.HST.01 | HS code must match 4N.2N.4N (e.g. 9006.59.0000) and is stored in IVMST attr 53 HS.CODE | L12-13 | KEEP |

**Bugs / oddities:** L8 `PROD[1.1]` typo (should be [1,1]) so E may not exit.

## FIX.MON.ORDERS

**Mode:** Utility/maintenance · **Lines:** 23 · **Relevance:** PRODUCT

One-off (2007) correction moving monthly order history value 12 into value 9 of IVMST attr 17 MORD, backing up the old value to TEMP.

**Files:** reads/writes IVMST, TEMP  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.MON.ORDERS.01 | IVMST attr 17 MORD<1,9> += MORD<1,12>; MORD<1,12> cleared (monthly order buckets by month number) | L14-19 | OBSOLETE |

## FIX.PO.CST

**Mode:** Utility/maintenance · **Lines:** 24 · **Relevance:** PO, PRODUCT

Fix-up filling missing PO cost on IVMST open-PO multivalues from IVPO.

**Files:** reads IVPO · reads/writes IVMST  
**Calls:** EXECUTE SELECT IVMST WITH PO.NUM

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.PO.CST.01 | IVMST carries a denormalized list of open POs per product (attr 20 PO.NO, 21 PO.QTY, 22 PO.CST ...); blank attr 22 filled from IVPO attr 8 COST of the matching product line | L9-17 | OBSOLETE |

**Bugs / oddities:** MATREADU no LOCKED clause; rewrites every product even if unchanged.

## FIX.UPC

**Mode:** Utility/maintenance · **Lines:** 20 · **Relevance:** PRODUCT

One-off (2007) copy of 12-digit UPCs from IVCAT cross-reference into IVMST attr 29 UPC.

**Files:** reads IVCAT · writes IVMST  
**Calls:** EXECUTE SELECT IVCAT

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.UPC.01 | IVCAT key = UPC (12N) → attr 1 PROD; for IVCAT entries with DESC LIKE "GE..." set IVMST attr 29 UPC = key | L4-13 | OBSOLETE |

**Bugs / oddities:** IVCAT dict has no DESC field (selection criteria unclear).

## INP.UPC

**Mode:** Interactive · **Lines:** 21 · **Relevance:** PRODUCT

Scan a UPC onto a product.

**Files:** reads/writes IVMST, IVCAT  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| INP.UPC.01 | UPC must be 12 or 13 digits; written to IVMST attr 29 UPC and to IVCAT (key UPC → product) | L14-17 | KEEP |

**Bugs / oddities:** Old UPC's IVCAT entry not removed when replaced; a UPC already pointing to another product is silently re-pointed.

## INP.YEN.CONV

**Mode:** Interactive · **Lines:** 18 · **Relevance:** PRICING, PO

Maintain the single yen conversion rate in CONTROL 'YEN'.

**Files:** reads/writes CONTROL ('YEN')  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| INP.YEN.CONV.01 | Yen rate stored as text ##.## (exactly 2 digits . 2 digits) in CONTROL 'YEN'; meaning/direction of the rate (e.g. yen per dollar vs dollars per 100 yen) not stated | L8-14 | QUESTION |

**Bugs / oddities:** No history/effective date/audit of rate changes.

## IV.AUTO.ORDER

**Mode:** Interactive · **Lines:** 78 · **Relevance:** PO, PRODUCT, VENDOR, PRICING

Turns the suggested-order work file ORDER (product → qty) into a vendor purchase order in IVPO and posts the open PO onto each product's IVMST PO fields.

**Files:** reads ORDER, IVMST, IVPO · writes IVPO, IVMST, ORDER (CLEARFILE), PGM.AUDIT (RECLOG, POADJ, IVCAT, CONTROL opened, unused)  
**Calls:** INCLUDE UTLBP I_GETWHO; EXECUTE SELECT ORDER

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.AUTO.ORDER.01 | PO number must be 5 digits or 5 digits + 1 letter; PO date defaults to today, MM.DD.YY, no future dates | L33-44 | KEEP |
| IV.AUTO.ORDER.02 | If PO exists in IVPO, lines are appended to it; otherwise new IVPO with attr 1 VEND = M(5) and attr 2 DATE | L49-51 | QUESTION |
| IV.AUTO.ORDER.03 | Every product in ORDER (attr 1 = qty) is added as a PO line: IVPO 6 PROD, 7 ORD.QTY, 8 COST = IVMST attr 19 RAW cost; no check that products share the PO's vendor | L63-67 | QUESTION |
| IV.AUTO.ORDER.04 | IVMST open-PO multivalues updated: attr 20 PO.NO += PO, 21 PO.QTY += qty, 22 PO.CST += RAW cost | L65-66 | SIMPLIFY |
| IV.AUTO.ORDER.05 | ORDER work file cleared after the PO is written; no PO created if ORDER is empty | L52-59 | KEEP |
| IV.AUTO.ORDER.06 | Program start logged in PGM.AUDIT 'IV.AUTO.ORDER' (date, time, user, message) | L29,L72-77 | SIMPLIFY |

**Bugs / oddities:** New PO vendor taken from M(5) before any IVMST read (M is blank) so new POs get no vendor (L50); products missing from IVMST silently skipped; duplicate products not merged.

## IV.DSP.PROD

**Mode:** Interactive · **Lines:** 310 · **Relevance:** PRODUCT, VENDOR, PRICING, PO

Read-only product inquiry screen (copied from product maintenance in 2004) showing master data, costs/prices, groups, vendors, stock/PO figures and monthly order/shipment history vs prior year.

**Files:** reads IVMST, IVMST.<prior yy>, IVCAT, IGROUPS, EGROUPS, VNMST, APMST, CONTROL ('UPD','COO'), SCREENS ('IV.DSP.PROD', '.PRMTS') · writes none  
**Calls:** EDIT.LINE, DRAW.BOX; INCLUDE FILE.INCLUDES *.FIELDS (field numbers come from includes not present in the extract)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.DSP.PROD.01 | Product may be looked up by product #, UPC or catalog # via IVCAT (key → product) | L102-104,L132 | KEEP |
| IV.DSP.PROD.02 | Prior-year comparisons read yearly snapshot file IVMST.<yy> for last year; if the system month (CONTROL 'UPD' attr 2) is still 12 in calendar January, use the year before (year-end not yet run) | L34-45 | SIMPLIFY |
| IV.DSP.PROD.03 | RAW.COST (dict attr 19 RAW) containing 'Y' is a yen cost shown as-is; otherwise cents shown MD2 | L159-161 | QUESTION |
| IV.DSP.PROD.04 | Price fields PRICE.1/2/3, PO.COST, RETAIL, MAP displayed as cents (MD2); surcharge pct SCH.PCT in tenths of a percent (MD1) | L162-168 | KEEP |
| IV.DSP.PROD.05 | Average cost = INT(SUM(AMT.REC)/SUM(QTY.REC)+.5) (dict attrs 25/24); units on hand UOH shown as SUM(QTY.REC) | L174-179 | QUESTION |
| IV.DSP.PROD.06 | On order = SUM(QTY.ORD) + SUM(QTY.BO) (open PO qty + back-ordered) | L181 | KEEP |
| IV.DSP.PROD.07 | Product shows PRO vendor (VNMST name) and actual vendor (APMST name; actual vendor may be non-numeric/free text "until vendors are setup") | L222-233,L17 | QUESTION |
| IV.DSP.PROD.08 | Flags: DISCARD and DONOTSHIP (header: IVMST attr 46) displayed YES when = 1 | L190-195,L10 | KEEP |
| IV.DSP.PROD.09 | Country of origin code decoded through CONTROL 'COO' (attr 1 codes, attr 2 names) | L58,L201-205 | KEEP |
| IV.DSP.PROD.10 | Order history: monthly member orders MORD (attr 17) with YTD, prior-year MPYR (attr 18) with comparable-period total (months 1..current month) and full-year total | L239-251 | KEEP |
| IV.DSP.PROD.11 | Shipment history: monthly YTD (attr 13) this year vs same attr in the prior-year snapshot, comparable and full-year totals | L264-276 | KEEP |
| IV.DSP.PROD.12 | Header comment lists maintenance-side rules (PRICE.1 change prompts order update; DATE updated on PRICE.1/2/3 change; orders updated on PRO vendor change) — not implemented in this display program | L17-19 | QUESTION |

**Bugs / oddities:** DSP.GRP sets ROW instead of MROW (L215); field numbers depend on FILE.INCLUDES not in the extract; REQ/REBATE.PCT/WHSREB/WHSIPI fields mapping not verifiable here.

## IV.MNT.PROD

**Mode:** Interactive · **Lines:** 675 · **Relevance:** PRODUCT, VENDOR, PRICING, PO

Product master maintenance (add/change): descriptions, groups, PRO and actual vendor, costs, price tiers, retail/MAP, surcharge %, UPC/catalog cross-refs, pack quantities, rebate %; propagates price and vendor changes to open orders.

**Files:** reads/writes IVMST, IVCAT, CONTROL ('PID'); reads APMST, VNMST, IGROUPS, EGROUPS, GROUPS, SCREENS  
**Calls:** EDIT.LINE, DSP.REPORT, MONEY; EXECUTE RUN IV8 (reprice orders), RUN CHANGE.VNORD (vendor change on orders), SORT-LABEL; INCLUDE FILE.INCLUDES *.FIELDS (field numbers not in extract)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.MNT.PROD.01 | Lookup by product #, UPC or catalog # via IVCAT | L88-90 | KEEP |
| IV.MNT.PROD.02 | Product numbers are 4 digits; an unknown 4-digit number may be added; "A"/"N" adds with the next number | L75-106 | KEEP |
| IV.MNT.PROD.03 | New products are cloned from the last product viewed (all fields copied) except UPC and catalog # cleared | L76-86,L101-102,L5 | SIMPLIFY |
| IV.MNT.PROD.04 | Next product number from CONTROL 'PID' attr 1; skips numbers already in IVMST in steps of 7 and stores next = assigned + 7 (numbering in steps of 7 — reason undocumented) | L642-653 | QUESTION |
| IV.MNT.PROD.05 | Description required | L331-337 | KEEP |
| IV.MNT.PROD.06 | Product group must exist in IGROUPS; web group (E.GRP) must exist in EGROUPS; sub-group free text | L354-394 | KEEP |
| IV.MNT.PROD.07 | PRO vendor (IVMST VEND, dict attr 5) must exist in VNMST | L395-410 | KEEP |
| IV.MNT.PROD.08 | Actual vendor (A.VENDOR, dict attr 37) accepts any input — APMST validation disabled 6/17/03 "until vendors are setup" | L411-428,L8 | QUESTION |
| IV.MNT.PROD.09 | RAW cost (dict attr 19) entered as dollars "$$.$$" (stored cents), whole number "$$$$" stored unconverted, or yen "$$$$Y" stored with Y suffix | L429-441 | QUESTION |
| IV.MNT.PROD.10 | PO cost, PRICE.1, PRICE.2, PRICE.3, RETAIL, MAP entered in dollars via MONEY (stored cents); "\" clears | L447-458,L495-530,L554-577 | KEEP |
| IV.MNT.PROD.11 | Any change to PRICE.1/2/3 sets IVMST DATE (dict attr 11 DATE-CHG) to today; new products also get today | L138-142 | KEEP |
| IV.MNT.PROD.12 | PRICE.1 change prompts to reprice existing orders by running IV8 | L162-174 | KEEP |
| IV.MNT.PROD.13 | PRO vendor change automatically runs CHANGE.VNORD to move open vendor orders (product, old vendor) | L141,L175-181 | KEEP |
| IV.MNT.PROD.14 | Surcharge percent entered as whole number and stored x10 (tenths of a percent, displayed MD1) | L542-553 | KEEP |
| IV.MNT.PROD.15 | Special price quantity SP.QTY must be numeric or blank; PO/case/carton/multiple-order quantities and month's supply accepted without validation | L459-494,L531-541,L611-619 | SIMPLIFY |
| IV.MNT.PROD.16 | Rebate percent 1-2 digit whole number; 0 or '-' clears | L620-634 | KEEP |
| IV.MNT.PROD.17 | UPC and catalog # must be unique across products (checked in IVCAT); on save IVCAT entries written for new values and old values deleted | L144-159,L578-610 | KEEP |
| IV.MNT.PROD.18 | PRO private-label UPC: '0291440' + 4-digit product + UPC-A check digit (3x odd positions + even positions, round up to next 10) | L660-673 | KEEP |

**Bugs / oddities:** Surcharge % is multiplied by 10 on every edit including accepting the existing (already x10) value (L547); whole-number RAW cost not converted while help says dollars; non-numeric surcharge accepted; DIM IVM(50) vs IVMST attrs up to 69 (UniVerse packs overflow into element 50); DSP.GRP sets ROW not MROW; MATREADU lock held during whole edit; older than IV.DSP.PROD (no HOLD/weight/COO fields).

## IV.MNT.PROD.N

**Mode:** Interactive · **Lines:** 1116 · **Relevance:** PRODUCT, VENDOR, PRICING

Full-screen product master maintenance (newest variant, 2011+, adds DUTY and ENTRY.NO): add/repeat/change products, vendors, groups, costs/prices, UPC/catalog cross-refs, logistics and customs fields, with change logging and authority codes.

**Files:** reads IVMST, IVMST.DISC, APMST, VNMST, IGROUPS, EGROUPS, IVCAT, CONTROL ('COO','IV.MNT.PROD','PID'), SCREENS · writes IVMST, IVCAT, IVMST.LOG, CONTROL 'PID'  
**Calls:** EDIT.LINE, MONEY, DSP.REPORT; EXECUTE RUN IV8, RUN CHANGE.VNORD, SORT-LABEL. Field attribute numbers come from INCLUDE FILE.INCLUDES IVMST.FIELDS (not in extract); attr numbers below are from D_IVMST/other code where unambiguous.

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.MNT.PROD.N.01 | Access requires the login user to be listed in CONTROL 'IV.MNT.PROD' attr 1 with a matching authority code pattern in attr 2 | L70-89 | KEEP |
| IV.MNT.PROD.N.02 | Product lookup by product number, UPC or catalog no. via IVCAT | L149-152 | KEEP |
| IV.MNT.PROD.N.03 | A 4-digit product number found in IVMST.DISC (discontinued) can never be reused | L159-167 | KEEP |
| IV.MNT.PROD.N.04 | 'A'/'N' starts a blank new product; 'R' repeats the last product's data, clearing UPC, catalog no., YTD/monthly history, PO fields, stock layers, REQ, SYTD/PYTD, delete status, pick/stock locations, W.UPC, weight, dimensions | L125-148 | KEEP |
| IV.MNT.PROD.N.05 | New product number from CONTROL 'PID', stepping by 7, skipping numbers used in IVMST, IVCAT, IVMST.DISC or APMST; above 9989 wraps to 1005; counter saved as number + 7 | L1005-1036 | QUESTION |
| IV.MNT.PROD.N.06 | If no UPC entered, operator may generate a PRO UPC: '0291440' + 4-digit product + UPC-A check digit (odd positions × 3 + even, mod 10) | L214-224, L1101-1114 | QUESTION |
| IV.MNT.PROD.N.07 | UPC and catalog no. must be unique across products (IVCAT); IVCAT entries are written for new values and deleted for replaced values | L237-252, L761-794 | KEEP |
| IV.MNT.PROD.N.08 | Group must exist in IGROUPS; web group (E.GRP) must exist in EGROUPS; sub-group should be ≥ 0 (warning only) | L515-561 | KEEP |
| IV.MNT.PROD.N.09 | PRO vendor (attr 5) must exist in VNMST; actual vendor (ACT.VEND, attr 37) accepts any value — APMST validation disabled "until vendors are setup" (6-17-03) | L563-597 | QUESTION |
| IV.MNT.PROD.N.10 | RAW cost (attr 19) entered as whole cents, $$.$$ (converted to cents), or yen with 'Y' suffix | L599-616 | KEEP |
| IV.MNT.PROD.N.11 | PO.COST (attr 38) — per header comment used only by IV45 to display/print a special PO cost; PRICE.1/2/3, RETAIL, MAP entered as money (cents) | L29, L618-759 | QUESTION |
| IV.MNT.PROD.N.12 | Surcharge % (attr 12) entered as whole percent and stored ×10 (tenths of a percent) | L722-733 | KEEP |
| IV.MNT.PROD.N.13 | On update of an existing product: PRICE.1 change stamps date attr 11 value 2 and offers to re-price open orders (IV8); PRICE.2/PRICE.3 change stamps attr 11 value 1; new products get attr 11 = today | L226-231, L259-272 | KEEP |
| IV.MNT.PROD.N.14 | PRO vendor change runs CHANGE.VNORD to move open vendor orders | L230, L274-280 | KEEP |
| IV.MNT.PROD.N.15 | Special price qty (SP.QTY) whole number; month's supply whole number; rebate % 1-2 digits (0/'-' clears) | L710-821 | KEEP |
| IV.MNT.PROD.N.16 | Flags: warehouse rebate WHSREB 'N' or blank; warehouse IPI WHSIPI 'Y' or blank; DISCARD and DO-NOT-SHIP 1/blank; delete status blank/0/1/2/3 | L823-897 | QUESTION |
| IV.MNT.PROD.N.17 | Weight stored as lbs with 2 decimals; dimensions normalised to LxWxH (accepts : / space X x delimiters, up to 1 decimal) | L899-958 | KEEP |
| IV.MNT.PROD.N.18 | Country of origin must be a code in CONTROL 'COO' (single letter, e.g. C,T,H,J,K,U); HS code format ####.##.####; duty %% format #.#; customs entry no. AA#-#######-# | L960-1003 | KEEP |
| IV.MNT.PROD.N.19 | Every changed field logged to IVMST.LOG (key date*time): user, product, field name, attr, old, new, type code D=description/web desc, I=PRICE.1, V=PRICE.2, R=retail, M=MAP, N=web display | L1038-1099 | KEEP |

**Bugs / oddities:** surcharge field multiplies the input by 10 before checking EXIT/UP, and the default shown is the stored (already ×10) value — accepting/re-visiting the field multiplies the surcharge by 10 again (L727). DUTY and ENTRY.NO changes are not written to IVMST.LOG (missing from COMPARE.FLDS). IVMST.LOG key has no sequence (same-second collisions). Help text for ENTRY.NO says "HST". INP.SUB.GRP saves negative values despite the warning. ACT.VEND is free text, so "actual vendor" is unvalidated data. Product numbers capped at 4 digits (1005-9989 space).

## IV.MNT.PROD.O

**Mode:** Test-variant · **Lines:** 1088 · **Relevance:** PRODUCT, PRICING

Copy of IV.MNT.PROD.N without DUTY/ENTRY.NO fields, using screens 'IV.MNT.PROD' / 'IV.MNT.PROD.PRMTS'.

**Files:** as IV.MNT.PROD.N · writes as IV.MNT.PROD.N  
**Calls:** as IV.MNT.PROD.N

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.MNT.PROD.O.01 | No duty % or customs entry-number maintenance; otherwise identical rules (same surcharge ×10 behaviour at L721) | L52-53, L352 | OBSOLETE |

**Bugs / oddities:** confirm which of IV.MNT.PROD / .N / .O is wired into the menu.

## IV.UPD

**Mode:** Utility/maintenance · **Lines:** 11 · **Relevance:** PRODUCT, PRICING, VENDOR

One-off copy of fields from IVMST.AUX into IVMST for every product.

**Files:** reads IVMST.AUX, IVMST · writes IVMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.01 | For every IVMST.AUX record, overwrite IVMST attr 35 (AUX/WEB.DESC)=AUX 1, attr 31 (RETAIL)=AUX 3, attr 32 (MAP)=AUX 4, attr 36 (DISPLAY)=AUX 5, attr 37 (A.VENDOR)=AUX 6, attr 33 (CARTON)=AUX 8 | L3-9 | OBSOLETE |

**Bugs / oddities:** one-off fix-up script. DIM N(37) is smaller than the IVMST record; depending on flavor, attributes 38+ either land in N(37) (and are destroyed when N(37) is overwritten) or in N(0) — possible data loss. MATREADU ... ELSE RELEASE conflates locked and not-found.

## IV1

**Mode:** Interactive · **Lines:** 230 · **Relevance:** PRODUCT, VENDOR, PRICING

Original product (inventory) master add/change/delete screen for core cost and vendor fields.

**Files:** reads IVMST, VNMST, CONTROL (GRP, PROD), IVORD, VNORD · writes IVMST, CONTROL 'PROD'  
**Calls:** EXECUTE RUN IV8 (re-price orders), EXECUTE RUN CHANGE.VNORD (vendor change on orders)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV1.01 | Product numbers are exactly 4 digits for change lookup | L44 | QUESTION |
| IV1.02 | New product number taken from CONTROL 'PROD' attr 1; after add the counter is incremented by 7 | L33, L67 | QUESTION |
| IV1.03 | Required on add: description (≤30 chars, attr 4), vendor (attr 5, must exist in VNMST), product group (attr 6, must be non-blank in CONTROL 'GRP' table of 25), surcharge percent (attr 12), basic item cost (attr 8), raw cost (attr 19) | L94-205 | KEEP |
| IV1.04 | Surcharge percent attr 12 entered as whole number in tenths of a percent (60 = 6.0%) | L135-139 | KEEP |
| IV1.05 | Basic item cost attr 8 and special cost attr 9 entered in cents without decimal (MD2) | L148-164 | KEEP |
| IV1.06 | Special order quantity attr 7 is required whenever special cost attr 9 is entered and cannot be entered without a special cost; clearing special cost clears attr 7 | L157-179 | KEEP |
| IV1.07 | Multiple purchase quantity attr 16 (MOQ/MULT) must be a whole number < 100 (actually ≤100) | L184-187 | QUESTION |
| IV1.08 | Raw purchase cost attr 19 entered in cents, or in yen with a 'Y' suffix (225Y = 225 yen) | L198-205 | QUESTION |
| IV1.09 | Promotional cost attr 10 (NET.3) entered in cents, only via correction | L208-214 | QUESTION |
| IV1.10 | On save, attr 11 (DATE-CHG) = today | L66 | KEEP |
| IV1.11 | If basic cost changed on an existing product, operator is offered to re-price all open member orders (IV8) | L68-73 | KEEP |
| IV1.12 | If vendor changed, CHANGE.VNORD is run with product and old vendor to move open vendor orders | L75-79 | KEEP |
| IV1.13 | DEL deletes the IVMST record outright with no stock/order checks | L56-59 | QUESTION |

**Bugs / oddities:** delete bypasses IV15's zero-stock/zero-order checks. DIM IV(30) truncates record to 30 attributes on MATWRITE (fields 30+ lumped/at risk). MATREADU ELSE conflates locked/not found. Multiple-qty check allows 100 though message says less than 100.

## IV15

**Mode:** Interactive · **Lines:** 50 · **Relevance:** PRODUCT, PO

Delete a product (archive to IVMST.DISC) or suspend it (IVMST status attr 15).

**Files:** reads IVMST · writes IVMST, IVMST.DISC  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV15.01 | Hard delete allowed only when SUM(attr 21 PO.QTY on vendor order)=0, SUM(attr 24)=0 (stock; dict calls attr 24 QTY.REC) and attr 3 REQ (member orders)=0 | L17-24 | KEEP |
| IV15.02 | On delete, set attr 11 (DATE-CHG) to today, write the whole record to IVMST.DISC, then delete from IVMST (discontinued archive) | L27-30 | KEEP |
| IV15.03 | Suspend: if attr 15 STATUS already 1 offer re-instate (set 0) | L36-43 | KEEP |
| IV15.04 | Suspend status codes written to attr 15: 3 = vendor orders+stock+member orders all zero; 2 = no vendor orders/stock but member orders exist; 1 = otherwise. Per screen text, suspended products accept no orders exceeding available units and are removed at year end | L7-12, L44-48 | QUESTION |

**Bugs / oddities:** L24 condition "A AND B AND M(3)=0 OR M(3)=''" — operator precedence means a product with blank REQ is deleted even if stock/vendor orders are non-zero. Re-instate at L39 writes 0 then falls through and re-suspends (L44-48), so re-instate never sticks. "NO" at the ELSE branch L31 jumps to L7 with OK=0, which just prints NO DELETION. DIM M(30) truncates the record (attrs 30+ lumped) before archiving.

## IV16

**Mode:** Interactive · **Lines:** 54 · **Relevance:** PRODUCT

Merge one product's sales history into another product, archive and delete the old product, and re-point IVSOLD sales to the kept product.

**Files:** reads IVMST, IVSOLD · writes IVMST, IVMST.DISC, IVSOLD  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV16.01 | Product to delete must have zero vendor-order qty (SUM attr 21), zero stock (SUM attr 24) and zero member orders (attr 3) | L21-25 | KEEP |
| IV16.02 | Add the old product's 12 monthly buckets into the kept product for attr 13 (YTD), attr 17 (MORD) and attr 18 (MPYR); zero results are blanked | L26-32 | KEEP |
| IV16.03 | Old product archived to IVMST.DISC with attr 11 = today, then deleted from IVMST | L34-36 | KEEP |
| IV16.04 | In every IVSOLD record, move old product's quantity (value list attr 2) to the kept product (insert sorted in attr 1 if missing) and remove the old product entry | L37-51 | KEEP |

**Bugs / oddities:** no locking on IVMST/IVSOLD writes; full scan of IVSOLD per merge. DIM 30 truncation risk on MATWRITE. Uses attr 13 as monthly multivalue, while brief names attr 13 YTD-SHIP — confirm structure.

## IV22

**Mode:** Interactive · **Lines:** 15 · **Relevance:** PRODUCT

Edit the deletion date (attr 11) of a discontinued product in IVMST.DISC.

**Files:** reads IVMST.DISC · writes IVMST.DISC  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV22.01 | IVMST.DISC attr 11 holds the deletion date; operator can overwrite it with an MM.DD.YY date | L7-13 | SIMPLIFY |

**Bugs / oddities:** L10 uses DATE[1.1] (decimal, not comma) so 'E' to exit never works as intended.

## I_IVMNT_COMMON

**Mode:** Subroutine · **Lines:** 17 · **Relevance:** PRODUCT

Large COMMON block shared by the product-maintenance (IV.MNT.PROD*) programs: the product record R(150), screen state, file handles and many working variables.

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_IVMNT_COMMON.01 | Product record held as R(150) with V(150) shadow plus OLDVEND/OLDGRP/OLDUPC/OLDBRND/HLDVEND/HLDGRP "before" values used to detect vendor/group/UPC/brand changes in maintenance | L5, L15-17 | SIMPLIFY |

## I_READ_IVCAT

**Mode:** Subroutine · **Lines:** 15 · **Relevance:** PRODUCT

Include that resolves a scanned/entered value (catalog no./UPC) to a PRO product number via the IVCAT cross-reference.

**Files:** reads IVCAT · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_READ_IVCAT.01 | Product lookup: IVCAT<PRODUCT> attr 1; if not found and length < 10 treat input as product number; else try PRODUCT[2,10], [2,12], [1,10], [1,11] (strips UPC check/leading digits); else leave unchanged | L2-14 | SIMPLIFY |

**Bugs / oddities:** substring fallbacks can match the wrong product if a truncated code collides with another key.

## MAX

**Mode:** Utility/maintenance · **Lines:** 8 · **Relevance:** PRODUCT

One-off load copying MAXLEVEL attr 1 into IVMST attr 34 for every MAXLEVEL key.

**Files:** reads MAXLEVEL · writes IVMST attr 34  
**Calls:** EXECUTE SSELECT MAXLEVEL

| ID | Rule | Source | Tag |
|---|---|---|---|
| MAX.01 | IVMST attr 34 (dict name MOS — purpose unclear, possibly max/stock level) overwritten from MAXLEVEL attr 1 without validation | L5-6 | OBSOLETE |

**Bugs / oddities:** no check that product exists in IVMST — WRITEV creates stub IVMST records for unknown keys.

## ORDUP1

**Mode:** Utility/maintenance · **Lines:** 22 · **Relevance:** PRODUCT, PO

Cleans ORDDUE (product due-date file) and prints a list of out-of-stock products lacking a due date so buyers can enter new dates.

**Files:** reads IVMST, ORDDUE · writes ORDDUE (deletes)  
**Calls:** EXECUTE SELECT/SORT IVMST, SELECT ORDDUE, TERM

| ID | Rule | Source | Tag |
|---|---|---|---|
| ORDUP1.01 | Delete ORDDUE records for products now in stock (IVMST INSTK="YES" with DDATE) | L9-11 | KEEP |
| ORDUP1.02 | Delete ORDDUE records whose DUE date <= today (past due dates are dropped, not escalated) | L13-15 | QUESTION |
| ORDUP1.03 | Report: IVMST group >= "1", not in stock, no due date, and F14 not "N", by group/description, showing net available and open PO number/qty/date | L19 | KEEP |

**Bugs / oddities:** ORDUP1.01 selects IVMST IDs and deletes the same IDs from ORDDUE (assumes same key). INSTK/DDATE/F14/NET.AVAIL are dictionary I-types not visible in D-type extract.

## PRO.LBL

**Mode:** Report/print · **Lines:** 24 · **Relevance:** PRODUCT

Prints small 4-across product labels (product # + description) in quantities from the ORDER work file, descriptions from FILTERS.

**Files:** reads ORDER, FILTERS · writes none  
**Calls:** EXECUTE SETPTR, SSELECT ORDER, RESETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRO.LBL.01 | Label count per product = ORDER attr 1 (QUAN); description = FILTERS attr 4, else "***MISSING***" | L11-17 | WAREHOUSE-ONLY |

**Bugs / oddities:** FILTERS appears to be a filter-product description file (1990); purpose of FILTERS vs IVMST unclear.

## REBUILD.MSALES

**Mode:** Utility/maintenance · **Lines:** 27 · **Relevance:** PRODUCT

Rebuilds MSALES (per-product quantity and sales dollars) by accumulating ARHIST invoice lines from an active select list.

**Files:** reads ARHIST · writes MSALES  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| REBUILD.MSALES.01 | MSALES keyed by product: attr 1 += ARHIST QUAN (attr 3), attr 2 += AMOUNT (attr 4, cents; dict calls attr 2 TCOST) | L12,19-22 | QUESTION |
| REBUILD.MSALES.02 | Products > 9989 (non-merchandise/system codes) excluded | L17 | QUESTION |

**Bugs / oddities:** does not clear MSALES first — rerun double counts; relies on caller's select list; READU lock held until next WRITE (fine). MSALES dict labels attr 2 TCOST but program stores sales amount.

## SET.DISCARD

**Mode:** Utility/maintenance · **Lines:** 11 · **Relevance:** PRODUCT

Operator marks products as discontinued by setting IVMST attr 41 (DISCD) = 1.

**Files:** reads IVMST · writes IVMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| SET.DISCARD.01 | For an entered product, show the description (attr 4). On a blank confirmation, set IVMST attr 41 DISCD = 1. Any other answer does nothing. There is no audit, no un-set path, and no date. | L5-9 | SIMPLIFY |

**Bugs / oddities:** The header says "DISCARD status", but the dict calls attr 41 DISCD (DC). Confirm whether it means discard or discontinued. A blank Enter confirms, which is easy to trigger by accident.

## UPC.CODE

**Mode:** Utility/maintenance · **Lines:** 23 · **Relevance:** PRODUCT

Calculates the full UPC-A for a PRO 4-digit product code using PRO's UPC manufacturer prefix.

**Files:** none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPC.CODE.01 | Hard-coded UPC prefix '0291440' (PRO's GS1 company prefix, by inference). PRO private-label UPC = '0291440' + 4-digit product code + check digit. | L9 | QUESTION |
| UPC.CODE.02 | Check digit = standard UPC-A mod-10: 3 x (sum of odd positions 1,3..11) + (sum of even positions 2..10), then (10 - total mod 10) mod 10 | L10-19 | KEEP |

**Bugs / oddities:** The input is not validated as exactly 4 digits. A longer or shorter code shifts positions and gives a wrong UPC.

## UPD.IVMST.LCOST

**Mode:** Utility/maintenance · **Lines:** 35 · **Relevance:** PRODUCT, PRICING

Sets every product's IVMST LAST.COST (attr 28) to the unit cost of its most recent receipt.

**Files:** reads IVMST · writes IVMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.IVMST.LCOST.01 | LAST.COST (attr 28) = INT(last AMT.REC (attr 25) / last QTY.REC (attr 24) + 0.5), taking the last value in each multivalued list as the most recent receipt (same units as AMT.REC, presumably cents) | L27-31 | KEEP |
| UPD.IVMST.LCOST.02 | If the last receipt qty <= 0 (or there are no receipts), LAST.COST is overwritten with blank, which erases any previous last cost | L29-31 | QUESTION |

**Bugs / oddities:** The open-error message says UPD.IVMST.RAW (copy-paste). ERR is set to 1 before the lock loop, so the screen line is always cleared.

## UPD.RAW

**Mode:** Utility/maintenance · **Lines:** 14 · **Relevance:** PRODUCT, PRICING

Bulk-loads IVMST RAW cost (attr 19) from a staged TEMPDATA file keyed by product.

**Files:** reads TEMPDATA · writes IVMST  
**Calls:** EXECUTE SSELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.RAW.01 | For every TEMPDATA record (key = product), IVMST attr 19 RAW cost = TEMPDATA attr 1. There is no validation, no check that the product exists (WRITEV creates a stub record), no audit and no DATE-CHG update. Units follow whatever was loaded. | L7-13 | QUESTION |
| UPD.RAW.02 | Staging via a generic TEMPDATA file loaded outside BASIC | L4, L7 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** READU on TEMPDATA is never released (locks accumulate until the program ends). A non-existent product creates a stub IVMST record.

## UPD.UPC

**Mode:** Utility/maintenance · **Lines:** 14 · **Relevance:** PRODUCT

Copies UPCs from the IVCAT cross-reference into IVMST attr 29 (UPC).

**Files:** reads IVCAT · writes IVMST  
**Calls:** EXECUTE SELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.UPC.01 | IVCAT entries whose key is exactly 12 digits are treated as UPCs. The product they point to (IVCAT attr 1) gets IVMST attr 29 UPC = that key. When a product has several 12-digit aliases, the last one processed wins (unordered SELECT). | L5-12 | QUESTION |

**Bugs / oddities:** 13-digit EAN and 14-digit GTIN aliases are ignored. A non-existent product creates a stub IVMST record.

## UPDATE.UPC

**Mode:** Utility/maintenance · **Lines:** 8 · **Relevance:** PRODUCT

One-off that copies IVMST UPC (attr 29) into W.UPC (attr 51, warehouse UPC/EAN) for an active select list.

**Files:** reads/writes IVMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPDATE.UPC.01 | IVMST attr 51 W.UPC = attr 29 UPC for selected products. This establishes that the warehouse-scan UPC defaults to the catalog UPC. | L4-6 | OBSOLETE |

## WHSE.DUE

**Mode:** Interactive · **Lines:** 28 · **Relevance:** PRODUCT, PO

Records the expected inbound shipment (due-in) date for a product in ORDDUE.

**Files:** reads IVMST · writes ORDDUE  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| WHSE.DUE.01 | The product must exist in IVMST. The due date (MM.DD.YY) must be after today. A date 180+ days out gets a warning only. | L11-19 | KEEP |
| WHSE.DUE.02 | ORDDUE `<product>` attr 1 = due date (internal). There is one date per product (not per PO) and it overwrites the previous date. | L23-25 | QUESTION |

**Bugs / oddities:** Not linked to any PO, so it is a manual expected date.
