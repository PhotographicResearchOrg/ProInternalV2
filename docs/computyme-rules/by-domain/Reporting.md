# Reporting — Computyme programs and rules

24 programs, 123 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## 28200.RPT

**Mode:** Report/print · **Lines:** 40 · **Relevance:** PRODUCT

Builds a per-member TEMPDATA summary of quantity and amount sold for four hard-coded Olympus products from a date range of TEMPHIST (ARHIST copy).

**Files:** reads TEMPHIST (opened as ARHIST) · writes TEMPDATA (cleared first)  
**Calls:** EXECUTE CLEAR-FILE DATA TEMPDATA; EXECUTE SSELECT TEMPHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| 28200.RPT.01 | Hard-coded product list 6695, 6688, 6702, 6709 identified as "Olympus products" (header comment) | L1, L9-10 | QUESTION |
| 28200.RPT.02 | Begin/end dates must match 0N.0N.0N (MM.DD.YY); 'END'/'E' exits | L13-18 | SIMPLIFY |
| 28200.RPT.03 | Selects TEMPHIST records with VNAME = "" (purpose of VNAME unclear — no dict; appears to exclude vendor-billed/direct lines) and DATE between the two dates, sorted by member | L20 | QUESTION |
| 28200.RPT.04 | Member number = first 4 characters of the history record key | L23 | KEEP |
| 28200.RPT.05 | For each line (attr 2 PROD, attr 3 QTY, attr 4 AMOUNT per ARSHIP dict naming), accumulates qty and amount per member per product into TEMPDATA attr 2/3 by position; TEMPDATA attr 1 = product list | L25-38 | OBSOLETE |

**Bugs / oddities:** TEMPDATA is cleared on every date-range loop; line loop hard-capped at 800 and stops at first blank product; reads TEMPHIST not ARHIST despite the variable name; amount units not stated (whatever ARHIST attr 4 holds, likely cents).

## AR6

**Mode:** Utility/maintenance · **Lines:** 21 · **Relevance:** VENDOR

Rescales the ARMST "GRAPH" dictionary item (member sales bar graph) to the current largest member's sales.

**Files:** reads ARMST, BVEND · writes DICT ARMST 'GRAPH'  
**Calls:** EXECUTE CD ARMST GRAPH

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR6.01 | Member total sales for graphing = ARMST attr 9 YTD.SALES + Σ BVEND attr 2 (direct-bill vendor purchases); graph increment = max total / 70 rounded up to leading digit | L10-15 | OBSOLETE |

**Bugs / oddities:** Program rewrites a dictionary at runtime; aborts if any ARMST lacks attr 9.

## AR9

**Mode:** Report/print · **Lines:** 29 · **Relevance:** none

Prints the monthly totals report from CONTROL 'MS' and, if statements are done, resets the month cycle.

**Files:** reads CONTROL ('MS','UPD') · writes CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR9.01 | CONTROL 'MS' attrs: 1 surcharges, 2 freight, 3 receivables billed, 4 payments, 5 dues, 6 capital; Net sales = 3 − 2 − 1 − 5 − 6 (cents) | L16-22 | KEEP |
| AR9.02 | Month cycle close: if CONTROL 'UPD' attr 1 = 4 (statements printed) then MS zeroed and UPD attr 1 set to 1 (cycle: 1 open → AR4 sets 3 → AR5 sets 4 → AR9 sets 1) | L24-28 | KEEP |

**Bugs / oddities:** MS updated by many programs without consistent attribute meaning (AR.INP.PAYMNTS and AR3 add payments to attr 4; AR7 adds billing to 3); "CAPITOL" typo.

## AR9.BU

**Mode:** Test-variant · **Lines:** 29 · **Relevance:** none

Copy of AR9 run against CONTROL.BU; only differences listed.

**Files:** reads CONTROL.BU · writes CONTROL.BU  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR9.BU.01 | Net sales excludes capital subtraction (3 − 2 − 1 − 5), older formula | L20 | OBSOLETE |

**Bugs / oddities:** Backup copy; would reset CONTROL.BU cycle state.

## BLD.IVSOLD

**Mode:** Utility/maintenance · **Lines:** 70 · **Relevance:** PRODUCT

Rebuilds IVSOLD (per member: products and quantities bought this year) from ARHIST for chosen members or all ("*").

**Files:** reads ARMST, ARHIST · writes IVSOLD  
**Calls:** EXECUTE SSELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| BLD.IVSOLD.01 | Uses ARHIST lines with quantity for the current calendar year (11-15-05) and selected members ("*" = all, 08-25-10) | L5-6, L16-40 | KEEP |
| BLD.IVSOLD.02 | Products > 9989 (pseudo-products such as 9994 service charge, 9995 dues) are excluded | L60 | QUESTION |
| BLD.IVSOLD.03 | IVSOLD per member: sorted product list attr 1, qty attr 2 summed; zero totals removed; existing IVSOLD for the member is replaced | L54-67 | KEEP |

**Bugs / oddities:** Lock-wait loop never waits (no LOCKED clause); member taken from key chars 1-4 (assumes 4-digit members).

## BLD.QS

**Mode:** Utility/maintenance · **Lines:** 52 · **Relevance:** PRODUCT

One-off (08-23-10) reconciliation that builds a per-member QSTEMP record comparing quantities shipped by product from SCANORD, ARHIST and IVSOLD.

**Files:** reads SCANORD, ARHIST, IVSOLD · writes QSTEMP  
**Calls:** EXECUTE SELECT SCANORD/ARHIST/IVSOLD

| ID | Rule | Source | Tag |
|---|---|---|---|
| BLD.QS.01 | Hard-coded period: SCANORD billed orders dated ≥ 01/01/10 and ARHIST YEAR = 2010; QSTEMP attr 1 product, 2 SCANORD qty shipped (attr 3), 3 ARHIST qty (attr 3), 4 IVSOLD qty | L13-30 | OBSOLETE |

**Bugs / oddities:** Hard-coded 2010 dates; IV.QS column (4) not initialised on insert.

## BUILD.YTD.SALES

**Mode:** Utility/maintenance · **Lines:** 38 · **Relevance:** PRODUCT

Builds SALES.TEMP per product (total qty sold, number of members, description, group, E-group) from the 2005 IVSOLD archive.

**Files:** reads IVSOLD.05, IVMST · writes SALES.TEMP (cleared first)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| BUILD.YTD.SALES.01 | Per product: attr 1 Σ qty, attr 2 count of members buying, attr 3 IVMST DESC, attr 4 GRP (attr 6), attr 5 EGRP (attr 39) | L22-34 | OBSOLETE |

**Bugs / oddities:** Hard-coded archive file IVSOLD.05 despite "ytd" name.

## COMPARE.QS

**Mode:** Utility/maintenance · **Lines:** 32 · **Relevance:** PRODUCT

One-off (08-23-10) display of products in QSTEMP not present in a member's IVSOLD.

**Files:** reads QSTEMP, IVSOLD · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| COMPARE.QS.01 | Lists products in QSTEMP (from BLD.QS) missing from IVSOLD with their quantities | L12-31 | OBSOLETE |

**Bugs / oddities:** Uses QSTEMP attr 2/3 as qty although BLD.QS stores SCANORD qty in 2 and ARHIST qty in 3.

## COUNT.GRPS

**Mode:** Report/print · **Lines:** 44 · **Relevance:** PRODUCT

For a trade show, counts how many distinct E-groups each member bought in a date range (TEMPDATA).

**Files:** reads ARHIST, IVMST, IVMST.DISC · writes TEMPDATA (cleared)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ARHIST, SELECT TEMPDATA

| ID | Rule | Source | Tag |
|---|---|---|---|
| COUNT.GRPS.01 | Hard-coded member cutoff: only members < 6000; ARHIST lines with VNAME = "" (PRO-shipped, not vendor-billed) | L19 | QUESTION |
| COUNT.GRPS.02 | E-group = IVMST attr 39 EGRP, falling back to IVMST.DISC attr 39 for discontinued products; qty accumulated per E-group; count of E-groups 1-70 with qty ≥ 1 stored in TEMPDATA attr 2 | L28-42 | OBSOLETE |

**Bugs / oddities:** Blank E-group indexes value position "" (adds to value 0/1 depending on runtime); E-groups > 70 ignored; 800-line cap.

## EGRP.SALES

**Mode:** Batch · **Lines:** 45 · **Relevance:** PRODUCT

Rebuilds EGRPSLS: per-member sales totals by product e-group (IVMST attr 39 EGRP) for a date range from ARHIST.

**Files:** reads ARHIST, IVMST, IVMST.DISC · writes EGRPSLS (cleared first)  
**Calls:** EXECUTE CLEAR-FILE DATA EGRPSLS; SSELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| EGRP.SALES.01 | Selects ARHIST lines with DATE between entered dates (MM.DD.YY) and VNAME empty (i.e. excludes vendor/drop-ship lines — confirm) | L14-21 | QUESTION |
| EGRP.SALES.02 | Member = first 4 chars of ARHIST key | L27 | SIMPLIFY |
| EGRP.SALES.03 | E-group taken from IVMST attr 39 EGRP, falling back to IVMST.DISC attr 39 (discontinued products archive); lines with no e-group skipped | L32-35 | KEEP |
| EGRP.SALES.04 | EGRPSLS<member>: attr N = sum of ARHIST attr 4 (line amount; unit unclear) for e-group N; attr 75 GRPS flag per e-group; attr 76 PRODS flag per product (ARHIST attr 2 = product) | L36-38 | QUESTION |

**Bugs / oddities:** TD(76)<1,PROD>=1 uses product number as a value position (huge sparse records); DIM TD(100) breaks if EGRP > 100 or collides with 75/76; an empty record is written for key '' on the first member; OPEN failures only print and continue.

## FLYER.RPT

**Mode:** Report/print · **Lines:** 53 · **Relevance:** PRODUCT

1998 extract of member unit purchases of specific PRO-brand AF lenses and FTD flashes from IVSOLD into TEMPDATA (for a flyer/promo).

**Files:** reads IVSOLD · writes TEMPDATA (cleared first)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT IVSOLD

| ID | Rule | Source | Tag |
|---|---|---|---|
| FLYER.RPT.01 | TEMPDATA<member>: attr 1 = 9 model labels, attr 2 = units per model bucket summed from IVSOLD attr 1 product / attr 2 qty | L10,L18-51 | OBSOLETE |
| FLYER.RPT.02 | Hard-coded product 3411 counted in bucket 1 (AF 19-35) | L9,L23-47 | QUESTION |
| FLYER.RPT.03 | Hard-coded product 3425 counted in bucket 1 (AF 19-35) | L9,L23-47 | QUESTION |
| FLYER.RPT.04 | Hard-coded product 3418 counted in bucket 1 (AF 19-35) | L9,L23-47 | QUESTION |
| FLYER.RPT.05 | Hard-coded product 3915 counted in bucket 2 (AF 28-200) | L9,L23-47 | QUESTION |
| FLYER.RPT.06 | Hard-coded product 3929 counted in bucket 2 (AF 28-200) | L9,L23-47 | QUESTION |
| FLYER.RPT.07 | Hard-coded product 3922 counted in bucket 2 (AF 28-200) | L9,L23-47 | QUESTION |
| FLYER.RPT.08 | Hard-coded product 4279 counted in bucket 2 (AF 28-200) | L9,L23-47 | QUESTION |
| FLYER.RPT.09 | Hard-coded product 4195 counted in bucket 3 (AF 80-210) | L9,L23-47 | QUESTION |
| FLYER.RPT.10 | Hard-coded product 4202 counted in bucket 3 (AF 80-210) | L9,L23-47 | QUESTION |
| FLYER.RPT.11 | Hard-coded product 4188 counted in bucket 3 (AF 80-210) | L9,L23-47 | QUESTION |
| FLYER.RPT.12 | Hard-coded product 4777 counted in bucket 3 (AF 80-210) | L9,L23-47 | QUESTION |
| FLYER.RPT.13 | Hard-coded product 4013 counted in bucket 4 (AF 70-300) | L9,L23-47 | QUESTION |
| FLYER.RPT.14 | Hard-coded product 4020 counted in bucket 4 (AF 70-300) | L9,L23-47 | QUESTION |
| FLYER.RPT.15 | Hard-coded product 4006 counted in bucket 4 (AF 70-300) | L9,L23-47 | QUESTION |
| FLYER.RPT.16 | Hard-coded product 4055 counted in bucket 4 (AF 70-300) | L9,L23-47 | QUESTION |
| FLYER.RPT.17 | Hard-coded product 3894 counted in bucket 5 (AF 100-400) | L9,L23-47 | QUESTION |
| FLYER.RPT.18 | Hard-coded product 3901 counted in bucket 5 (AF 100-400) | L9,L23-47 | QUESTION |
| FLYER.RPT.19 | Hard-coded product 3908 counted in bucket 5 (AF 100-400) | L9,L23-47 | QUESTION |
| FLYER.RPT.20 | Hard-coded product 2603 counted in bucket 6 (FTD 5200) | L9,L23-47 | QUESTION |
| FLYER.RPT.21 | Hard-coded product 3222 counted in bucket 7 (FTD 5500) | L9,L23-47 | QUESTION |
| FLYER.RPT.22 | Hard-coded product 2767 counted in bucket 8 (FTD 5700) | L9,L23-47 | QUESTION |
| FLYER.RPT.23 | Hard-coded product 4237 counted in bucket 9 (FTD 7000) | L9,L23-47 | QUESTION |
| FLYER.RPT.24 | Hard-coded product 4244 counted in bucket 9 (FTD 7000) | L9,L23-47 | QUESTION |
| FLYER.RPT.25 | Hard-coded product 4251 counted in bucket 9 (FTD 7000) | L9,L23-47 | QUESTION |
| FLYER.RPT.26 | Hard-coded product 4258 counted in bucket 9 (FTD 7000) | L9,L23-47 | QUESTION |

**Bugs / oddities:** Max 800 lines per IVSOLD record; IVSOLD is cumulative (no date filter).

## FREEZA.RPT

**Mode:** Report/print · **Lines:** 47 · **Relevance:** PRODUCT

Extracts member units and dollars for 11 Freez-A-Frame products from ARHIST for a date range into TEMPDATA.

**Files:** reads ARHIST · writes TEMPDATA (cleared first)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ARHIST WITH VNAME = "" AND DATE range

| ID | Rule | Source | Tag |
|---|---|---|---|
| FREEZA.RPT.01 | Warehouse sales only (VNAME empty) between entered dates; member = first 4 chars of ARHIST key; per product sum ARHIST attr 3 (qty) and attr 4 (amount; unit unclear) | L20-41 | OBSOLETE |
| FREEZA.RPT.02 | Hard-coded Freez-A-Frame product 7976 (column 1) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.03 | Hard-coded Freez-A-Frame product 7983 (column 2) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.04 | Hard-coded Freez-A-Frame product 7990 (column 3) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.05 | Hard-coded Freez-A-Frame product 7941 (column 4) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.06 | Hard-coded Freez-A-Frame product 7948 (column 5) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.07 | Hard-coded Freez-A-Frame product 7955 (column 6) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.08 | Hard-coded Freez-A-Frame product 7962 (column 7) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.09 | Hard-coded Freez-A-Frame product 7969 (column 8) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.10 | Hard-coded Freez-A-Frame product 2536 (column 9) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.11 | Hard-coded Freez-A-Frame product 2424 (column 10) | L9-10,L31-41 | QUESTION |
| FREEZA.RPT.12 | Hard-coded Freez-A-Frame product 2431 (column 11) | L9-10,L31-41 | QUESTION |

**Bugs / oddities:** Max 600 lines per ARHIST record.

## LENS.RPT

**Mode:** Report/print · **Lines:** 33 · **Relevance:** PRODUCT

Rebuilds LENSDATA with per-member year-to-date quantity and dollars of group-1 (lens) products from all ARHIST invoices.

**Files:** reads ARHIST, IVMST, IVMST.DISC · writes LENSDATA (cleared first)  
**Calls:** EXECUTE CLEAR-FILE DATA LENSDATA, SSELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| LENS.RPT.01 | Selects ARHIST WITH VNAME="" (only invoices with no vendor name — presumably warehouse, not drop-ship; confirm) sorted by member; no date filter despite "year-to-date" title (relies on ARHIST content) | L12 | QUESTION |
| LENS.RPT.02 | Product codes >= '9000' (string compare) are skipped as non-merchandise lines | L21 | QUESTION |
| LENS.RPT.03 | Product group = IVMST attr 6 (GRP); if product not in IVMST, falls back to IVMST.DISC attr 6 (discontinued file) | L22-23 | KEEP |
| LENS.RPT.04 | Hard-coded product group '1' = lens group; accumulate QUAN (attr 3) into LENSDATA attr 1 and AMOUNT (attr 4, cents) into attr 2 per member | L24-28 | QUESTION |

**Bugs / oddities:** string compare GE '9000' means codes like '95' or alpha codes sort oddly; only first 200 lines per invoice examined (L17).

## LOWEPRO.RPT

**Mode:** Report/print · **Lines:** 41 · **Relevance:** PRODUCT

Builds TEMPDATA per member with quantity and dollars sold of four specific Lowepro product codes for an operator-entered date range.

**Files:** reads ARHIST · writes TEMPDATA (cleared first)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| LOWEPRO.RPT.01 | Hard-coded product codes 9166, 9173, 9180, 9187 (Lowepro) plus placeholder 0000 | L9-10 | QUESTION |
| LOWEPRO.RPT.02 | Date range entered MM.DD.YY (validated by pattern 0N.0N.0N); ARHIST selected WITH VNAME="" and DATE in range, by member | L13-20 | SIMPLIFY |
| LOWEPRO.RPT.03 | Per member, TEMPDATA attr 1 = product list, attr 2 = qty per product (VM-positioned), attr 3 = AMOUNT in cents per product | L31-38 | SIMPLIFY |

**Bugs / oddities:** pattern 0N accepts empty segments (e.g. '..'); writes a TEMPDATA record for every member even with no Lowepro sales.

## MEMORY.RPT

**Mode:** Report/print · **Lines:** 44 · **Relevance:** PRODUCT

Builds TEMPDATA per member with qty and dollars of eight ProMaster memory product codes for an operator date range.

**Files:** reads ARHIST · writes TEMPDATA (cleared)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| MEMORY.RPT.01 | Hard-coded product codes 9089, 9096, 9103, 9110, 9117, 9124, 9131, 9138 (ProMaster memory) | L9-10 | QUESTION |
| MEMORY.RPT.02 | Only accounts < 6000 included (hard-coded member-number range cutoff), VNAME="" invoices, date range MM.DD.YY | L20 | QUESTION |
| MEMORY.RPT.03 | Same TEMPDATA layout as LOWEPRO.RPT (attr 1 product list, 2 qty, 3 amount cents) | L31-41 | SIMPLIFY |

**Bugs / oddities:** same template as LOWEPRO.RPT/MINOLTA.RPT.

## MINOLTA.RPT

**Mode:** Report/print · **Lines:** 40 · **Relevance:** PRODUCT

Same template as LOWEPRO.RPT for four Minolta product codes.

**Files:** reads ARHIST · writes TEMPDATA (cleared)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| MINOLTA.RPT.01 | Hard-coded product codes 4475, 5883, 5092, 5099 (Minolta) | L9-10 | QUESTION |
| MINOLTA.RPT.02 | Date-range/VNAME="" selection and TEMPDATA layout identical to LOWEPRO.RPT.02-03; only first 200 invoice lines examined | L20,25 | SIMPLIFY |

**Bugs / oddities:** 200-line cap vs 800 in sibling programs.

## OLYMPUS.RPT

**Mode:** Report/print · **Lines:** 40 · **Relevance:** PRODUCT

Same template as LOWEPRO.RPT for three Olympus product codes.

**Files:** reads ARHIST · writes TEMPDATA (cleared)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| OLYMPUS.RPT.01 | Hard-coded product codes 5876, 5897, 5904 (Olympus) plus placeholder 0000 | L9-10 | QUESTION |
| OLYMPUS.RPT.02 | Selection/layout identical to LOWEPRO.RPT.02-03; 200-line cap | L20,25 | SIMPLIFY |

**Bugs / oddities:** duplicate template.

## PANA.RPT

**Mode:** Report/print · **Lines:** 37 · **Relevance:** VENDOR, PRODUCT

Builds WKDATA unit-sales totals per product for actual vendor 3121 (Panasonic) from ORDHIST over an operator date range.

**Files:** reads ORDHIST, IVMST · writes WKDATA (cleared)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ORDHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| PANA.RPT.01 | Hard-coded actual vendor number 3121 (Panasonic) | L19-20 | QUESTION |
| PANA.RPT.02 | Product qualifies when IVMST attr 37 (A.VENDOR, actual vendor) = 3121 (not PRO vendor attr 5) | L26-27 | KEEP |
| PANA.RPT.03 | WKDATA attr 1 per product = sum of ORDHIST attr 3 (ordered QUAN, not shipped qty attr 13) for ORDHIST DATE in range | L28-31 | QUESTION |

**Bugs / oddities:** uses order quantity rather than shipped quantity for "sales"; deleted orders (ORDHIST attr 15) not excluded.

## PENTAX.RPT

**Mode:** Test-variant · **Lines:** 42 · **Relevance:** PRODUCT

Copy of MINOLTA.RPT repurposed for a single Pentax ZXL product code.

**Files:** reads ARHIST · writes TEMPDATA (cleared)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| PENTAX.RPT.01 | Hard-coded product code 5119 (Pentax ZXL); 600-line cap; otherwise identical to MINOLTA.RPT | L10,27 | QUESTION |

**Bugs / oddities:** header comment still says MINOLTA (L1).

## RETURNS.BY.MEMBER

**Mode:** Report/print · **Lines:** 90 · **Relevance:** PRODUCT

Report of member returns (RETURNS.10) totalled per member, shown against the member's PROMASTER purchases as a return percentage, to the screen, a printer, or an Excel download.

**Files:** reads RETURNS.10 (+dict NET.1), IVMST, IVMST.DISC, ARMST, ARMST.OLD, ARMST2 · writes DOWNLOADS (temp, deleted)  
**Calls:** EDIT.LINE; EXECUTE SSELECT, PTERM, TERM, FT

| ID | Rule | Source | Tag |
|---|---|---|---|
| RETURNS.BY.MEMBER.01 | Returns with REASON = "3" are excluded (the meaning of reason 3 is not in the code) | L31 | QUESTION |
| RETURNS.BY.MEMBER.02 | Net return value per line comes from the RETURNS.10 dictionary I-type NET.1. The calculation lives in the dictionary, not in the program. | L16, L46 | QUESTION |
| RETURNS.BY.MEMBER.03 | Return lines are excluded from the member total when the product description (IVMST attr 4, falling back to IVMST.DISC) starts with 'FUJI' or 'PANASONIC'. This is a hard-coded vendor exclusion keyed on description text. | L48-53 | QUESTION |
| RETURNS.BY.MEMBER.04 | The denominator is the member's PROMASTER purchases (ARMST2 attr 35). Return % = INT(returns*10000/PROMASTER) shown with 2 decimals, or 0 when PROMASTER = 0. Both amounts are formatted MD2, so they are stored in cents. | L80-85 | KEEP |
| RETURNS.BY.MEMBER.05 | Member name comes from ARMST attr 1, then ARMST.OLD, then 'NO ARMST NAME' | L77-79 | SIMPLIFY |
| RETURNS.BY.MEMBER.06 | The Excel option writes `RETURNS_<port>.xls` to DOWNLOADS, transfers it with AccuTerm FT to a PC directory (default C:\DOWNLOADS), then deletes it | L19, L60-73 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** DELIM (tab) is defined but never used, so the ".xls" output is fixed-width text. The file name RETURNS.10 suggests a 2010-only file. Grand-total PCT reuses the per-member logic.

## SALES.REPORT

**Mode:** Report/print · **Lines:** 60 · **Relevance:** VENDOR

1996-vs-1997 "Vendor participation" letter per member. It lists every PRO vendor program with the member's purchases in each year and flags programs under $300.

**Files:** reads SALESDATA, ARMST, APMST.TEMP, WHSEHIST · writes printer  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| SALES.REPORT.01 | Participation threshold: a vendor program counts as "participating" when the member's current-year purchases are >= 30000 cents ($300). Below that, the line is flagged "*** > $300 in 1997 purchases!" and the participation count is reduced | L14, L40-41, L44 | QUESTION |
| SALES.REPORT.02 | Hard-coded program count: the participation count starts at 63 and the letter says "of 63 possible programs". The loop scans at most 65 vendor slots. | L19, L32, L44 | QUESTION |
| SALES.REPORT.03 | Hard-coded vendor 1728: skipped when the member has no current-year purchases with it | L37 | QUESTION |
| SALES.REPORT.04 | Hard-coded vendor 1735: skipped when the member has no current-year purchases with it | L38 | QUESTION |
| SALES.REPORT.05 | PRO warehouse purchases come from WHSEHIST (attr 1 prior, attr 2 current). The flag is raised when attr 2 < 300 (compared in dollars, unlike the vendor lines in cents). | L29-31 | QUESTION |
| SALES.REPORT.06 | Vendor name from APMST.TEMP attr 1 ("UNKNOWN" if missing) | L36 | OBSOLETE |

**Bugs / oddities:** Year-specific (1996/1997 hard-coded in headings). Money-unit inconsistency: the warehouse threshold is 300 and the vendor threshold is 30000. The flag text "> $300" actually marks purchases < $300. Skipped vendors 1728/1735 are still counted among the 63. Epson ESC/P printer codes. SALESDATA (no dict) is read as key = member, attr 1 = vendor list, attr 2 = 1997 purchases, attr 3 = 1996 purchases, in cents.

## SLS.COMPARE

**Mode:** Batch · **Lines:** 55 · **Relevance:** VENDOR

Builds SALESDATA (input to SALES.REPORT). For each member it holds the vendor list (all APMST.TEMP vendors by name) with 1997 and 1996 purchases per vendor, taken from the IVEND97/BVEND2 and IVEND96/BVEND96 summaries.

**Files:** reads APMST.TEMP, IVEND97, IVEND96, BVEND2, BVEND96 · writes SALESDATA (cleared first)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| SLS.COMPARE.01 | SALESDATA is cleared and rebuilt. Attr 1 = every vendor in APMST.TEMP sorted by name. One record per member that appears in IVEND97. | L15-26 | OBSOLETE |
| SLS.COMPARE.02 | Per vendor, the current-year value (attr 2) is taken from IVEND97 (attr 1 vendor list / attr 2 amount) when the vendor is there, otherwise from BVEND2. The prior-year value (attr 3) comes from IVEND96, otherwise BVEND96. IVEND appears to be warehouse/invoiced purchases and BVEND billed (vendor-direct) purchases, which is not stated in code. | L30-51 | QUESTION |
| SLS.COMPARE.03 | Members with 1996 activity but no 1997 IVEND97 record are omitted | L22-26 | QUESTION |

**Bugs / oddities:** Year-specific files (1996/1997). Vendor and member loops are capped at 100. Labels 40/42 clash with GO 42 inside loops (L47 jumps to label 42, which is fine, but label 42 is also an old line-number style). Units are assumed cents (SALES.REPORT formats MD2).

## TAMRON.RPT

**Mode:** Batch · **Lines:** 60 · **Relevance:** VENDOR, PRODUCT

Builds TAMDATA, which holds per-member quantity and amount sold for 24 hard-coded Tamron products, from warehouse invoices in ARHIST for a date range (vendor sales report for Tamron).

**Files:** reads ARHIST · writes TAMDATA (cleared first)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| TAMRON.RPT.01 | Only ARHIST records with VNAME = "" (warehouse product invoices, not vendor billings) and DATE in the entered MM.DD.YY range are included, by member (key ID[1,4]) | L13-23 | QUESTION |
| TAMRON.RPT.02 | For each matching product line, TAMDATA attr 2 slot n += qty (ARHIST attr 3) and attr 3 slot n += amount (ARHIST attr 4, cents). Attr 1 = the product list. | L25-58 | KEEP |
| TAMRON.RPT.03 | The Tamron product list is hard-coded (24 products). New Tamron products need a code change. | L9-10 | QUESTION |
| TAMRON.RPT.04 | Hard-coded product 3635 is Tamron slot 1 | L9, L31 | QUESTION |
| TAMRON.RPT.05 | Hard-coded product 4230 is Tamron slot 2 | L9, L32 | QUESTION |
| TAMRON.RPT.06 | Hard-coded product 3642 is Tamron slot 3 | L9, L33 | QUESTION |
| TAMRON.RPT.07 | Hard-coded product 3628 is Tamron slot 4 | L9, L34 | QUESTION |
| TAMRON.RPT.08 | Hard-coded product 4728 is Tamron slot 5 | L9, L35 | QUESTION |
| TAMRON.RPT.09 | Hard-coded product 4742 is Tamron slot 6 | L9, L36 | QUESTION |
| TAMRON.RPT.10 | Hard-coded product 4735 is Tamron slot 7 | L9, L37 | QUESTION |
| TAMRON.RPT.11 | Hard-coded product 4721 is Tamron slot 8 | L9, L38 | QUESTION |
| TAMRON.RPT.12 | Hard-coded product 3915 is Tamron slot 9 | L9, L39 | QUESTION |
| TAMRON.RPT.13 | Hard-coded product 3929 is Tamron slot 10 | L9, L40 | QUESTION |
| TAMRON.RPT.14 | Hard-coded product 3922 is Tamron slot 11 | L9, L41 | QUESTION |
| TAMRON.RPT.15 | Hard-coded product 4279 is Tamron slot 12 | L9, L42 | QUESTION |
| TAMRON.RPT.16 | Hard-coded product 4195 is Tamron slot 13 | L9, L43 | QUESTION |
| TAMRON.RPT.17 | Hard-coded product 4202 is Tamron slot 14 | L9, L44 | QUESTION |
| TAMRON.RPT.18 | Hard-coded product 4188 is Tamron slot 15 | L9, L45 | QUESTION |
| TAMRON.RPT.19 | Hard-coded product 4777 is Tamron slot 16 | L9, L46 | QUESTION |
| TAMRON.RPT.20 | Hard-coded product 4756 is Tamron slot 17 | L9, L47 | QUESTION |
| TAMRON.RPT.21 | Hard-coded product 4763 is Tamron slot 18 | L9, L48 | QUESTION |
| TAMRON.RPT.22 | Hard-coded product 4749 is Tamron slot 19 | L9, L49 | QUESTION |
| TAMRON.RPT.23 | Hard-coded product 4770 is Tamron slot 20 | L9, L50 | QUESTION |
| TAMRON.RPT.24 | Hard-coded product 4013 is Tamron slot 21 | L9, L51 | QUESTION |
| TAMRON.RPT.25 | Hard-coded product 4020 is Tamron slot 22 | L9, L52 | QUESTION |
| TAMRON.RPT.26 | Hard-coded product 4006 is Tamron slot 23 | L9, L53 | QUESTION |
| TAMRON.RPT.27 | Hard-coded product 4055 is Tamron slot 24 | L9, L54 | QUESTION |

**Bugs / oddities:** Products are hard-coded, so the list is presumably stale (1999). The date range is passed unchecked into the query. 200-line cap per invoice.

## UNIQUE.PROD.CNT

**Mode:** Report/print · **Lines:** 118 · **Relevance:** PRODUCT

Report of how many distinct products each member bought (and, in detail mode, the quantity per product) in a date range, from ARHIST invoices.

**Files:** reads ARHIST, ARMST, ARMST.OLD, IVMST · writes printer  
**Calls:** IDATE

| ID | Rule | Source | Tag |
|---|---|---|---|
| UNIQUE.PROD.CNT.01 | Date range: start date validated by IDATE with up to 999 days back. The end date must not be earlier than the start date (IDATE limit = days since start). | L20-35 | SIMPLIFY |
| UNIQUE.PROD.CNT.02 | Only ARHIST lines with QUAN > 0 and product number < 9990 count. Products 9990+ are treated as non-merchandise (charges/misc codes, by inference). | L54-55, L77 | QUESTION |
| UNIQUE.PROD.CNT.03 | Member = ARHIST key ID[1,4]. Name from ARMST attr 1, then ARMST.OLD, then 'MISSING <member>'. Members are sorted by name. | L63-72 | SIMPLIFY |
| UNIQUE.PROD.CNT.04 | Summary shows the count of distinct products per member. Detail shows each product with IVMST description and total qty. Detail is forced to Summary when displaying on screen. | L52, L93-116 | KEEP |

**Bugs / oddities:** The member is assumed to be the first 4 chars of the ARHIST key. Two members with the same name are merged into one row (LOCATE by NAME).
