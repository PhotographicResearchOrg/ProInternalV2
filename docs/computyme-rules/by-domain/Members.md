# Members — Computyme programs and rules

50 programs, 180 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## ADJ

**Mode:** Utility/maintenance · **Lines:** 9 · **Relevance:** none

Manually decrements a member's STOCK warehouse-profit figure by an operator-entered amount.

**Files:** reads STOCK · writes STOCK  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| ADJ.01 | STOCK attr 8 (WH.PROFIT) = WH.PROFIT − operator-entered amount for the entered member; no validation, no audit, units not stated (operator types raw stored units) | L4-7 | QUESTION |

**Bugs / oddities:** READV without lock then WRITEV (lost-update risk); invalid member silently re-prompts; no numeric check on amount.

## AR.SHIP.MNT

**Mode:** Interactive · **Lines:** 436 · **Relevance:** none

Maintains a member's alternate ship-to addresses (SHIPTO records keyed member*code) with UPS zone derived from ZIP.

**Files:** reads ARMST, SHIPTO, ZIPREF ('UPS', 'STATES', zip records) · writes SHIPTO (write/delete)  
**Calls:** EDIT.LINE; EXECUTE SSELECT SHIPTO; INCLUDE ARMST/SHIPTO/ZIPREF.FIELDS (not in extract)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.SHIP.MNT.01 | Member must exist in ARMST | L44-50 | KEEP |
| AR.SHIP.MNT.02 | Ship-to key = member : "*" : code; code max 2 chars, zero-padded right-justified to 2, must be unique per member | L71-92, L404 | KEEP |
| AR.SHIP.MNT.03 | Name (default = member name), Address-1 and City are required, max 25/25/15 chars, and cannot be a single repeated character | L102-140, L190-208 | KEEP |
| AR.SHIP.MNT.04 | Address line 2 is not used (input bypassed) | L136, L142-144 | OBSOLETE |
| AR.SHIP.MNT.05 | ZIP must match 5N, 5N-4, or Canadian A1A-1A1- pattern (Canadian added 09-15-11) | L5, L171 | KEEP |
| AR.SHIP.MNT.06 | UPS zone = ZIPREF 'UPS' attr 2 value at the position of the 3-digit ZIP prefix in sorted attr 1 (nearest lower prefix if not exact, first if none) | L173-175 | QUESTION |
| AR.SHIP.MNT.07 | City/State auto-filled from ZIPREF record keyed by full ZIP if present | L177-182 | KEEP |
| AR.SHIP.MNT.08 | State must be in ZIPREF 'STATES' list | L217 | KEEP |
| AR.SHIP.MNT.09 | "City, ST Zip" combined length must not exceed 25 chars | L220-223 | SIMPLIFY |
| AR.SHIP.MNT.10 | Manual UPS zone override differing from the standard zone requires re-entry to confirm (SHIP.ZONE routine) | L231-259 | QUESTION |
| AR.SHIP.MNT.11 | Delete one or all ship-tos requires typing "DELETE" | L273-282, L301-335, L392-402 | KEEP |

**Bugs / oddities:** SHIP.ZONE is unreachable (not in the 1-6 correction menu nor the new-entry flow), so manual zone override never runs; L277 deletes ADDRS1 (typo for ADDR1S); L330 missing ";" between ADDR1S and ADDR2S assignments; header says ship-to "later to be added to ARMST" while ARMST already has SHIP.STREET/SHIP.CSZ (attrs 31-32).

## AR1

**Mode:** Interactive · **Lines:** 124 · **Relevance:** none

Adds new members (auto-numbered) or changes existing member master data (name, address, credit limit, phone, mailings, dues, EIN).

**Files:** reads CONTROL ('AR'), ARMST, ZIPREF ('UPS','STATES'), STOCK · writes ARMST, STOCK, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR1.01 | New member number = CONTROL 'AR' attr 1; after adding, next number = current + 7 (member numbers step by 7) | L12, L120 | QUESTION |
| AR1.02 | New member blocked if ARMST record already has a name ("CONTROL ERROR ... IN USE") | L23 | KEEP |
| AR1.03 | Name, Name2, Street max 25 chars; City max 20; State must be a 2-char code in ZIPREF 'STATES' attr 1 | L28-70 | KEEP |
| AR1.04 | Air zone suffix appended to ARMST attr 25 (UPS zone) from ZIPREF 'STATES' attr 3 for that state | L71 | QUESTION |
| AR1.05 | ZIP must be 5 digits; UPS ground zone = ZIPREF 'UPS' attr 2 at position of ZIP's first 3 digits in sorted attr 1 (nearest lower); stored in ARMST attr 25 with air zone kept as second word | L81-85 | QUESTION |
| AR1.06 | Credit limit (ARMST attr 7 LIMIT) entered in whole dollars — decimals rejected (other money fields are cents) | L87-96 | KEEP |
| AR1.07 | Phone must be NNN-NNN-NNNN (ARMST attr 20) | L98-107 | SIMPLIFY |
| AR1.08 | "No. mailings" free-entered into ARMST attr 23 (TP/MAIL) — only via change menu; AR1A shows attr 23 is actually member type (1 = PRO, 2 = IPI), so this prompt can overwrite the member type | L109-111 | QUESTION |
| AR1.09 | Dues: answer N → ARMST attr 30 DUES = 1 (exempt flag), otherwise blank (dues charged) | L112-113 | QUESTION |
| AR1.10 | EIN stored on STOCK attr 4 EIN | L115, L119 | KEEP |
| AR1.11 | New members start with ARMST attr 27 CRED.STAT = 0 (not on credit hold) | L117 | KEEP |

**Bugs / oddities:** US-only ZIP (AR.SHIP.MNT later allowed Canadian); no lock on CONTROL 'AR' (READV/WRITEV) → duplicate numbers possible; ZIP lookup with Z=0 when prefix below first entry gives empty zone.

## AR13

**Mode:** Report/print · **Lines:** 33 · **Relevance:** none

Prints annual member stock (patronage share) letters (1986).

**Files:** reads ARMST, STOCK · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR13.01 | Letter only for members with ARMST attr 8 PREV.YR sales ≥ 1 and a STOCK record | L13-14 | OBSOLETE |
| AR13.02 | Shows prior-year surcharges = STOCK attr 1 /100, shares owned = STOCK attr 2 SHARES, shares earned = STOCK attr 3 (dict calls it PATR.BAL), total = 2 + 3 | L24-28 | QUESTION |
| AR13.03 | Policy text: "one share is earned for each $100 in surcharges" (printed text only; no calculation here) | L29 | QUESTION |
| AR13.04 | Hard-coded letterhead "Photographic Research Organization, 360 Tunxis Hill Road, Fairfield CT 06430" | L15-16 | OBSOLETE |

**Bugs / oddities:** "19":YEAR Y2K bug; STOCK attr 3 meaning conflicts with dict (PATR.BAL).

## AR14

**Mode:** Utility/maintenance · **Lines:** 18 · **Relevance:** none

Sequentially numbers ARMST/ARMST2 field 28, 29, 33, 34 or 35 from an active select list.

**Files:** reads (select list) · writes operator-named file (ARMST or ARMST2)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR14.01 | Writes 1..n into chosen field (ARMST 28 N1, 29 N2, 33 N3, 34 N4, 35 PROMASTER) in select-list order (ranking/sort sequence; purpose of N1-N4 unclear) | L9-15 | QUESTION |

**Bugs / oddities:** Prompt lists 28/29/33/34 but also accepts 35 (PROMASTER) — would overwrite PROMASTER flag with a sequence number.

## AR15

**Mode:** Utility/maintenance · **Lines:** 13 · **Relevance:** none

Calculator for member share buyout to cap holdings at a percentage of total shares.

**Files:** none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR15.01 | Buyout shares X = (member shares − 0.20 × total shares) / 0.80 — hard-coded 20% (comment: 5% per member × 4 members); original 5% formula commented out | L3-10 | QUESTION |

**Bugs / oddities:** Must edit code to change the percentage; header says 5% but live code uses 20%.

## AR16

**Mode:** Interactive · **Lines:** 34 · **Relevance:** none

Toggles a member's credit-hold status.

**Files:** reads ARMST · writes ARMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR16.01 | Credit hold stored in ARMST attr 27 CRED.STAT: 0 = OK; > 0 = on hold since that internal date; "CHANGE" toggles (sets today's date or 0) | L12, L25-30 | KEEP |
| AR16.02 | Display: past due = attrs 12+13+14 (30/60/90, cents); LIMIT shown in whole dollars; HI.CRED stored in dollars (×100 for display); BALANCE and ORDERS in cents | L13-23 | QUESTION |

**Bugs / oddities:** Mixed money units on one screen; no audit of who placed the hold.

## AR18

**Mode:** Interactive · **Lines:** 55 · **Relevance:** VENDOR

Credits members with extra surcharge income and gross purchases from direct-billing vendors (manual entry per vendor/member).

**Files:** reads APMST, ARMST, BVEND · writes ARMST, BVEND  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR18.01 | Vendor must exist in APMST; member must exist in ARMST | L20-27 | KEEP |
| AR18.02 | Gross and surcharge amounts must be numeric with NO decimal point — operator keys cents (displayed via MD2); negatives allowed to correct mistakes | L18, L30-35 | QUESTION |
| AR18.03 | ARMST attr 21 SURCHG (YTD surcharge, cents) += surcharge amount | L38 | KEEP |
| AR18.04 | BVEND per member: vendor list attr 1 (sorted), attr 2 AMOUNT += gross, attr 3 SURCHG += surcharge (new vendor inserted in sort order) | L39-47 | KEEP |

**Bugs / oddities:** Cents-without-decimal entry differs from programs using MONEY; no audit trail of who entered what.

## AR19

**Mode:** Interactive · **Lines:** 128 · **Relevance:** VENDOR, PO

Enters/edits member open direct-vendor POs (VENDORD) that count against the member's credit exposure.

**Files:** reads ARMST, APMST, VENDORD · writes VENDORD  
**Calls:** MONEY

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR19.01 | Member must exist in ARMST; vendor must exist in APMST; blank vendor reuses the previous vendor | L16-27 | KEEP |
| AR19.02 | VENDORD per member: parallel multivalues 1 VENDOR, 2 PO (sorted 'AL'), 3 DATE, 4 AMOUNT (cents), 5 BILLED | L33, L92-98 | KEEP |
| AR19.03 | Same PO + same vendor = existing entry → confirm change; same PO for a different vendor is allowed as a new entry | L33-54 | KEEP |
| AR19.04 | Date defaults to today; accepts MM.DD.YY or MM.DD | L55-65 | KEEP |
| AR19.05 | Delete removes the PO line (all 5 attrs) | L104-111 | KEEP |
| AR19.06 | (Context) ARMST dictionary I-types use VENDORD: TOT-ORD = ΣAMOUNT − ΣBILLED + ORDERS; EXCESS = that + BALANCE − LIMIT×100 (credit exposure) | dict D_ARMST | KEEP |

**Bugs / oddities:** A "change" reached via the L44-54 loop keeps ADD=1 and inserts a duplicate instead of updating; YN can be stale in that loop; BILLED (attr 5) is never set here.

## AR1A

**Mode:** Interactive · **Lines:** 120 · **Relevance:** none

Copy of AR1 for adding/changing IPI (non-PRO) members; only differences listed.

**Files:** reads CONTROL ('AR2'), ARMST, ZIPREF · writes ARMST, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR1A.01 | IPI member numbers come from separate counter CONTROL 'AR2' attr 1, stepping by 7 | L7, L116 | QUESTION |
| AR1A.02 | ARMST attr 23 = 1 marks a PRO member: such records cannot be changed here | L20 | KEEP |
| AR1A.03 | Every add/change forces ARMST attr 23 = 2 (IPI member type), overriding the "No. mailings" entry | L114 | QUESTION |
| AR1A.04 | No EIN/STOCK record for IPI members (STOCK not opened) | L3-6 | KEEP |

**Bugs / oddities:** Duplicates AR1 logic; "IPI" not defined anywhere in code; attr 23 overloaded (mailings prompt vs member type).

## AR1B

**Mode:** Interactive · **Lines:** 137 · **Relevance:** none

Copy of AR1A (05-26-11) for adding/changing Canadian affiliate members; only differences listed.

**Files:** reads CONTROL ('AR2'), ARMST, ZIPREF ('PROVINCE') · writes ARMST, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR1B.01 | Canadian members share the IPI counter CONTROL 'AR2' (step 7) | L11, L133 | QUESTION |
| AR1B.02 | Records with ARMST attr 23 = 1 (PRO) or 2 (affiliate/IPI) cannot be changed here | L42 | KEEP |
| AR1B.03 | Province must be in ZIPREF 'PROVINCE' attr 1 (13 provinces/territories listed on screen) | L16-29, L90 | KEEP |
| AR1B.04 | Postal code must match A1A-1A1 (with dash) | L31-33, L100 | KEEP |
| AR1B.05 | UPS zone (ARMST attr 25) hard-coded to 10 for all Canadian members | L101 | QUESTION |
| AR1B.06 | Every add/change sets ARMST attr 23 = 3 (Canadian member type); mailings option disabled | L131, L134 | QUESTION |

**Bugs / oddities:** Message says "PRO or AFF" for type 2 while AR1A calls type 2 IPI — naming of member types inconsistent.

## AR20

**Mode:** Interactive · **Lines:** 36 · **Relevance:** none

Adds/changes a member's permanent ship-to address on ARMST and resets the UPS zone from the ship-to ZIP.

**Files:** reads ARMST, ZIPREF ('UPS','STATES') · writes ARMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR20.01 | ARMST attr 31 SHIP.STREET (max 24) and attr 32 SHIP.CSZ = "City ST" (max 19) + " " + 5-digit ZIP; state = last 2 chars, must be in ZIPREF 'STATES' | L21-30 | KEEP |
| AR20.02 | ARMST attr 25 UPS zone replaced by the zone for the ship-to ZIP's 3-digit prefix | L32-33 | QUESTION |

**Bugs / oddities:** Zone overwrite drops the air-zone suffix that AR1 maintains in attr 25; US ZIP only; LOCATE 'AL' assumes STATES sorted while AR1 uses unsorted LOCATE.

## AR21

**Mode:** Utility/maintenance · **Lines:** 17 · **Relevance:** VENDOR

One-off 1995 conversion setting ARMST prior-year sales from old ARMST2 YTD plus BVEND2 direct-bill amounts.

**Files:** reads ARMST2, BVEND2 · writes ARMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR21.01 | ARMST attr 8 PREV.YR = INT(ARMST2 attr 9 YTD / 100) + INT(ΣBVEND2 attr 2 AMOUNT + .5) / 100 (prior-year sales include direct-billing vendor purchases) | L10-15 | OBSOLETE |

**Bugs / oddities:** Second term is not truncated to whole dollars (fractional dollars added to a whole-dollar field); READVU lock then WRITEV.

## AR8

**Mode:** Batch · **Lines:** 119 · **Relevance:** PRODUCT

Monthly dues billing for PRO and Affiliate members: creates a dues invoice per member (product 9995) and, for FotoSource-type members, an FSINV spreadsheet line and email.

**Files:** reads CONTROL ('UPD','MON','FSINV.FIELDS','FSINV.EMAIL.PARAMS','INV','MS'), ARMST, ARINV · writes IVMST (9995 desc), ARMST, ARINV, ARSHIP, FSINV, CONTROL  
**Calls:** IV.UPD.FSINV.XLS, EMAIL.FSINV; UPD.ARLOG (commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR8.01 | Not allowed while CONTROL 'UPD' attr 1 > 2 | L39 | KEEP |
| AR8.02 | Hard-coded product 9995 = dues line; its IVMST attr 4 DESC rewritten to "MONTHLY DUES FOR <month name from CONTROL 'MON'>" every run | L33, L40, L59 | QUESTION |
| AR8.03 | Billing date defaults to today; blocked if day > 25 and month = AR month (prior month not closed) | L46-57 | KEEP |
| AR8.04 | PRO and Affiliate dues amounts entered each run; values with a decimal point are ×100 (to cents), values without a decimal are taken as cents as-is | L60-70 | QUESTION |
| AR8.05 | Members with ARMST attr 30 DUES = 1 are exempt | L80 | KEEP |
| AR8.06 | Dues by member type (ARMST.TYPE via include; attr 23 per AR1A/AR1B): type 1 → PRO dues; types 2 and 3 → Affiliate dues; any other type → no dues | L81-82 | QUESTION |
| AR8.07 | Dues invoice: terms text "NET DUE 10TH", TERMS 0, AGING 0, qty 1; ARMST NEW.MON (10) and BALANCE (15) += dues; ARINV appended; ARSHIP member:INV written with DT.POSTED (attr 14) | L59, L83-98 | KEEP |
| AR8.08 | Invoice number = CONTROL 'INV' + 1 (wraps at 999999) | L87-89 | KEEP |
| AR8.09 | Type 3 members get an FSINV spreadsheet line and one email to FotoSource after the run (09-12-11) | L99-102, L114-117 | OBSOLETE-INTEGRATION |
| AR8.10 | Operator reminder: dues posted to FotoSource member accounts must be moved manually to the FS master account | L111-112 | QUESTION |
| AR8.11 | CONTROL 'MS' attr 3 (receivables) and attr 5 (dues) += total dues | L104-110 | KEEP |

**Bugs / oddities:** Member type 3 is "Canadian affiliate" in AR1B but treated as FotoSource here; L61 converts the wrong variable (DUES); dues entered without decimal ("50") billed as $0.50; MATREADU ELSE skips locked members silently; ARLOG commented out.

## BUILD.PROMASTER

**Mode:** Utility/maintenance · **Lines:** 35 · **Relevance:** PRODUCT

Computes each member's PROMASTER-brand purchases from ARHIST (2002 onward) into ARMST attr 35 PROMASTER.

**Files:** reads ARHIST, IVMST, ARMST · writes ARMST (attr 35)  
**Calls:** EXECUTE SSELECT ARHIST WITH DATE > "12.31.01" AND WITH GRP > 0

| ID | Rule | Source | Tag |
|---|---|---|---|
| BUILD.PROMASTER.01 | Hard-coded start date 12/31/01 | L8 | QUESTION |
| BUILD.PROMASTER.02 | Hard-coded product groups (IVMST attr 6 GRP) < 7, 9, 11, 15, 19 count as PROMASTER purchases (line amount ARHIST attr 4, only when qty > 0) | L22-24 | QUESTION |
| BUILD.PROMASTER.03 | Hard-coded groups 7, 8, 10, 12, 13, 14, 17 count only when IVMST attr 4 DESC starts with "PRO" (no qty check, so returns reduce) | L26-27 | QUESTION |
| BUILD.PROMASTER.04 | Hard-coded member 9990 acts as end-of-run sentinel | L11 | QUESTION |
| BUILD.PROMASTER.05 | ARMST attr 35 PROMASTER = total (cents) | L31-32 | KEEP |

**Bugs / oddities:** Without a member ≥ 9990 in the list the end-of-list path loops forever (GO 40 → GO 10 re-reads the last ID); credits treated differently between group sets; groups 16, 18 and ≥ 20 silently excluded.

## BUILD.PROMASTER.2

**Mode:** Test-variant · **Lines:** 35 · **Relevance:** PRODUCT

Copy of BUILD.PROMASTER run against ARMST2 / ARHIST.01 / IVMST2 (2001 archive files); only differences listed.

**Files:** reads ARHIST.01, IVMST2 · writes ARMST2  
**Calls:** EXECUTE SSELECT ARHIST.01 WITH GRP > 0

| ID | Rule | Source | Tag |
|---|---|---|---|
| BUILD.PROMASTER.2.01 | No date filter (whole 2001 archive) | L8 | OBSOLETE |

**Bugs / oddities:** Same infinite-loop risk as BUILD.PROMASTER.

## CHANGE

**Mode:** Utility/maintenance · **Lines:** 8 · **Relevance:** none

One-off copy of ARMST2 attr 29 into ARMST attr 29 for a select list.

**Files:** reads ARMST2 · writes ARMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CHANGE.01 | ARMST attr 29 N2 (purpose unclear) = ARMST2 attr 29 for listed members | L5-6 | OBSOLETE |

**Bugs / oddities:** Unlocked WRITEV; blanks attr 29 when ARMST2 missing.

## CHK.ARMST.NAME

**Mode:** Report/print · **Lines:** 46 · **Relevance:** none

Reports ARMST records with duplicate member names (adjacent in name sort) to the printer and ARERR.

**Files:** reads ARMST · writes ARERR  
**Calls:** EXECUTE DHPRT, SSELECT ARMST BY NAME

| ID | Rule | Source | Tag |
|---|---|---|---|
| CHK.ARMST.NAME.01 | Two members with identical NAME (attr 1) are flagged as duplicates; error logged in ARERR keyed date*time*seq | L17-45 | KEEP |

**Bugs / oddities:** Exact-match only (case/spacing variants missed).

## CR.CKS

**Mode:** Report/print · **Lines:** 13 · **Relevance:** none

Prints a full page of "X" characters on the laser printer (alignment test for customer rebate checks).

**Files:** none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CR.CKS.01 | No business logic; prints 66 lines × 90 "X" with PCL setup | L7-10 | OBSOLETE |

**Bugs / oddities:** Name suggests rebate check printing but it is only a test pattern.

## CRUPDATE

**Mode:** Interactive · **Lines:** 37 · **Relevance:** none

Updates a member's statement date (LST.STMT) or credit limit (ARMST attr 7).

**Files:** reads ARMST, LST.STMT · writes ARMST (attr 7), LST.STMT (attr 1)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CRUPDATE.01 | Credit limit (ARMST attr 7 LIMIT) entered in whole dollars; decimals rejected | L31-34 | KEEP |
| CRUPDATE.02 | LST.STMT attr 1 "statement date" stored as free text with no validation (purpose of LST.STMT unclear) | L27-29 | QUESTION |

**Bugs / oddities:** No locking; no audit of credit-limit changes; non-numeric limits accepted.

## CUST.RBT

**Mode:** Interactive · **Lines:** 114 · **Relevance:** PRODUCT, PRICING

Enters consumer rebate claims for a dealer, prints the consumer rebate check, and voids checks.

**Files:** reads ARMST, STRNAME, RBTCODES, IVMST, RBTDATA · writes RBTDATA  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CUST.RBT.01 | Entering an existing check # offers VOID: dealer value 1 set to "VOID", original date kept in value 3, date = today, amount prefixed with "-"; already-void checks rejected | L20-23, L106-113 | KEEP |
| CUST.RBT.02 | Dealer must exist in STRNAME (name override) or ARMST | L28-29 | KEEP |
| CUST.RBT.03 | Rebate code must exist in RBTCODES: attr 1 DESC, attr 2 AMOUNT (cents), attr 3 check text | L31-35, L78 | KEEP |
| CUST.RBT.04 | One or two products (must exist in IVMST); purchase date MM.DD.YY; consumer name, street, city, 2-char state, zip required | L36-65 | KEEP |
| CUST.RBT.05 | RBTDATA record keyed by check #: 1 date, 2 dealer:name, 3 code, 4 purchase date/consumer name/address, 5 amount, 6 products; check printed and check # auto-incremented | L70-104 | KEEP |

**Bugs / oddities:** Auto-incremented check # is not checked against existing RBTDATA (overwrite risk); L54 missing OR (syntax); "E" at name prompt loops instead of exiting; no AP/GL posting of rebate payments; void amount stored as string "-nnn".

## DELETE.MEMBER

**Mode:** Utility/maintenance · **Lines:** 46 · **Relevance:** none

Zeroes a member's ARMST balances and deletes the member's ARINV, BVEND, IVEND, IVSOLD detail records (keeps ARMST record).

**Files:** reads ARMST · writes ARMST, ARINV/BVEND/IVEND/IVSOLD (delete)  
**Calls:** UPD.ARLOG (commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| DELETE.MEMBER.01 | Requires Y confirmation then a hard-coded approval code 'EAGLE2' or 'FSH' | L27-33 | QUESTION |
| DELETE.MEMBER.02 | Sets ARMST attrs 10-15 (NEW.MON, CURRENT, D30, D60, D90, BALANCE) and attr 24 FUTURE to 0; ARMST and STOCK records retained | L34-38,L21 | QUESTION |
| DELETE.MEMBER.03 | Deletes member's ARINV, BVEND, IVEND, IVSOLD records (sales/vendor history wiped) | L40-43 | QUESTION |
| DELETE.MEMBER.04 | ARLOG audit call commented out despite header | L5,L39 | QUESTION |

**Bugs / oddities:** Hard-coded passwords in source; no record locking; history destruction with no audit.

## DIVD.CHK.LJ

**Mode:** Report/print · **Lines:** 80 · **Relevance:** none

Prints annual patronage dividend checks (with stub) for members in STOCK with a dividend, and records each check in APBR.

**Files:** reads STOCK, ARMST, ARMST2 · writes APBR  
**Calls:** EXECUTE SSELECT STOCK WITH DIV40 GT 0 BY NAME; TERM

| ID | Rule | Source | Tag |
|---|---|---|---|
| DIVD.CHK.LJ.01 | Dividend year must be 4 digits 1991-2050; used only in headings | L15-22 | KEEP |
| DIVD.CHK.LJ.02 | Members selected by dict item DIV40 > 0 (DIV40 definition not in this program; purpose unclear) sorted by name | L27 | QUESTION |
| DIVD.CHK.LJ.03 | Cash paid = STOCK attr 5 DIVIDEND - attr 6 PATR.CR (cents); new patronage balance shown = attr 3 PATR.BAL + attr 6 PATR.CR; stub also shows attr 1 VEND.COMM labelled "SURCHARGES" and attr 2 SHARES | L36,L47-53 | KEEP |
| DIVD.CHK.LJ.04 | Payee name/address from ARMST, falling back to ARMST2 (inactive members?) | L35 | QUESTION |
| DIVD.CHK.LJ.05 | Each check written to APBR keyed by check #: 1=member id, 2=name, 3=today, 4 GROSS=paid, 6 NET=paid; check # increments by 1 | L67-69 | KEEP |
| DIVD.CHK.LJ.06 | STOCK patronage balance is NOT updated by this program (display only) | L52 | QUESTION |
| DIVD.CHK.LJ.07 | Hard-coded bank MICR line, routing 028000121 and account number in source | L44 | QUESTION |
| DIVD.CHK.LJ.08 | Totals page (checks written, total paid) printed through the check form | L73-79 | KEEP |
| DIVD.CHK.LJ.09 | PCL/MICR check form layout | L8-10,L37-65 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Zero/negative paid amounts still print (selection is on DIV40 not PAID); totals page printed on a check stock form and also written to APBR under next check #.

## EM.1

**Mode:** Interactive · **Lines:** 17 · **Relevance:** PRICING

Enter a member's sales amount and rebate percentage to compute a vendor-rebate check amount stored in MISC.

**Files:** reads ARMST · writes MISC  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| EM.1.01 | Rebate = INT(sales amount x rebate pct); MISC attr 1 = rebate, 2 = sales amount, 3 = pct (dict names attr 1 AMOUNT, 2 CHECK, 3 A — usage conflicts); units of amount and pct (fraction vs whole %) not validated | L10-15 | QUESTION |
| EM.1.02 | Member must exist in ARMST | L9 | KEEP |

**Bugs / oddities:** No input validation; overwrites prior MISC values. Later version of ENTER.MISC.

## ENTER.MISC

**Mode:** Test-variant · **Lines:** 15 · **Relevance:** PRICING

Earlier (01/1994) version of EM.1 with a fixed rebate rate.

**Files:** reads ARMST · writes MISC  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| ENTER.MISC.01 | Rebate hard-coded at 5% of entered sales amount (INT(AMT*.05)) to MISC attr 1; amount attr 2 | L11-13 | QUESTION |

## FIX.ORDERS

**Mode:** Utility/maintenance · **Lines:** 26 · **Relevance:** none

Rebuilds ARMST attr 17 ORDERS (open-order dollars) for all members from IVORD.

**Files:** reads IVORD · writes ARMST  
**Calls:** EXECUTE SSELECT IVORD BY MEMBER

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.ORDERS.01 | ARMST attr 17 ORDERS = sum over member's IVORD records of attr 3 QUAN x attr 4 COST (cents); all members zeroed first | L6-22 | SIMPLIFY |

**Bugs / oddities:** Max 500 lines per order; 1989 program.

## FIX.SURCHG

**Mode:** Utility/maintenance · **Lines:** 90 · **Relevance:** PRICING

Recomputes a member's YTD sales, surcharge and PRO sales in ARMST from ORDHIST (selected externally) plus IVEND.

**Files:** reads ORDHIST, IVMST, IVEND · writes ARMST  
**Calls:** UPD.ARLOG (commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.SURCHG.01 | Warehouse line value = ORDHIST attr 13 QTY.SHIP x attr 4 COST (cents); surcharge embedded in price = TOT - TOT/(1000 + IVMST attr 12 PCT) x 1000 (PCT in tenths of a percent), rounded half away from zero | L57,L68-74 | KEEP |
| FIX.SURCHG.02 | Over-shipment value (shipped > attr 3 ordered) accumulated separately (ETOT) and excluded from PRO sales | L68-71,L83 | QUESTION |
| FIX.SURCHG.03 | ARMST attr 9 YTD.SALES = warehouse total + IVEND attr 2 sum; attr 21 SURCHG = warehouse surcharge + IVEND attr 3 sum; attr 26 PRO.SALES = warehouse total - overship - surcharge | L49,L83-86 | KEEP |
| FIX.SURCHG.04 | Comment says run for one account at a time with SELECT ORDHIST WITH ACCOUNT=### AND DATE GE 01/01/YEAR | L6-8 | QUESTION |

**Bugs / oddities:** ARMST zeroed per order (L49) but totals accumulate across orders and written once at end for last ARID — breaks if more than one member selected; IVMST locked but never written; ARLOG update commented out. Contrast surcharge formula with FIX.COST markup.

## HOLD_QTRRBT.CHK

**Mode:** Report/print · **Lines:** n/a (compiled object code, no source) · **Relevance:** PRICING, VENDOR

Compiled (object) version of a quarterly member rebate check print program; source is not in BP. Content below is inferred only from embedded strings.

**Files:** (strings) ARMST, VNMST, MISC, TEMPDATA · writes unknown  
**Calls:** (strings) SSELECT MISC BY NAME

| ID | Rule | Source | Tag |
|---|---|---|---|
| HOLD_QTRRBT.CHK.01 | Prints "PRO 1st QUARTER REBATE" checks from MISC sorted by name with stub lines for PRO Warehouse Rebate, PROMASTER Battery Volume Rebate, Fuji PRO Film, Fuji Quarterly Volume, Fuji Paper, Fuji Chemistry, Fuji X Series, Noritsu Parts, Nikon and Sony quarterly programs; "NQ" = not qualified for warehouse rebate; shows 2014/2013 YTD purchases and ranking | n/a (strings only) | QUESTION |
| HOLD_QTRRBT.CHK.02 | Hard-coded bank MICR data embedded in object code | n/a | QUESTION |

**Bugs / oddities:** No source available — need the source (D:\accounts\Pro_SW\BP/HOLD_QTRRBT.CHK per embedded path) to inventory rules; vendor program names and years hard-coded.

## IPI.PRO

**Mode:** Utility/maintenance · **Lines:** 87 · **Relevance:** PO

Converts an IPI/affiliate member account to a full PRO member under a new account number, moving AR and history records.

**Files:** reads CONTROL ('AR'), ARMST, ARINV, IVEND, IVSOLD, ARHIST, IVORD · writes ARMST, ARMST.OLD, ARINV, IVEND, IVSOLD, ARHIST, STOCK, VENDORD (delete), CONTROL  
**Calls:** EXECUTE SELECT IVORD/ARHIST; UPD.ARLOG (commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| IPI.PRO.01 | Hard-coded authorization code 'RALPH.C' | L26-27 | QUESTION |
| IPI.PRO.02 | Conversion blocked if member has any open IVORD orders | L31-35 | KEEP |
| IPI.PRO.03 | New PRO account number = CONTROL 'AR' attr 1; next number advanced by 7 (NEW+7) | L20,L52 | QUESTION |
| IPI.PRO.04 | ARMST copied to new account with attr 23 TP (member type) = 1; old record archived to ARMST.OLD and deleted | L45-50 | KEEP |
| IPI.PRO.05 | Member's open vendor POs in VENDORD are deleted, not moved | L24,L51 | QUESTION |
| IPI.PRO.06 | ARINV, IVEND, IVSOLD moved to new account; ARHIST re-keyed new:old-key chars 5-10 | L53-82 | KEEP |
| IPI.PRO.07 | Empty STOCK (shareholder) record created for new member; operator reminded to enter Federal Tax Number (STOCK attr 4 EIN) | L75,L84 | KEEP |

**Bugs / oddities:** IVSOLD READU sets FND=0 in both THEN and ELSE (L62), so IVSOLD is never moved and is left under the old account; ARHIST key assumes 4-char account; ARLOG commented out.

## LASER.PATR

**Mode:** Report/print · **Lines:** 59 · **Relevance:** none

Prints IRS 1099-PATR patronage dividend forms for members (shareholders) on a laser printer, 3 per page.

**Files:** reads STOCK2, ARMST2, ARMST.OLD · writes none  
**Calls:** EXECUTE SSELECT STOCK2 WITH DIVIDEND > "0"

| ID | Rule | Source | Tag |
|---|---|---|---|
| LASER.PATR.01 | Form issued for every STOCK2 record with DIVIDEND > 0; amount = STOCK2 attr 5 (MR2 → stored in cents), member TIN = STOCK2 attr 4 | L17-23 | KEEP |
| LASER.PATR.02 | Member name/address taken from ARMST2 (attr 1, 3, city from attr 4 before comma, state 5, zip 6), falling back to ARMST.OLD; skipped if in neither | L24-31 | KEEP |
| LASER.PATR.03 | Hard-coded payer: "PHOTOGRAPHIC RESEARCH ORGAN.", 360 Tunxis Hill Rd, Fairfield CT 06432, federal ID 13-1921109 | L13-16 | QUESTION |
| LASER.PATR.04 | PCL positioning: 3 forms per page, 2650 decipoint offset between forms | L10-11, L45-56 | OBSOLETE |

**Bugs / oddities:** L34 unreachable. Reads ARMST2 not ARMST — confirm which member file is authoritative.

## M1

**Mode:** Interactive · **Lines:** 39 · **Relevance:** none

Add/change/delete entries in the secondary member mailing list MLIST, auto-numbering new entries from CONTROL 'AR' attr 2.

**Files:** reads MLIST, CONTROL · writes MLIST, CONTROL ('AR' attr 2)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| M1.01 | New MLIST IDs are sequential: start from CONTROL 'AR' attr 2, +1 per added entry, counter written back on exit | L7,36,38 | SIMPLIFY |
| M1.02 | MLIST record = name, name2, street, city-st-zip; each limited to 28 chars | L25-33 | SIMPLIFY |
| M1.03 | Delete requires Y confirmation | L19-20 | KEEP |

**Bugs / oddities:** counter only written back when operator types END at the name prompt (L26,38); exiting otherwise loses the next number; no locking on CONTROL counter.

## M2

**Mode:** Interactive · **Lines:** 14 · **Relevance:** none

Operator enters the number of mailings for a member, stored on ARMST.

**Files:** reads ARMST · writes ARMST attr 23  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| M2.01 | "No. mailings" stored in ARMST attr 23 (dict names T/TP — purpose unclear beyond this program); no validation of input | L11-12 | QUESTION |

**Bugs / oddities:** READVU lock released only at next prompt; no numeric validation.

## MC.1

**Mode:** Report/print · **Lines:** 62 · **Relevance:** PRICING

Prints member rebate checks from the MISC work file, numbering checks sequentially and recording check number back on MISC.

**Files:** reads MISC, ARMST (VNMST opened, unused) · writes MISC attr 5  
**Calls:** EXECUTE SSELECT MISC

| ID | Rule | Source | Tag |
|---|---|---|---|
| MC.1.01 | MISC keyed by member: attr 1 = amount paid (cents, printed MD2), attr 2 = sales, attr 3 = pct (sales/pct read but not printed) | L25-27 | QUESTION |
| MC.1.02 | Check number = operator-entered start, +1 per check; written to MISC attr 5 | L10,31-32 | KEEP |
| MC.1.03 | Hard-coded memo text "SECOND QUARTER 1997 REBATES" on every check | L29 | OBSOLETE |
| MC.1.04 | Payee/address from ARMST attrs 1,3,4,5,6; members missing from ARMST skipped silently | L23,35-40 | KEEP |
| MC.1.05 | Final void check prints run totals (checks written, total paid) | L52-60 | SIMPLIFY |

**Bugs / oddities:** hard-coded quarter text means program was a one-off per quarter; members not on ARMST skipped with no message.

## MOVE

**Mode:** Utility/maintenance · **Lines:** 11 · **Relevance:** none

One-off copy of high-credit fields from ARMST2 into ARMST (attr 36 -> 38, attr 37 -> 37) and zeroing ARMST attr 36.

**Files:** reads ARMST2 · writes ARMST attrs 36-38  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| MOVE.01 | Year-end roll of high credit: current-year high credit (attr 36 CY.HI.CRED) moved to prior-year (attr 38 PY.HI.CRED), date attr 37 copied, current reset to 0 | L5-9 | OBSOLETE |

**Bugs / oddities:** sources from ARMST2 (backup copy), so it's a one-off repair.

## PATR.CALC

**Mode:** Utility/maintenance · **Lines:** 16 · **Relevance:** PRICING

One-year patronage dividend calculation per member in STOCK, with hard-coded totals.

**Files:** reads STOCK · writes STOCK attrs 5, 6  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PATR.CALC.01 | Dividend (attr 5) = member surcharges (attr 1, cents) / total surcharges 169751497 * total dividend 838757 (whole dollars, per comment), rounded | L8-10 | QUESTION |
| PATR.CALC.02 | Members holding > 3100 shares (attr 2) get no cash portion; otherwise patronage credit attr 6 = INT(dividend * .55) | L11-12 | QUESTION |

**Bugs / oddities:** comment "(.55 is 45%)" contradicts code (L13); hard-coded totals make this a per-year one-off; money units mixed (surcharges cents, dividend dollars — per comment L9).

## PATR.UPD

**Mode:** Utility/maintenance · **Lines:** 12 · **Relevance:** none

Year-end roll: adds patronage credit to patronage balance and zeroes credit and dividend.

**Files:** reads STOCK · writes STOCK attrs 3, 5, 6  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PATR.UPD.01 | PATR.BAL (attr 3) += PATR.CR (attr 6); attr 6 = 0; DIVIDEND attr 5 = 0 | L8-9 | KEEP |

**Bugs / oddities:** no guard against running twice (second run harmless since credit zeroed, but dividend history lost).

## PATR.WH

**Mode:** Utility/maintenance · **Lines:** 13 · **Relevance:** PRICING

Computes a 3% warehouse surcharge bonus per member into STOCK.

**Files:** reads STOCK · writes STOCK attr 8  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PATR.WH.01 | Bonus (attr 8 WH.PROFIT) = INT((attr 7 DIRECT.COMM - attr 9 PROMASTER) * 3%) | L8-10 | QUESTION |
| PATR.WH.02 | Header says "except for cameras" — only evidence is the comment; camera exclusion presumably done upstream by subtracting attr 9 (confirm) | L1 | QUESTION |

**Bugs / oddities:** dict names for attrs 7/9 (DIRECT.COMM, PROMASTER) don't obviously match "warehouse sales minus cameras"; confirm.

## PATR1099

**Mode:** Report/print · **Lines:** 57 · **Relevance:** none

Prints IRS Form 1099-PATR for each member with a patronage dividend in STOCK2.

**Files:** reads STOCK2, ARMST2, ARMST.OLD · writes none  
**Calls:** EXECUTE SSELECT STOCK2

| ID | Rule | Source | Tag |
|---|---|---|---|
| PATR1099.01 | Members with DIVIDEND (attr 5) > 0 get a 1099-PATR showing amount (cents, MR2), member EIN attr 4, name/address from ARMST2 else ARMST.OLD | L15,20-31 | KEEP |
| PATR1099.02 | Hard-coded payer: Photographic Research Organ., 360 Tunxis Hill Rd, Fairfield CT 06432, FED ID 13-1921109 | L10-13 | QUESTION |
| PATR1099.03 | Members not found in either ARMST copy are skipped with console message | L23-26 | QUESTION |

**Bugs / oddities:** label 30 (grand total form) unreachable; reads backup copies ARMST2/STOCK2 rather than live files; units of DIVIDEND here cents vs dollars in PATR.CALC comment — inconsistency.

## PENDINGRBT

**Mode:** Interactive · **Lines:** 76 · **Relevance:** PRODUCT, PRICING

Operator confirms consumer (end-customer) rebate claims submitted online (PENDRBTS), assigns a rebate check number, writes to RBTDATA and removes the pending record.

**Files:** reads PENDRBTS, RBTCODES, IVMST, STRNAME, ARMST, CONTROL ('RBTCHK') · writes RBTDATA, PENDRBTS (delete), CONTROL 'RBTCHK' attr 1  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PENDINGRBT.01 | Pending rebate keyed by web ID: attr 3 rebate code, attr 4 purchase date/name/street/city/state/zip, attr 5 amount, attr 6 products (up to 2) | L24-25 | KEEP |
| PENDINGRBT.02 | Rebate code must exist in RBTCODES; rebate amount is taken from RBTCODES attr 2 (cents), overriding the amount submitted online | L27-28 | KEEP |
| PENDINGRBT.03 | Product 1 must exist in IVMST; product 2 optional, literal 'Flash' accepted as "PROMASTER Electronic Flash" without IVMST lookup | L32,35-37 | QUESTION |
| PENDINGRBT.04 | Name, street, city, state (exactly 2 chars), zip required | L44-54 | KEEP |
| PENDINGRBT.05 | Dealer # entered by operator must exist in STRNAME (store name) else ARMST; dealer number + name stored on rebate | L55-58,66 | KEEP |
| PENDINGRBT.06 | Rebate check numbers sequential from CONTROL 'RBTCHK'; RBTDATA keyed by check number; counter saved only when operator exits with E | L19,23,71-73 | QUESTION |
| PENDINGRBT.07 | Purchase date not validated (validation commented out) | L40-43 | QUESTION |

**Bugs / oddities:** check counter not persisted until exit — crash causes duplicate check numbers; no lock on CONTROL; L36-38 IF/ELSE structure missing proper END (relies on single-line ELSE + END). Not related to vendor instant rebates.

## QTR.RBT.RPT

**Mode:** Report/print · **Lines:** 68 · **Relevance:** VENDOR, PRICING

One-off reprint of corrected 1st-quarter 1998 member rebate check stubs, breaking rebate into PRO warehouse and Konica components.

**Files:** reads MISC, ARMST (VNMST opened unused) · writes none  
**Calls:** EXECUTE SSELECT MISC

| ID | Rule | Source | Tag |
|---|---|---|---|
| QTR.RBT.RPT.01 | MISC layout here: attr 1 total paid, attr 2 check #, attr 3 PRO warehouse rebate, attr 4 Konica quarterly, attr 5 Konica annual, attr 6 Konica semi-annual, attr 7 misc rebates (all cents) | L29-37 | QUESTION |
| QTR.RBT.RPT.02 | Hard-coded vendor-specific rebate programs for Konica (quarterly, annual, semi-annual) | L32-34 | QUESTION |
| QTR.RBT.RPT.03 | Hard-coded period "1ST QUARTER 1998" and correction notice text | L10,38-39 | OBSOLETE |

**Bugs / oddities:** MISC attr layout differs from MC.1 (attr 2 = check # here vs sales in MC.1; check # written to attr 5 in MC.1) — MISC is reused as a scratch file per run; operator-entered CHKNO ignored (overwritten from M(2)).

## QTRDATA.LTR

**Mode:** Report/print · **Lines:** 54 · **Relevance:** PRODUCT, PRICING

Prints reminder letters to members not yet qualified for the 2% quarterly warehouse rebate, listing missing product groups and the dollar shortfall to $10,000.

**Files:** reads QTRDATA, ARMST · writes none  
**Calls:** EXECUTE SELECT QTRDATA WITH QUALIFY NE Y

| ID | Rule | Source | Tag |
|---|---|---|---|
| QTRDATA.LTR.01 | Letter only for members with QUALIFY (QTRDATA attr 4 per QUARTERLY.RPT) not 'Y' and at least one of the 4 group qty slots (attr 2 values 1-4) empty | L11-21 | KEEP |
| QTRDATA.LTR.02 | Group slot -> name: 1 Lenses, 2 Flash, 3 Tripods, 4 Filters (maps to IVMST groups 1, 4, 10, 19 per QUARTERLY.RPT) | L26-29 | KEEP |
| QTRDATA.LTR.03 | Shortfall = 1000000 cents ($10,000) - QTRDATA attr 3 (warehouse $ in cents) | L24-25 | QUESTION |
| QTRDATA.LTR.04 | Letter text states rule: 2% quarterly rebate on all warehouse-shipped products if member buys all four groups OR $10,000 minimum in the quarter (text hard-codes "third quarter") | L36-40 | QUESTION |
| QTRDATA.LTR.05 | Hard-coded PRO office phone (203) 336-0183 | L49 | OBSOLETE |

**Bugs / oddities:** shortfall can be negative/unused when member already over $10k but missing groups (not possible since such members qualify); quarter text hard-coded.

## QTRDATA.LTR1

**Mode:** Report/print · **Lines:** 76 · **Relevance:** PRODUCT, PRICING

Later version of the reminder letter for the 5% quarterly warehouse incentive program with SKU-count minimums per product group and a selectable dollar threshold.

**Files:** reads QTRDATA, ARMST · writes none  
**Calls:** EXECUTE SELECT QTRDATA

| ID | Rule | Source | Tag |
|---|---|---|---|
| QTRDATA.LTR1.01 | Operator must choose quarterly dollar requirement of exactly 5000, 10000 or 15000 (whole dollars); shortfall = requirement*100 - QTRDATA attr 1 (cents) | L16-21,34-35 | QUESTION |
| QTRDATA.LTR1.02 | Only members < 6000 (hard-coded member range cutoff) with QUALIFY NE Y, by name | L23 | QUESTION |
| QTRDATA.LTR1.03 | Minimum SKU counts: batteries 10 (attr 2), memory 6 (attr 3), 7500EDF flash 2 (attr 4), digital filter types 4 (attr 5), inkjet paper 3 (attr 6), tripod lines 3 of 8 (attr 7); remaining = minimum - SUM(attr), floored at 0 | L26-31,48-55 | QUESTION |
| QTRDATA.LTR1.04 | Program text: 5% quarterly incentive on warehouse shipments excluding film, memory and other net items; qualify by meeting all group minimums OR the dollar minimum, plus "additional qualifications in the PRO INCENTIVE PROGRAM" | L44-58 | QUESTION |
| QTRDATA.LTR1.05 | Hard-coded product-line names in qualification rules (7500EDF flash; filter types UV, Protection, CPL, Cross Screen, Soft A, ND4, ND8, HGX UV/Protection/CPL, UV/IR Cutoff; tripod lines SystemPro, Travel, 7000, Featherweight, Carbon40, T Carbon, Classic, SHD) | L50-55 | QUESTION |

**Bugs / oddities:** QTRDATA layout used here (attr 1 dollars, attrs 2-7 SKU counts) is incompatible with what QUARTERLY.RPT/QUARTERLY.LY write (attr 1 group list, 2 qtys, 3 dollars, 4 qualify) — a different, unseen builder must populate QTRDATA for this letter; "memory" listed as both excluded net item and a required group (L45 vs L49).

## QUARTERLY.LY

**Mode:** Test-variant · **Lines:** 63 · **Relevance:** PRODUCT, PRICING

Variant of QUARTERLY.RPT run against archive ARHIST.01 with later-era exclusions and a $15,000 threshold.

**Files:** reads ARHIST.01, IVMST, IVMST.DISC · writes QTRDATA (cleared)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ARHIST.01

| ID | Rule | Source | Tag |
|---|---|---|---|
| QUARTERLY.LY.01 | Differs from QUARTERLY.RPT: product codes >= '9990' excluded (vs '9000') | L31 | QUESTION |
| QUARTERLY.LY.02 | Hard-coded excluded product 6779 (vs 4840) | L32 | QUESTION |
| QUARTERLY.LY.03 | Product groups 20 and 22 excluded (vs only 20) | L35-36 | QUESTION |
| QUARTERLY.LY.04 | Negative group quantity (net returns) treated as not purchased | L52-59 | KEEP |
| QUARTERLY.LY.05 | Dollar override threshold 1500000 cents ($15,000) (vs $10,000); 800-line cap | L27,60 | QUESTION |

**Bugs / oddities:** reads archive file ARHIST.01 (2001) — likely a re-run for prior year.

## QUARTERLY.RPT

**Mode:** Batch · **Lines:** 58 · **Relevance:** PRODUCT, PRICING

Builds QTRDATA quarterly warehouse-rebate qualification per member from ARHIST for an operator date range.

**Files:** reads ARHIST, IVMST, IVMST.DISC · writes QTRDATA (cleared)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| QUARTERLY.RPT.01 | Only warehouse invoices (ARHIST VNAME="") in the date range count | L22 | QUESTION |
| QUARTERLY.RPT.02 | Excluded lines: product codes >= '9000' (string compare), hard-coded product 4840 | L31-32 | QUESTION |
| QUARTERLY.RPT.03 | Excluded product group 20 (IVMST attr 6, fallback IVMST.DISC attr 6) | L33-35 | QUESTION |
| QUARTERLY.RPT.04 | Excluded when IVMST attr 14 = 'S' (dict BID/BRAND.ID on IVMST, "NOT IN USE" on IVMST.DISC — purpose unclear; acts as skip flag) | L36-38 | QUESTION |
| QUARTERLY.RPT.05 | Qualifying dollars QTRDATA attr 3 = sum of AMOUNT (cents) of all non-excluded lines | L41 | KEEP |
| QUARTERLY.RPT.06 | Hard-coded qualifying product groups 1 (lenses), 4 (flash), 10 (tripods), 19 (filters); qty per group in attr 2 | L11-12,42-47 | QUESTION |
| QUARTERLY.RPT.07 | QUALIFY (attr 4) = 'Y' if qty recorded in all 4 groups, OR qualifying dollars >= 1000000 cents ($10,000); else 'N' | L50-55 | KEEP |

**Bugs / oddities:** group qty of 0 or negative (returns) still counts as "purchased" since only blank is tested (fixed in QUARTERLY.LY); 600-line cap per invoice.

## SEL.SHIPTO

**Mode:** Subroutine · **Lines:** 129 · **Relevance:** none

Screen subroutine to pick a member's drop-ship address from SHIPTO by code or from a paged list, returning name, address line 1, city/state/zip and UPS zone.

**Files:** reads SHIPTO · writes none  
**Calls:** EDIT.LINE; EXECUTE SSELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| SEL.SHIPTO.01 | SHIPTO key = member*code. A code entered as 1-2 digits is zero-padded to 2 digits (`'R%2'`). If the code is not found, SHIP(1) = 'NOF'. | L22-24 | KEEP |
| SEL.SHIPTO.02 | List mode shows all SHIPTO records for the member, 12 per page, and the user confirms a choice (default Yes) | L16-21, L54-67 | SIMPLIFY |
| SEL.SHIPTO.03 | Returned ship-to: SHIP(1) = name (attr 2), SHIP(2) = address line 1 (attr 3), SHIP(3) = "city, state zip" (attrs 5-7), SHIP(4) = UPS zone (attr 8). Address line 2 (attr 4) is NOT returned or shown. | L87-90, L120 | QUESTION |

**Bugs / oddities:** ADDR2S is never filled in SEL.CODES, so address line 2 is dropped. A bare RETURN after GO START is unreachable.

## SHARES

**Mode:** Utility/maintenance · **Lines:** 10 · **Relevance:** none

Adds newly purchased co-op shares to a member's share count in STOCK.

**Files:** reads STOCK · writes STOCK  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| SHARES.01 | STOCK attr 2 SHARES += entered additional shares, with no validation (non-numeric or negative input is accepted) and no history/audit. A member with no STOCK record stops the program. | L5-8 | SIMPLIFY |

**Bugs / oddities:** There is no lock (WRITEV without READU). A blank member or shares entry is accepted.

## TEMP

**Mode:** Utility/maintenance · **Lines:** 8 · **Relevance:** none

One-off script copying each member's ARMST2 attr 26 (P.SALES "PRO-MERCH"/"WH-SALES") into STOCK attr 7.

**Files:** reads STOCK, ARMST2 · writes STOCK  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| TEMP.01 | STOCK attr 7 (dict DIRECT.COMM "Direct-Com") is set to ARMST2 attr 26 (warehouse/PRO merchandise sales). The field-name mismatch (warehouse sales written into the direct-commission field) needs confirmation. | L3-7 | QUESTION |

**Bugs / oddities:** One-off fix-up, no lock.

## UPD.WH

**Mode:** Batch · **Lines:** 50 · **Relevance:** PRODUCT

Year-end accumulation for the co-op STOCK record. It adds each member's purchases of camera products (IVMST EGRP 59) from the ARHIST.11 archive into STOCK attr 9.

**Files:** reads ARHIST.11, IVMST, IVMST.DISC, APMST, STOCK · writes STOCK attr 9  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.WH.01 | Hard-coded archive file ARHIST.11 (2011). The error text says ARHIST.10. | L8 | QUESTION |
| UPD.WH.02 | Only members with a STOCK record are processed (member = ARHIST key ID[1,4]) | L19-27 | KEEP |
| UPD.WH.03 | Vendor-billing lines are excluded by testing whether the "product" (ARHIST attr 2) exists as an APMST vendor id. This is ambiguous because product and vendor numbers share a namespace. | L32-33 | QUESTION |
| UPD.WH.04 | Products > 9989 are excluded (non-merchandise codes) | L34-35 | QUESTION |
| UPD.WH.05 | Products missing from both IVMST and IVMST.DISC are excluded | L36-39 | KEEP |
| UPD.WH.06 | Hard-coded EGRP 59 (IVMST attr 39, "Cameras" per comment): the line amount (attr 4, cents) is added to STOCK attr 9 (dict PROMASTER, header calls it "WH field") | L40-41, L46 | QUESTION |
| UPD.WH.07 | All other warehouse product amounts are summed into TOT/WH, but WH is never written, so only the camera total is stored | L42, L45 | QUESTION |

**Bugs / oddities:** It adds to the existing attr 9 value, so a re-run double-counts. The header comment ("WH field", "GRP 12 & 26 to WC") does not match the code. The STOCK lock taken by READVU is released only by RELEASE/WRITEV, and members not in STOCK are only released by RELEASE.

## XX

**Mode:** Utility/maintenance · **Lines:** 19 · **Relevance:** PRODUCT

One-off correction that reduces members' warehouse profit (ARMST attr 40 WH.PROFIT) for units of product 9832 on a saved list of ARHIST invoices.

**Files:** reads ARHIST, saved list X · writes ARMST attr 40  
**Calls:** EXECUTE GET-LIST X

| ID | Rule | Source | Tag |
|---|---|---|---|
| XX.01 | Hard-coded product 9832: only that product's line (first occurrence) on each listed invoice is used | L8 | QUESTION |
| XX.02 | Hard-coded amount 50216 per unit (cents, i.e. $502.16, presumably a cost correction): WH.PROFIT -= 50216 x qty | L11-13 | QUESTION |

**Bugs / oddities:** One-off fix-up. Running it again double-deducts. READVU locks are released only by WRITEV (and not on ELSE).

## ZIP.9

**Mode:** Interactive · **Lines:** 20 · **Relevance:** none

Captures the +4 part of a member's ZIP code into ZIP9.

**Files:** reads ARMST · writes ZIP9  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| ZIP.9.01 | Member must exist. The +4 must be exactly 4 digits. ZIP9 `<member>` attr 1 = ARMST ZIP (attr 6) + '-' + the 4 digits. It is stored separately from ARMST, so the two can diverge. | L9-17 | SIMPLIFY |

**Bugs / oddities:** If ARMST ZIP already contains +4, the result doubles it.
