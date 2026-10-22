# Vendors — Computyme programs and rules

10 programs, 26 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## AR17

**Mode:** Utility/maintenance · **Lines:** 27 · **Relevance:** VENDOR

Fills IVEND attrs 4/5 with each member's combined amount and surcharge for vendors 195 and 279.

**Files:** reads IVEND · writes IVEND  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR17.01 | Hard-coded vendors 195 and 279: IVEND attr 4 (F4) = sum of AMOUNT (attr 2) and attr 5 (F5) = sum of SURCHG (attr 3) for those two vendors | L1, L16-24 | QUESTION |

**Bugs / oddities:** LOCATE BY 'AR' assumes IVEND attr 1 vendor list sorted; unlocked MATREAD then MATWRITE; OPEN failure doesn't stop.

## IV2

**Mode:** Interactive · **Lines:** 191 · **Relevance:** VENDOR, PRICING

Add or change a PRO vendor (VNMST) linked to an AP vendor (APMST) with surcharge and billing-guarantee settings.

**Files:** reads VNMST, APMST, VNIDX, CONTROL 'VEND' · writes VNMST, VNIDX, CONTROL 'VEND'  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV2.01 | New vendor number from CONTROL 'VEND' attr 1; counter incremented by 3 after each add | L32, L177 | QUESTION |
| IV2.02 | Hard-coded skipped vendor numbers 272, 713, 839, 902, 965 (if next number is one of these add 3) | L12, L33 | QUESTION |
| IV2.03 | A new vendor must first exist in APMST; name, address, city/state, zip, phone are copied from APMST attrs 1,3,4,5,6,7 | L65-69 | KEEP |
| IV2.04 | One APMST vendor may link to only one PRO vendor: VNIDX holds two-way index (vendor→APID and APID→vendor); duplicate rejected | L70-71, L175-176 | KEEP |
| IV2.05 | VNMST attr 12 APID = linked AP vendor | L172 | KEEP |
| IV2.06 | Validations: name 1-25 chars, name2 ≤25, street 1-25, city/state 1-22, zip exactly 5 digits, phone NNN-NNN-NNNN | L76-124 | SIMPLIFY |
| IV2.07 | Surcharge percent attr 8 stored in tenths of a percent (verify shows NI/10) | L127-137 | KEEP |
| IV2.08 | Surcharge type attr 6 (CODE), required when surcharge ≠ 0: 1 = surcharge rebated by vendor, 2 = surcharge added to vendor invoice | L139-151 | KEEP |
| IV2.09 | Vendor billing guarantee attr 13: 0 = none, 1 = vendor guarantees member billing | L153-165 | QUESTION |

**Bugs / oddities:** L134 rejects input that matches '0N.0N' — since plain integers like "60" also match 0N.0N? (0N.0N requires a dot) fine, but any non-numeric passes NUM check failing; zip validation forces 5 digits (no Canadian/ZIP+4). On a new vendor, zip-code '-' at L109 goes back but L114 then fails the '5N' check silently looping. L38 STOPs the program entirely when the control number is already in use. Change mode allows editing name only via line 1 but APMST link cannot be changed.

## IV46.9999

**Mode:** Subroutine · **Lines:** 277 · **Relevance:** VENDOR, PO

Screen-driven entry of one-time/miscellaneous vendor details (vendor 9999) into a multivalued INFO field (IVPO attr 17) using PROMPTS 'IV46.9999' definitions.

**Files:** reads SCREENS, PROMPTS · writes none (returns INFO)  
**Calls:** DRAW.BOX, IDATE, MONEY

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV46.9999.01 | Misc vendor fields (name first; layout and validations defined in PROMPTS record, not in code) packed into INFO and stored on the PO | L26-28, L55-63 | QUESTION |

**Bugs / oddities:** generic prompt-driven form; actual fields only knowable from the PROMPTS file. 500/600 hooks empty.

## IV9

**Mode:** Report/print · **Lines:** 44 · **Relevance:** VENDOR

Prints vendor mailing labels (3-up) for up to 40 vendors in quantities that are multiples of 3.

**Files:** reads VNMST · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV9.01 | Label = VNMST attr 1 NAME, 2 NAME2, 3 STREET, 4 CITY.STATE + 5 ZIP; quantity must be a multiple of 3; max 40 vendors | L12-33 | OBSOLETE |

**Bugs / oddities:** max check at I=40 stops after 39 entries.

## RPT.VENDRA

**Mode:** Report/print · **Lines:** 36 · **Relevance:** VENDOR, PRODUCT

Displays or prints a vendor Return Authorization request (VENDRA record) as a "Defective merchandise return request".

**Files:** reads CONTROL ('P.ON','P.OFF'), VENDRA (via LIST) · writes printer  
**Calls:** P.ASSIGN.SUB; EXECUTE LIST, P.ON, P.OFF, RESETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| RPT.VENDRA.01 | Return number must be numeric (pattern 1N0N) | L12-15 | KEEP |
| RPT.VENDRA.02 | The RA document lists, per return: vendor name, actual vendor (VENDRA attr 1 AVEND), product, catalog number, description, qty (attr 4), and RAW cost and total value through dict items (RAW/VALUE are computed in the dict, not in this program) | L21-22 | QUESTION |
| RPT.VENDRA.03 | Hard-coded document heading: "DEFECTIVE MERCHANDISE RETURN REQUEST from PHOTOGRAPHIC RESEARCH ORGANIZATION" (company legal name) | L22 | QUESTION |
| RPT.VENDRA.04 | Output options are Display, Printer (P.ASSIGN.SUB) or Slave print (terminal-attached printer) | L16-34 | OBSOLETE |

## UPD.VENDRA

**Mode:** Interactive · **Lines:** 43 · **Relevance:** VENDOR, PRODUCT

Maintains the product lines of a pending vendor return authorization (VENDRA): add products, delete them, or change quantities.

**Files:** reads VENDRA, APMST, IVMST · writes VENDRA  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.VENDRA.01 | The return's vendor (VENDRA attr 1 AVEND) must exist in APMST, so AVEND is an APMST vendor id | L16-17 | KEEP |
| UPD.VENDRA.02 | Products (attr 3) are kept in ascending order with qty in attr 4. Qty 0 deletes the line. New products are inserted after confirmation. A product not in IVMST is only warned about and still allowed. | L24-41 | SIMPLIFY |
| UPD.VENDRA.03 | There is no check of SHIPPED (attr 6) or COMPLETED (attr 7). The header says "pending returns" but shipped or completed RAs can be edited. | L16-42 | QUESTION |

**Bugs / oddities:** Adding a new product and entering qty 0 deletes the existing line at the insert position (a different product). There is no audit of who changed it (attr 8 WHO not updated).

## VEND.ENT.COMP

**Mode:** Interactive · **Lines:** 15 · **Relevance:** VENDOR

Records the completion date of a vendor return (VENDRA attr 7).

**Files:** reads VENDRA, APMST · writes VENDRA  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| VEND.ENT.COMP.01 | For a VENDRA return ("hold file reference number") whose vendor (attr 1) is in APMST, the operator enters MM.DD.YY and it is stored as COMP (attr 7). There is no check that the return was shipped (attr 6) or has an RA (attr 5), and an existing date can be overwritten. | L6-14 | SIMPLIFY |

**Bugs / oddities:** Handles one record per run.

## VEND.ENT.RA

**Mode:** Interactive · **Lines:** 13 · **Relevance:** VENDOR

Records the vendor's RA number on a pending vendor return.

**Files:** reads VENDRA, APMST · writes VENDRA  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| VEND.ENT.RA.01 | VENDRA attr 5 RA = the entered RA number (up to 10 chars), with no format check or overwrite protection | L10-12 | SIMPLIFY |

## VEND.ENT.SHIP

**Mode:** Interactive · **Lines:** 14 · **Relevance:** VENDOR

Marks a vendor return as shipped today.

**Files:** reads VENDRA, APMST · writes VENDRA  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| VEND.ENT.SHIP.01 | After Y confirmation, VENDRA attr 6 SHIPPED = today. There is no check for an RA number (attr 5) before shipping. | L11-13 | QUESTION |

## VEND.RA.HOLD

**Mode:** Interactive · **Lines:** 82 · **Relevance:** VENDOR, PRODUCT

Starts a vendor return. All pending return products for a vendor are moved from VENDRET (returns holding, keyed by product) into a new VENDRA return request numbered from CONTROL 'RA'.

**Files:** reads CONTROL ('IV.INP.RETURNS','RA'), APMST, VENDRET · writes VENDRA, CONTROL 'RA', deletes VENDRET records  
**Calls:** EXECUTE SSELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| VEND.RA.HOLD.01 | Blocked while IV.INP.RETURNS is running: CONTROL 'IV.INP.RETURNS' non-empty/true means stop. The lock wait is 10 x 5 s, then the program gives up. | L17-31 | KEEP |
| VEND.RA.HOLD.02 | The vendor number must exist in APMST and be confirmed. The request date defaults to today or is entered as MM.DD.YY. | L46-54 | KEEP |
| VEND.RA.HOLD.03 | Every VENDRET record with AVEND = vendor is moved onto the return: qty = VENDRET attr 1 (QUAN/DEF, defective) + attr 2 (PKG). The VENDRET record is deleted. | L58-67 | QUESTION |
| VEND.RA.HOLD.04 | VENDRA `<CONTROL RA#>` gets attr 1 vendor, attr 2 request date, attr 3 products, attr 4 quantities. CONTROL 'RA' is incremented and the number is shown as the "Hold File Reference Number" (the vendor's own RA number is entered later in attr 5 by VEND.ENT.RA). | L69-81 | KEEP |

**Bugs / oddities:** When no VENDRET records match, an empty VENDRA is still written and an RA number is consumed. The VENDRA lock wait is unbounded. MATREADU VENDRET ELSE conflates locked and not-found (the record is skipped silently). VENDRET serial numbers (attr 3) are not carried to VENDRA.
