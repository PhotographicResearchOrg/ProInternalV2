# AR — Computyme programs and rules

77 programs, 337 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## AR.ADJ.CY

**Mode:** Utility/maintenance · **Lines:** 18 · **Relevance:** none

Year-roll/reset style fix-up that sets every member's current-year high credit to the current balance.

**Files:** reads ARMST · writes ARMST  
**Calls:** UPD.ARLOG (commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.ADJ.CY.01 | ARMST attr 36 CY.HI.CRED = INT(attr 15 BALANCE / 100) (balance in cents, high-credit in whole dollars) | L13 | QUESTION |
| AR.ADJ.CY.02 | ARMST attr 16 HI.CRED = attr 38 PY.HI.CRED | L14 | QUESTION |

**Bugs / oddities:** ARLOG audit call commented out despite the 07-23-09 note adding it; units differ between fields (cents vs dollars); MATREADU ELSE silently skips locked records.

## AR.CHANGE

**Mode:** Utility/maintenance · **Lines:** 10 · **Relevance:** none

One-off script that re-keys selected ARHIST records to member 2829 (moves history from one member to another).

**Files:** reads ARHIST · writes ARHIST (write new, delete old)  
**Calls:** none (needs active select list)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.CHANGE.01 | Hard-coded target member 2829: new key = "2829" : old key chars 5-10 | L4 | QUESTION |
| AR.CHANGE.02 | Overwrites any existing target record without merging, then deletes the source | L5-7 | OBSOLETE |

**Bugs / oddities:** Silent overwrite of existing history under target key; READU ELSE conflates locked/missing.

## AR.INP.DEPTICK

**Mode:** Interactive · **Lines:** 433 · **Relevance:** none

Enters and edits cash deposit tickets (member account, check number, check amount per line) that payments are later applied against.

**Files:** reads ARMST, DEPTICK, CONTROL, SCREENS · writes DEPTICK, CONTROL ('DEPTICK' counter)  
**Calls:** RAWINPUT, IDATE, MONEY, SUMM; INCLUDE FILE.INCLUDES ARMST.FIELDS, DEPTICK.FIELDS (include files not in extract)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.INP.DEPTICK.01 | New ticket number = current month (2 digits) : CONTROL 'DEPTICK' attr 1 sequence zero-padded to 3; sequence then incremented. No monthly reset or overflow check in this program | L53-71 | QUESTION |
| AR.INP.DEPTICK.02 | Existing tickets are entered as 4–5 digits, zero-padded to 5; only tickets whose first 2 chars equal the current month may be edited | L72-96 | KEEP |
| AR.INP.DEPTICK.03 | Ticket date validated by CALL IDATE(ip,30,0) (window meaning of 30 not visible here) and stored in DEPTICK attr 1 DATE (internal) | L102-124 | QUESTION |
| AR.INP.DEPTICK.04 | Each line's account must be numeric, ≥4 digits, and exist in ARMST | L149-171 | KEEP |
| AR.INP.DEPTICK.05 | Same account twice on one ticket requires operator "OK" | L155-166 | KEEP |
| AR.INP.DEPTICK.06 | Check number is mandatory; a non-numeric check number requires "OK" | L180-208 | KEEP |
| AR.INP.DEPTICK.07 | Check amount cannot be changed once any of it has been applied (amount ≠ unapplied) | L213-216 | KEEP |
| AR.INP.DEPTICK.08 | Check amount entered as dollars or dollars.cents (MONEY), stored in cents; amounts > $500,000.00 (50000000 cents) require "OK" | L228-240 | KEEP |
| AR.INP.DEPTICK.09 | On entry, unapplied amount = check amount (both in cents, multivalued per line) | L242-246 | KEEP |
| AR.INP.DEPTICK.10 | Lines can be deleted with "/D" + "OK"; deletes account, check, amount, unapplied for that line | L139-148, L387-396 | QUESTION |

**Bugs / oddities:** Existing ticket lock is released immediately after read (L89) and edits are written later without a lock — concurrent payment posting (AR.INP.PAYMNTS) can be overwritten; line delete is allowed even after payments were applied to that check; ticket counter can exceed 3 digits and break the 5-digit ID format.

## AR.INP.PAYMNTS

**Mode:** Interactive · **Lines:** 1137 · **Relevance:** VENDOR

Applies deposit-ticket checks to member open invoices (pay due, pay all, by invoice), with discounts, partial payments, adjustments and vendor credit memos that also post AP credits.

**Files:** reads APMST, APDIST, APHIST, ARMST, ARINV, DEPTICK, CONTROL ('UPD','APBAT','APPER','MS'), SCREENS · writes ARMST, ARINV, DEPTICK, APDIST, APHIST, APMST, CONTROL  
**Calls:** RAWINPUT, MONEY, SUMM, DSP.REPORT, SUBR('-NES'); EXECUTE TERM, SORT DEPTICK; INCLUDE *.FIELDS (not in extract)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.INP.PAYMNTS.01 | No payments allowed while CONTROL 'UPD' attr 1 > 2 (month-end in progress); CONTROL 'UPD' attr 2 = current month used for ticket listing | L44-52, L111 | KEEP |
| AR.INP.PAYMNTS.02 | Current-month-only ticket restriction is commented out (any month's ticket can be paid against) | L102-107 | QUESTION |
| AR.INP.PAYMNTS.03 | A ticket line with unapplied = 0 and non-zero check cannot be applied further | L126-129 | KEEP |
| AR.INP.PAYMNTS.04 | Payment options: (1) pay amount due where Due = ARMST attr 15 BALANCE − attr 10 NEW.MON − attr 24 FUTURE; (2) pay total BALANCE; (3) enter invoices; (4) prompted invoices | L174-190 | KEEP |
| AR.INP.PAYMNTS.05 | Options 1/2 auto-apply: cap = min(check, due or balance); walk ARINV invoices in stored order paying each invoice's full open amount until cap reached | L194-219 | SIMPLIFY |
| AR.INP.PAYMNTS.06 | Invoice open amount = ARINV AMOUNT − AMTPAID − CRDMEM − ADJ (CRDMEM/ADJ are include-file fields beyond the ARINV dict) | L345 | KEEP |
| AR.INP.PAYMNTS.07 | Aging bucket = ARINV attr 5 AGING + 10, mapped to ARMST attr 10 NEW.MON / 11 CURRENT / 12 30DAYS / 13 60DAYS / 14 90DAYS; >14 capped at 14; <10 (future) mapped to attr 24 FUTURE | L347-350 | KEEP |
| AR.INP.PAYMNTS.08 | Options 1 and 4 skip invoices with AGE < 11 (new-month and future invoices are not "due") | L348 | KEEP |
| AR.INP.PAYMNTS.09 | Prompt-pay discount: only for new-month, current or future invoices; DISC = ROUND(open × ARINV attr 4 TERMS / 100) (TERMS = discount %, money in cents); non-numeric TERMS forced to 0 with warning | L351-357 | KEEP |
| AR.INP.PAYMNTS.10 | On payment: ARMST BALANCE and the aging bucket reduce by gross AMT (open amount incl. discount); ARINV AMTPAID += AMT, DTPAID = pay date | L383-397 | KEEP |
| AR.INP.PAYMNTS.11 | Vendor-credit invoices (ARINV attr 8 VN.CRED = 1) also reduce ARMST attr 22 VN.CRED by AMT | L386-389 | QUESTION |
| AR.INP.PAYMNTS.12 | If the amount applied ≠ invoice open amount and a discount applies, discount recalculated = ROUND(AMT × TERMS / 100) | L390-394 | KEEP |
| AR.INP.PAYMNTS.13 | Pay-in-full exceeding unapplied cash requires typing "OVER", then converts to a partial payment | L588-598 | KEEP |
| AR.INP.PAYMNTS.14 | Partial amounts may be negative ("-" prefix); amount > unapplied cash or > invoice due (unless open credit) requires "OVER" | L645-667, L684-694 | KEEP |
| AR.INP.PAYMNTS.15 | Split codes per partial: AJ adjustment, CM credit memo, PT partial payment, DS discount adjustment, SC service charge, UC unknown cash; each code at most once per invoice | L63, L695-722 | KEEP |
| AR.INP.PAYMNTS.16 | DS (discount adjustment) larger than 10% of invoice due requires "DISCOK" | L725-733 | KEEP |
| AR.INP.PAYMNTS.17 | Non-cash option 9 is meant to force code AJ (check tests PAYOPT=0, but PAYOPT is set to 9) | L584-585, L705-706, L851-853 | QUESTION |
| AR.INP.PAYMNTS.18 | CM split requires a valid APMST vendor and an explanation longer than 3 characters | L794-830 | KEEP |
| AR.INP.PAYMNTS.19 | Unknown invoice # can be posted as an open credit: inserted at top of ARINV with date today, amount 0; must use payment code 3 | L249-257, L582-583, L831-838 | KEEP |
| AR.INP.PAYMNTS.20 | Unapplied cash = ticket unapplied − applied gross + discounts + CM + AJ + SC totals; update refused while unapplied < 0 | L446-450, L637-640 | KEEP |
| AR.INP.PAYMNTS.21 | On update: ARMST attr 19 LAST.PAID = today; each paid invoice stamped with ticket id (ARINV TICKET) | L490-499 | KEEP |
| AR.INP.PAYMNTS.22 | CM posting: ARINV CRDMEM += amt and AMTPAID −= amt; vendor and reason stored per subvalue; triggers AP credit posting | L507-514 | KEEP |
| AR.INP.PAYMNTS.23 | AJ posting: ARINV ADJ += amt and AMTPAID −= amt | L515-517 | KEEP |
| AR.INP.PAYMNTS.24 | DS, SC, UC codes are not posted to ARINV (only counted in DEPTICK totals) | L518-520 | QUESTION |
| AR.INP.PAYMNTS.25 | AP credit from a member CM: APDIST key VENDOR*INVOICE:"CM", STATUS "100", batch = period:batch(5-digit):counter, GROSS = −amt, DISC 0, DATE today; APHIST NET = +amt; APMST OPEN.GROSS += gross | L905-937 | KEEP |
| AR.INP.PAYMNTS.26 | AP credit due date: today+30 (+30 more if today's day > 25), then day-of-month replaced by APMST attr 10 DUE.DAYS (default 30) | L912-917 | QUESTION |
| AR.INP.PAYMNTS.27 | If APMST attr 12 LEDGER set, APDIST LEDGER = it and APDIST AMOUNT = gross | L926-928 | KEEP |
| AR.INP.PAYMNTS.28 | AP batch/period from CONTROL 'APBAT'/'APPER'; operator may change period (YYMM) within a window with year-wrap arithmetic (01: 1 prior or Dec prior year; 12: ±1; others: 1 prior, 1–2 future); batch counter incremented | L856-903 | QUESTION |
| AR.INP.PAYMNTS.29 | Hard-coded vendor 1336: add SHIP to AP gross (commented out) | L922-924 | QUESTION |
| AR.INP.PAYMNTS.30 | CONTROL 'MS' attr 4 += total applied (cents) on every posting, except for user 245 (purpose of MS unclear) | L527-531 | QUESTION |
| AR.INP.PAYMNTS.31 | Hard-coded DEBUG.USER = 245 (terminal user number) gets DEBUG access and bypasses CONTROL MS accumulation | L5, L244, L464, L527 | QUESTION |
| AR.INP.PAYMNTS.32 | DEPTICK line for the account updated: unapplied replaced; PART, ADJ, CM, DADJ, UNK, SC totals accumulated | L533-546 | KEEP |
| AR.INP.PAYMNTS.33 | Payment register printed on preview ("P") and after every posting | L451-453, L532-533, L1042-1088 | SIMPLIFY |

**Bugs / oddities:** Auto-apply (L203-207) pays each invoice's full due even when it exceeds the remaining check (overpay guard commented out); period error message ("2 prior or 1 future") contradicts code (1 prior, up to 2 future); PAYOPT=0 test unreachable; UPD.APDIST sets ERR not EM so a missing-vendor message never shows, then MATWRITEs a blank APMST record; READ.DEPTICK retry loop exits after one wait so DEPTICK may silently not update after ARMST/ARINV were written; MATREADU ARINV ELSE proceeds with empty record (conflates not found/locked); APHIST NET sign opposite to GROSS; YTD.DISC adds 0.

## AR.INQ.DEPTICK

**Mode:** Subroutine · **Lines:** 107 · **Relevance:** none

POSH screen-framework hook for the deposit ticket inquiry screen (inquiry only, optional print).

**Files:** none directly (screen framework via POSH includes; would LIST ARDEPTIC) · writes none  
**Calls:** none (EXECUTE of LIST ARDEPTIC is commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.INQ.DEPTICK.01 | Deposit ticket screen is inquiry only; "E" on ticket field exits | L39-41, L82 | KEEP |
| AR.INQ.DEPTICK.02 | "Print" option builds LIST ARDEPTIC for the ticket but the EXECUTE is commented out, so print does nothing | L97-102 | OBSOLETE |

**Bugs / oddities:** Print path is dead; uses a different file name (ARDEPTIC) from the BASIC programs (DEPTICK).

## AR.PRT.CRDMEM

**Mode:** Report/print · **Lines:** 167 · **Relevance:** VENDOR

Lists member credit memos (ARINV code "CM" splits) for a date range, by member or by vendor, with subtotals.

**Files:** reads ARMST, APMST, ARINV, CONTROL · writes none  
**Calls:** IDATE, P.ASSIGN.SUB, DSP.REPORT; EXECUTE SSELECT ARINV

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.PRT.CRDMEM.01 | Date range defaults: start = 1st of current month, end = today; end ≥ start | L12-39 | KEEP |
| AR.PRT.CRDMEM.02 | Selects ARINV invoice values with CODE = "CM" and DT.PAID in range; amount, vendor, reason taken from the CM subvalue of attrs 12/13/14, ticket from attr 15 (ARINV attrs 11-15 are beyond the dict; names from AR.INP.PAYMNTS usage: CODE, PTAMT, VENDOR, REASON, TICKET) | L65-90 | KEEP |
| AR.PRT.CRDMEM.03 | Subtotal by member (opt 1) or by APMST vendor (opt 2); grand "MONTHLY TOTALS"; amounts cents shown as dollars | L91-118, L126-151 | KEEP |

**Bugs / oddities:** Only the first CM subvalue per invoice is reported (one CM per invoice is enforced in AR.INP.PAYMNTS); L136 ELSE sets NAME not MNAME so a missing member shows the previous member's name; OPT=1 sorts BY-EXP CODE, not by member.

## AR.PRT.EDIINV

**Mode:** Report/print · **Lines:** 83 · **Relevance:** VENDOR, PRICING

Prints "Billing for <vendor>" invoices to members for vendor-billed (EDI) shipments held in ARSHIP, using the vendor's own product/description/qty/cost lines.

**Files:** reads ARSHIP, ARMST, IVMST (opened, unused), CONTROL ('COPY'), APMST · writes none  
**Calls:** EXECUTE SSELECT ARSHIP

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.PRT.EDIINV.01 | ARSHIP key = member (chars 1-4) + PRO invoice number (chars 5-9) | L27, L71, L75 | KEEP |
| AR.PRT.EDIINV.02 | Line amount = vendor cost (ARSHIP attr 13 VCOST, cents) × vendor qty (attr 12 VQTY); vendor product = attr 10, desc = attr 11; printed with 12R (changed 10-15-01 from 12R2 to allow 3-decimal costs) | L5, L17, L51-61 | QUESTION |
| AR.PRT.EDIINV.03 | Invoice header shows date (attr 1), terms (attr 6), PO (attr 5), vendor invoice # (attr 7), surcharge (attr 8 /100) and vendor name from APMST via ARSHIP attr 9 VEND | L69-75 | KEEP |
| AR.PRT.EDIINV.04 | Commented-out policy text: members must report terms discrepancies within 10 days of invoice date; after that terms cannot change and unpaid invoices incur a service charge | L30-50 | QUESTION |
| AR.PRT.EDIINV.05 | Grand total of invoices printed only when copy number ≥ 3 | L79-82 | OBSOLETE |

**Bugs / oddities:** Prints every ARSHIP record (no selection criteria); IVMST opened but unused; the "3-digit decimals" comment conflicts with dividing cents by 100 (units of VCOST unclear); fixed-form printer escape codes.

## AR.RPT.DEPTICK

**Mode:** Report/print · **Lines:** 46 · **Relevance:** none

Detail or summary report of deposit tickets in a ticket-number range (amounts, unapplied, discount adj, CM, adjustments).

**Files:** reads DEPTICK · writes none  
**Calls:** DSP.REPORT; EXECUTE SORT DEPTICK

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.RPT.DEPTICK.01 | Ticket range numeric; totals AMT, UNAPP.CASH, DISC.ADJ, CM, ADJ per ticket; detail adds ACCT and CHECK | L7-32 | SIMPLIFY |

**Bugs / oddities:** Ticket IDs are MM+seq so a numeric range spans months oddly; DISC.ADJ dictionary item not in the extracted DEPTICK dict.

## AR.TEST.SUB

**Mode:** Utility/maintenance · **Lines:** 38 · **Relevance:** none

One-off diagnostic (GJS 12-27-1999) counting ARINV records that have multiple partial payments.

**Files:** reads ARINV · writes none  
**Calls:** EXECUTE SELECT ARINV

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.TEST.SUB.01 | A record "has multiple partial payments" if any invoice's ARINV attr 6 DT.PAID contains subvalues | L28-34 | OBSOLETE |

**Bugs / oddities:** Diagnostic only; no business effect.

## AR.UPD.PRO.SUB

**Mode:** Subroutine · **Lines:** 793 · **Relevance:** VENDOR

POSH-framework payment-posting screen (called from AR.UPD.DEPTICK) that applies one check to a member's open invoices with full/skip/partial/non-cash codes and writes ARINV/ARMST; an earlier (1999) alternative to AR.INP.PAYMNTS.

**Files:** reads POSH.WORK ('AR.UPD.PRO.SUB*'port), ARINV, ARMST, APMST · writes ARINV, ARMST, POSH.WORK  
**Calls:** POSH.ERROR, POSH.INPUT, MONEY; EXECUTE WHO

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR.UPD.PRO.SUB.01 | Invoice open = ARINV attr 3 AMOUNT − attr 7 AMTPAID; only non-zero shown | L139-151 | KEEP |
| AR.UPD.PRO.SUB.02 | Discount: none if open < 0 or ARINV attr 5 AGING > 1; else if attr 4 TERMS ≠ 0 and AGING < 2, DISC = ROUND(open × TERMS / 100); NET = open − DISC (cents) | L611-635 | KEEP |
| AR.UPD.PRO.SUB.03 | Pay codes: 1 in full, 2 skip, 3 partial, 0 non-cash; anything else rejected | L237-262 | KEEP |
| AR.UPD.PRO.SUB.04 | Pay in full rejected if NET > check unapplied (POSH.WORK attr 10) | L316-325 | KEEP |
| AR.UPD.PRO.SUB.05 | Partial must be ≤ unapplied cash and strictly < NET (equal or greater rejected) | L410-444 | KEEP |
| AR.UPD.PRO.SUB.06 | Partial sub-codes PT (plain partial), DS (discount adjustment — only if the invoice has a discount), CM (credit memo amount + numeric APMST vendor + explanation) | L467-545 | KEEP |
| AR.UPD.PRO.SUB.07 | Non-cash (code 0) must use sub-code AJ; adjustment = full NET | L565-607 | KEEP |
| AR.UPD.PRO.SUB.08 | Ticket and check unapplied reduce by cash applied; session totals in WORKREC 4/5/6 | L637-656 | SIMPLIFY |
| AR.UPD.PRO.SUB.09 | Posting: aging bucket = AGING+10 (cap 14, <10 → 24 FUTURE) as in AR.INP.PAYMNTS | L305-310, L701-702 | KEEP |
| AR.UPD.PRO.SUB.10 | Full pay: ARINV attr 6 DT.PAID = posting date, attr 7 AMTPAID = AMOUNT; ARMST attr 19 LAST.PAID = posting date; ARMST BALANCE (15) and aging bucket reduce by full invoice amount | L705-710 | QUESTION |
| AR.UPD.PRO.SUB.11 | Partial PT/DS/CM: AMTPAID += cash (+ DS amount or + CM amount); BALANCE and bucket reduce likewise; CM sets ARINV attr 8 VN.CRED = 1 | L715-737 | QUESTION |
| AR.UPD.PRO.SUB.12 | Non-cash AJ: AMTPAID += adjustment; BALANCE and bucket reduce | L739-744 | KEEP |
| AR.UPD.PRO.SUB.13 | CM vendor and explanation captured but never written to ARINV/AP (no AP credit is created, unlike AR.INP.PAYMNTS) | L536-539, L731-736 | QUESTION |

**Bugs / oddities:** Looks unfinished — debug prompt "AT BUILD REC TO WRITE" + INPUT before posting (L685-686); skip test at L339 is always true (NE "" OR NE 2); WORKREC is indexed by display position while posting LOCATEs by invoice number; full-pay reduces balance by the invoice gross although cash = net; MATREADU ELSE STOP conflation is handled with LOCKED clause (ok); DIM AR.MST(34) smaller than ARMST record (47 attrs).

## AR10

**Mode:** Batch · **Lines:** 28 · **Relevance:** none

After invoice printing, copies ARSHIP to ARHIST, clears ARSHIP, and deletes billed SCANORD records.

**Files:** reads ARSHIP, SCANORD · writes ARHIST; clears ARSHIP; deletes SCANORD  
**Calls:** EXECUTE COPY FROM ARSHIP TO ARHIST ALL; EXECUTE SELECT SCANORD WITH BILL.DATE

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR10.01 | Requires operator "OK" (after checking invoice print) before running | L10-11 | KEEP |
| AR10.02 | All ARSHIP records copied to ARHIST, then ARSHIP cleared | L13-15 | SIMPLIFY |
| AR10.03 | SCANORD (scan/pick orders) records with a BILL.DATE are deleted (added 2-21-02) | L3, L16-23 | WAREHOUSE-ONLY |

**Bugs / oddities:** COPY without OVERWRITING silently skips keys already in ARHIST, then ARSHIP is cleared anyway — potential history loss; no check that the copy succeeded.

## AR11

**Mode:** Utility/maintenance · **Lines:** 26 · **Relevance:** none

Recomputes ARMST aging buckets and balance from ARINV open invoices (marked "DON'T USE").

**Files:** reads ARINV, ARMST · writes ARMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR11.01 | Aging recompute: open = ARINV attr 3 − attr 7 per invoice; AGING attr 5 < 0 → FUTURE (ARMST 24); 0-3 → ARMST 10-13; ≥4 → ARMST 14; total → ARMST 15 BALANCE; mismatches overwritten and reported | L12-23 | OBSOLETE |

**Bugs / oddities:** Header "$$%% DON'T USE" (L2 is not valid BASIC); 300-invoice cap; no locks.

## AR12

**Mode:** Batch · **Lines:** 67 · **Relevance:** VENDOR, PRODUCT

Year-end roll: moves YTD figures to prior year and zeroes YTD counters on STOCK, IVMST, VNMST, ARMST; clears IVSOLD and IVEND.

**Files:** reads STOCK, IVMST, VNMST, ARMST · writes STOCK, IVMST, VNMST, ARMST; clears IVSOLD, IVEND  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR12.01 | Requires "OK" then "YES"; break key disabled during run | L15-22 | KEEP |
| AR12.02 | STOCK attr 1 VEND.COMM zeroed for all, then set per member = ARMST attr 21 SURCHG (year's surcharge, cents) | L23-27, L51-52 | QUESTION |
| AR12.03 | IVMST: attr 13 YTD cleared; attr 18 MPYR = attr 17 MORD; attr 17 cleared (MORD/MPYR meaning not documented — appear to be current/prior-year counters) | L33 | QUESTION |
| AR12.04 | VNMST: attr 10 PREV.YR = INT(attr 7 YTD.SALES / 100) (cents → whole dollars); attr 7 and attr 9 SURCHARGES zeroed | L42 | KEEP |
| AR12.05 | ARMST: attr 8 PREV.YR = INT(attr 9 YTD.SALES / 100) (dollars); attr 9, 21 SURCHG, 26 PRO.SALES zeroed; attr 16 HI.CRED = INT(attr 15 BALANCE / 100) | L53-54 | KEEP |
| AR12.06 | IVSOLD (member/product sold) and IVEND (member/vendor totals) cleared at year end | L60-63 | KEEP |

**Bugs / oddities:** Prior-year fields stored in dollars while YTD in cents (unit inconsistency); 11-26-01 note says ARMST attr 22 no longer holds shares but share calc removed; AR.ADJ.CY sets HI.CRED from PY.HI.CRED instead — two different year-end rules; MATREADU ELSE skips locked records silently.

## AR2

**Mode:** Report/print · **Lines:** 71 · **Relevance:** VENDOR, PRICING

Prints member invoices from ARSHIP (1994 version): PRO product lines, or a single "Billing for <vendor>" line for direct-bill vendor charges with a terms-dispute notice.

**Files:** reads ARSHIP, ARMST, IVMST, CONTROL ('COPY'), APMST · writes none  
**Calls:** none (relies on active select list)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR2.01 | Direct-bill vendor charge detected when ARSHIP attr 3 QTY is blank: vendor = APMST name for attr 2, amount = attr 4 (cents; "includes surcharge and shipping"); negative amount prints "THIS IS A CREDIT" | L23-30 | KEEP |
| AR2.02 | Terms-dispute policy printed on vendor billings: member must notify PRO by invoice date + 10 days; after that terms cannot change and invoices not paid to original terms incur a service charge | L24, L32-40 | QUESTION |
| AR2.03 | Product lines: description = IVMST attr 4 DESC; unit price = line amount / qty (amount when qty 0); amounts in cents shown /100 | L44-51 | KEEP |
| AR2.04 | Header: date attr 1, invoice # = key chars 5-9, terms attr 6, PO attr 5, vendor inv attr 7, surcharge attr 8/100 | L58-63 | KEEP |
| AR2.05 | Grand total printed when copy number ≥ 3 | L66-70 | OBSOLETE |

**Bugs / oddities:** 200-line cap; unit price derived by division (may round); superseded in part by AR.PRT.EDIINV and AR5 variants.

## AR3

**Mode:** Interactive · **Lines:** 285 · **Relevance:** none

Original member payment entry (no deposit ticket): pays due/all/selected invoices with prompt-pay discount, records credits, updates ARMST/ARINV and stamps date paid on ARHIST.

**Files:** reads ARMST, ARINV, ARHIST, CONTROL ('UPD','INV','MS') · writes ARMST, ARINV, ARHIST (attr 16), CONTROL ('INV','MS')  
**Calls:** MONEY; UPD.ARLOG (commented out); EXECUTE SELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR3.01 | No posting when CONTROL 'UPD' attr 1 > 2 (month-end in progress) | L31-32 | KEEP |
| AR3.02 | Payment date defaults to today or MM.DD.YY entry | L33-40, L49 | KEEP |
| AR3.03 | Month-end cutoff: if payment day > 25 and payment month = CONTROL 'UPD' attr 2 (prior month still open), posting blocked — except in December (12-26-06; earlier year-specific toggles 2005/2006 in header) | L8-11, L42-48 | QUESTION |
| AR3.04 | Options: (1) Due = ARMST BALANCE − NEW.MON (attr 10) − FUTURE (attr 24); (2) Total = BALANCE; (3) by invoice; (4) walk all invoices | L68-72 | KEEP |
| AR3.05 | Option 1 skips new-month and future invoices (AGING+10 < 11); options 1/2 pay every open invoice in full (no check-amount cap) | L74-88 | QUESTION |
| AR3.06 | Aging bucket mapping AGING+10 → ARMST 10-14, cap 14, future → 24 | L82-85, L102-104 | KEEP |
| AR3.07 | Discount in options 1/2: if bucket < 12 or future, DISC = ROUND(open × TERMS / 100) (no TERMS > 0 check); options 3/4: only if TERMS > 0 and bucket < 12 (future excluded) | L86, L105, L160 | QUESTION |
| AR3.08 | Partial payment = gross amount ≤ invoice open gross unless "OVER" typed; negative allowed in option 3 | L128-143, L169-182 | KEEP |
| AR3.09 | Payment effect: ARMST BALANCE and bucket −= gross; vendor-credit invoice (ARINV attr 8 = 1) also reduces ARMST attr 22 VN.CRED; ARINV attr 7 AMTPAID += gross, attr 6 DT.PAID = payment date | L188-195 | KEEP |
| AR3.10 | Partial with discount: discount recomputed on amount paid | L190 | KEEP |
| AR3.11 | Re-entering an invoice + "DEL" reverses its payment | L106-120 | KEEP |
| AR3.12 | On update: ARMST attr 19 LAST.PAID = payment date | L219-222 | KEEP |
| AR3.13 | ARHIST attr 16 (date paid; ARHIST has no dict) set on record member:invoice for each paid invoice (04-27-09) | L223-231, L257-265 | KEEP |
| AR3.14 | Hard-coded member 7000 ("FotoSource"): instead of member:invoice, selects ARHIST WITH INVOICE = paid invoices and stamps all of them (07-06-11) | L224, L266-275 | QUESTION |
| AR3.15 | Credit with no open invoices: new invoice # from CONTROL 'INV' attr 1 + 1 (wraps to 1 at 999999); amount entered without decimal (cents); posted in NEW.MON bucket (10) | L237-255 | QUESTION |
| AR3.16 | Session totals added to CONTROL 'MS' attr 4 (gross payments credited; purpose of MS record unclear) | L277-283 | QUESTION |

**Bugs / oddities:** LOCKED clauses at L243 and L260 set NOT.LOCKED = 1, so lock waits never happen; credit path (L251-254) calls the payment routine with stale B() values from the last invoice viewed; credit invoice written with no amount (attr 3) — only AMTPAID; open-error label for ARHIST says ARMST; ARLOG audit commented out; discount rules differ between options.

## AR4

**Mode:** Batch · **Lines:** 76 · **Relevance:** PRODUCT

Month-end AR close: purges fully paid invoices, ages open invoices, assesses 1.5% service charges, rolls ARMST aging buckets and advances the AR month.

**Files:** reads CONTROL ('UPD'), ARMST, ARINV, DICT IVMST (opened, write commented out) · writes ARMST, ARINV, ARSHIP, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR4.01 | Runs only if CONTROL 'UPD' attr 1 ≤ 1 (cycle state) and nobody holds 'UPD'; requires "OK"; break key off | L18-26, L30 | KEEP |
| AR4.02 | Invoices with AMOUNT (attr 3) = AMTPAID (attr 7) are deleted from ARINV | L39-43 | KEEP |
| AR4.03 | Every remaining invoice's AGING (attr 5) += 1; amounts of invoices still with AGING < 1 are summed as FUTURE | L44-45 | KEEP |
| AR4.04 | Service charge = INT(1.5% × (ARMST CURRENT 11 + 30DAYS 12 + 60DAYS 13 + 90DAYS 14)) in cents, only if that sum > 0 and BALANCE > 0; not applied if under 500 cents ($5.00) | L34-35, L51-54 | QUESTION |
| AR4.05 | Service-charge invoice: number "S":(internal date − 9000), dated the 25th of the AR month (CONTROL 'UPD' attr 2; prior year if AR month 12 and calendar month 1), TERMS 0, AGING 1; added to ARINV, BALANCE and NEW.MON | L27-29, L55-61 | KEEP |
| AR4.06 | Hard-coded product 9994 used as the service-charge line on the ARSHIP record (member:SID, qty 1) so it prints/bills as an invoice | L29, L58-59 | QUESTION |
| AR4.07 | Bucket roll: 90 = 90 + 60; 60 = 30; 30 = CURRENT; CURRENT = NEW.MON + FUTURE − new FUTURE; NEW.MON = 0; FUTURE (attr 24) = sum of still-future invoices | L63-64 | KEEP |
| AR4.08 | CONTROL 'UPD' attr 1 = 3 (aging done, statements next); attr 2 AR month advanced (12 → 1) | L69-71 | KEEP |

**Bugs / oddities:** Header says service charge "at 30, not 60 days" but CURRENT is included in the base; SID "date − 9000 to retain 4 digits" now yields 5 digits (dates > 19000) and can collide across years; if ARINV is missing the ARMST lock is released then the record is still written; DICT IVMST opened but unused; fractions dropped by INT not rounded.

## AR5

**Mode:** Report/print · **Lines:** 107 · **Relevance:** none

Prints monthly member statements (three-part pre-printed form) with prompt-pay discount and past-due flags, and advances the month-end state.

**Files:** reads CONTROL ('UPD'), ARINV, ARMST · writes ERROR (missing records), CONTROL ('UPD' attr 1 = 4)  
**Calls:** none (relies on active select list)

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR5.01 | If CONTROL 'UPD' attr 1 < 3 (month-end aging not run) operator must type "OK" to print anyway; out-of-order check commented out | L18-24 | KEEP |
| AR5.02 | Members with BALANCE (attr 15) = 0 are skipped | L44 | KEEP |
| AR5.03 | Optional 2-line statement message, max 55 chars each | L30-38 | SIMPLIFY |
| AR5.04 | Discount shown only for invoices with AGING < 2: DISC = ROUND(open × TERMS / 100), with "take by" date MM/10 where MM = statement month + 2 − AGING (wrapped 1-12); otherwise "* PAST-DUE *" | L27, L62-68 | KEEP |
| AR5.05 | Invoices with AGING ≤ 0 are future: not in amount due, flagged with "*" | L70 | KEEP |
| AR5.06 | Footer: aging buckets CURRENT/30/60/90 from ARMST; total gross, due, discount, net, future; YTD surcharge ARMST attr 21 (cents) | L90-95 | KEEP |
| AR5.07 | After a run with UPD attr 1 = 3, sets it to 4 (statements printed) | L105 | KEEP |

**Bugs / oddities:** Missing ARINV/ARMST are logged to ERROR and the run ABORTs at end; READVU on 'UPD' held for whole run; discount column shows terms % even when past due.

## AR5.LASER

**Mode:** Test-variant · **Lines:** 151 · **Relevance:** VENDOR

Laser-printer (PCL) version of AR5 statements that also shows the vendor invoice number and vendor name per line; only differences from AR5 listed.

**Files:** reads APMST, ARMST, ARINV, ARHIST, ARHIST.98, CONTROL · writes ERROR, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR5.LASER.01 | For each statement line, reads ARHIST key member:invoice (fallback archive file ARHIST.98); vendor invoice # = ARHIST attr 7 (VINVNO per ARSHIP naming); vendor = APMST attr 8 SH.NAME for ARHIST attr 2 (vendor id on direct-bill lines); blank vendor name prints "PRO" | L91-98 | KEEP |
| AR5.LASER.02 | Past-due lines show "PAST DUE" and print terms % as 0 | L88-89 | KEEP |
| AR5.LASER.03 | Statement message lines limited to 30 chars (vs 55) | L45-49 | SIMPLIFY |

**Bugs / oddities:** Hard-coded archive file name ARHIST.98 (1998 history) — later years' archived invoices not found; PCL escape strings hard-coded.

## AR5.LASER.INTERIM

**Mode:** Test-variant · **Lines:** 152 · **Relevance:** VENDOR

Mid-month ("interim") variant of AR5.LASER; only differences listed.

**Files:** reads APMST, ARMST, ARINV, ARHIST, ARHIST.00, CONTROL · writes ERROR, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR5.LASER.INTERIM.01 | Discount take-by month = statement month + 1 − AGING (vs +2) and discount only for AGING < 1 (vs < 2) | L40, L87 | QUESTION |
| AR5.LASER.INTERIM.02 | Lines with NET = 0 are suppressed | L101 | KEEP |
| AR5.LASER.INTERIM.03 | Archive fallback file is ARHIST.00 instead of ARHIST.98 | L17, L93 | QUESTION |

**Bugs / oddities:** Still writes CONTROL 'UPD' = 4 when UPD = 3 even though it is an interim run (inherited L-149 logic); hard-coded archive year.

## AR5.OFFICE

**Mode:** Test-variant · **Lines:** 154 · **Relevance:** none

Office-copy variant of AR5.LASER; only differences listed.

**Files:** reads APMST, ARMST, ARINV, ARHIST, ARHIST.98, CONTROL · writes ERROR, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR5.OFFICE.01 | Prints discount amount and the "due on" MM/10 date columns instead of vendor invoice/vendor name (ARHIST/APMST still read but unused) | L88-89, L102, L124 | SIMPLIFY |

**Bugs / oddities:** Reads ARHIST/APMST per line for nothing; same UPD=4 side effect as AR5.

## AR7

**Mode:** Interactive · **Lines:** 398 · **Relevance:** VENDOR, PO, PRICING

Direct-vendor ("non-PRO MDs") billing: for each vendor invoice shipped direct to a member, bills the member (plus PRO surcharge) on a new PRO invoice and optionally posts the vendor invoice to AP.

**Files:** reads CONTROL ('UPD','APBAT','APPER','INV','MS'), ARMST, APMST, VNIDX, VNMST, VENDORD, APHIST, IVEND, ARINV · writes ARMST, APMST, VNMST, VENDORD, IVEND, ARINV, ARSHIP, APDIST, APHIST, CONTROL  
**Calls:** !SLEEP$

| ID | Rule | Source | Tag |
|---|---|---|---|
| AR7.01 | Not allowed while CONTROL 'UPD' attr 1 > 2 (month-end in progress) | L33-34 | KEEP |
| AR7.02 | A/P posting optional (Y/N); if Y, AP batch = CONTROL 'APBAT' (+1 written back, shown 3-digit) and period CONTROL 'APPER' changeable within the same YYMM window logic as AR.INP.PAYMNTS | L38-84 | QUESTION |
| AR7.03 | Billing date defaults to today; if billing day > 25 and billing month = AR month (CONTROL 'UPD' attr 2) billing is blocked; otherwise day > 25 pushes the member due month out one more month | L85-101 | KEEP |
| AR7.04 | Member terms: default "2% 10" (2%); else 0-20% (0 = NET) with optional future billing of 0-9 extra months (invoice AGING = −months, posted to FUTURE) | L103-120 | KEEP |
| AR7.05 | Member terms text = "<pct>% MM/10/YY" (or "NET MM/10/YY"), MM = billing month + 1 (+1 if after 25th) + future months — i.e. discount if paid by the 10th of that month | L97, L121-123 | KEEP |
| AR7.06 | Vendor must exist in APMST and not be locked; APMST vendor mapped to VNMST via VNIDX attr 1 | L142-151 | KEEP |
| AR7.07 | Member must exist in ARMST and not be locked | L157-159 | KEEP |
| AR7.08 | Duplicate vendor invoice check: AP key = VENDOR*VENDINV; if already in APHIST, warn and allow duplicate only on second <CR>, keyed VENDOR*VENDINV*n (n from APHIST attr 10 NUMBER, max 9); a split invoice (multivalued APHIST attr 6 DUE) cannot be duplicated | L183-210 | KEEP |
| AR7.09 | AP due date default: day = first 2 chars of APMST attr 10 DUE.DAYS, month = member due month, year = vendor invoice year; if DUE.DAYS = "nnCM" → current month day nn; future billing shifts vendor month; operator may override | L219-249 | QUESTION |
| AR7.10 | Billing amount keyed in cents with no decimal point; non-numeric or decimal rejected | L250-257 | QUESTION |
| AR7.11 | AP discount default = APMST attr 9 PCT; entry > 20 is treated as a dollar amount, else a percent; NET = gross − discount | L260-276 | QUESTION |
| AR7.12 | PO (≤ 8 chars) matched to member's VENDORD line for the same vendor: BILLED (attr 5) += amount; when billed > 90% of PO AMOUNT the PO line is removed as complete | L277-300 | QUESTION |
| AR7.13 | Shipping charges eliminated 8-5-99 (SHIP forced to 0; entry commented out) | L8, L303-313 | OBSOLETE |
| AR7.14 | PRO surcharge = ROUND(amount × APMST attr 30 / 1000) (attr 30 = surcharge rate in tenths of a percent, shown as "SURCHG PCT"; dict names attr 30 SRCH/R.ADD.SHORT) | L153, L314-315 | KEEP |
| AR7.15 | If APMST attr 29 CODE = 2, surcharge is added to the member's billed amount; otherwise surcharge is recorded but not added to the bill | L316 | QUESTION |
| AR7.16 | Hard-coded vendors 497, 569 ("Charge Back") and 1322 are excluded from IVEND member-by-vendor purchase totals | L317-318 | QUESTION |
| AR7.17 | IVEND (per member): vendor list sorted, attr 2 amount += billed amount, attr 3 surcharge += SRCH; entry removed when amount nets to 0 | L319-333 | KEEP |
| AR7.18 | ARMST: YTD.SALES (9) += amount, BALANCE (15) += amount, SURCHG (21) += surcharge, LAST.SALE (18) = billing date; NEW.MON (10) or FUTURE (24) += amount | L335-337 | KEEP |
| AR7.19 | If VNMST attr 13 (F13, purpose unnamed — used as "vendor credit" flag) is set: ARMST attr 22 VN.CRED += amount and ARINV attr 8 VN.CRED = 1 for the new invoice (10/10/94) | L336, L368-370 | QUESTION |
| AR7.20 | High credit: if BALANCE/100 > HI.CRED (attr 16, whole dollars) then HI.CRED = INT(BALANCE/100) | L338 | KEEP |
| AR7.21 | APDIST record VENDOR*INV: STATUS "100", batch = period:batch:counter, GROSS = vendor amount (pre-surcharge), DISC = ROUND(gross × disc% / 100), DATE = vendor inv date, DUE, LEDGER/AMOUNT from APMST attr 12; APHIST date/gross/net/due | L340-355 | KEEP |
| AR7.22 | Hard-coded vendor 1336: shipping added to AP gross and net (now always 0) | L345-347 | QUESTION |
| AR7.23 | PRO invoice number = CONTROL 'INV' attr 1 + 1, wraps to 1 at 99999 | L357-360 | QUESTION |
| AR7.24 | ARINV appended: number, date, amount (cents), TERMS %, AGING | L361-367 | KEEP |
| AR7.25 | ARSHIP record member:INV with 1 date, 2 VENDOR (not product), 4 amount, 5 PO, 6 terms text, 7 vendor inv #, 8 surcharge; attr 3 qty left blank so invoice print treats it as a vendor billing | L371-381 | OBSOLETE-INTEGRATION |
| AR7.26 | Prints a bill slip (PRO invoice #, date, amount, due, account) to the terminal's aux printer | L374-380 | OBSOLETE |
| AR7.27 | CONTROL 'MS' attrs 1/2/3 += surcharge, shipping, billed amount (month sales summary) | L334, L383-388 | QUESTION |
| AR7.28 | On vendor change/exit: APMST attr 15 YTD.GROSS += AP gross, attr 16 OPEN.GROSS += AP gross, attr 31 (dict R.CSZ; used as surcharge accumulator) += surcharge; VNMST attr 7 YTD.SALES += billed total, attr 9 SURCHARGES += surcharge | L129-137 | QUESTION |

**Bugs / oddities:** Dollar-amount discount (>20) sets NET correctly but APDIST DISC is still computed as a percent (L344); VNMST LOCKED clause sleeps then updates a record it never read (L133-137); invoice counter wraps at 99999 here but 999999 in AR3; APMST/VNMST attrs 30/31/13 used for purposes that contradict dict names; APMST locked for the whole vendor session; NET undefined when AP=N but not used.

## ARHIST.CHANGE

**Mode:** Utility/maintenance · **Lines:** 9 · **Relevance:** none

One-off script moving member 7063's 2009 history (ARHIST.09) to member 3417.

**Files:** reads ARHIST.09 · writes ARHIST.09  
**Calls:** EXECUTE SELECT ARHIST.09

| ID | Rule | Source | Tag |
|---|---|---|---|
| ARHIST.CHANGE.01 | Hard-coded source member 7063 and target member 3417: re-key ARHIST.09 records to "3417":old key chars 5-10 and delete originals | L2, L5-7 | QUESTION |

**Bugs / oddities:** Overwrites any existing target record; no locking.

## CHK.CAN.TOTS

**Mode:** Batch · **Lines:** 25 · **Relevance:** none

Pre-month-end check (04-26-12) that aborts if Canadian members have any balances.

**Files:** reads ARMST · writes VOC ('SJL-RESULT')  
**Calls:** EXECUTE SUM ARMST WITH TYPE = "CAN"

| ID | Rule | Source | Tag |
|---|---|---|---|
| CHK.CAN.TOTS.01 | If SUM of BALANCE, NEW.MON, CURRENT, 30DAYS, 60DAYS over members with TYPE = "CAN" is non-blank, stop the monthly update ("contact Computyme") | L7-21 | QUESTION |

**Bugs / oddities:** Inner loop reuses L; `OPEN 'VOC' THEN` / `WRITE ... ON 'SJL-RESULT'` lack a file variable; why Canadian members must carry zero balances before month-end is not explained.

## CLEAN.UP.MV

**Mode:** Utility/maintenance · **Lines:** 16 · **Relevance:** none

One-off (2000) fix deleting the last product/qty/amount value on ARHIST.95 records (trailing empty multivalue).

**Files:** reads ARHIST.95 · writes ARHIST.95  
**Calls:** none (needs select list)

| ID | Rule | Source | Tag |
|---|---|---|---|
| CLEAN.UP.MV.01 | Deletes the last value of attrs 2, 3, 4 unconditionally | L10-12 | OBSOLETE |

**Bugs / oddities:** Deletes real data if the trailing value is not empty.

## CONV.ARHIST

**Mode:** Utility/maintenance · **Lines:** 26 · **Relevance:** none

One-off (10-29-02) renumbering of a series of invoices (+50) in ARHIST keys and ARINV.

**Files:** reads ARHIST, ARINV · writes ARHIST, ARINV  
**Calls:** EXECUTE SELECT ARHIST WITH NUMBER GE "100201"

| ID | Rule | Source | Tag |
|---|---|---|---|
| CONV.ARHIST.01 | Hard-coded: invoices ≥ 100201 renumbered to invoice + 50 (ARHIST key member:invoice and ARINV attr 1) | L8-23 | OBSOLETE |

**Bugs / oddities:** Not idempotent; target ARHIST key overwritten if it exists; ARINV LOCATE on invoice number only attr 1.

## CONVERT.FSINVS

**Mode:** Utility/maintenance · **Lines:** 86 · **Relevance:** none

Moves all open invoices of FotoSource members (ARMST TYPE = "CAN") onto the FotoSource master account 7000 (06-23-11).

**Files:** reads ARMST, ARINV · writes ARMST, ARINV (deletes member ARINV)  
**Calls:** EXECUTE SELECT ARMST WITH TYPE = "CAN"

| ID | Rule | Source | Tag |
|---|---|---|---|
| CONVERT.FSINVS.01 | Hard-coded FotoSource master account 7000 | L22 | QUESTION |
| CONVERT.FSINVS.02 | FotoSource members are identified by ARMST TYPE = "CAN" (same type AR1B calls Canadian affiliate / AR8 treats as FotoSource, attr 23 = 3) | L27 | QUESTION |
| CONVERT.FSINVS.03 | Each member's ARINV invoices are prepended to account 7000's ARINV and the member ARINV deleted; member NEW.MON and BALANCE set to 0; master NEW.MON and BALANCE += Σ invoice AMOUNT | L43-55 | QUESTION |

**Bugs / oddities:** Uses gross AMOUNT not open amount (AMOUNT − AMTPAID); only NEW.MON bucket moved, other aging buckets left on members; trimming at L48 chops the last character of the master's existing data when it isn't empty; master written only at the end, so an ABORT mid-run loses deleted member invoices.

## DEL.ARINV

**Mode:** Utility/maintenance · **Lines:** 42 · **Relevance:** none

Deletes one open invoice from a member's ARINV record and backs its open balance out of ARMST aging buckets.

**Files:** reads ARMST, ARINV · writes ARMST, ARINV  
**Calls:** UPD.ARLOG (commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| DEL.ARINV.01 | Invoice located by invoice number in ARINV attr 1 (multivalued per member); amount due = attr 3 AMOUNT minus SUM(attr 7 AMT.PAID) (cents) | L19-23 | KEEP |
| DEL.ARINV.02 | Aging bucket = ARINV attr 5 AGING capped at 4; amount due subtracted from ARMST attr 10+AGE (10 NEW.MON, 11 CURRENT, 12 D30, 13 D60, 14 D90) and from attr 15 BALANCE | L21,L31-32 | KEEP |
| DEL.ARINV.03 | Removes values at that position from ARINV attrs 1-8 (invoice, date, amount, terms, aging, date paid, amount paid, VN.CRED) | L30 | KEEP |
| DEL.ARINV.04 | Header says deletion is logged to ARLOG (07-23-09) but the call is commented out; no audit trail | L5,L35 | QUESTION |

**Bugs / oddities:** MATREADU without LOCKED clause conflates locked and not-found (L15,L17); no confirmation before delete; no audit.

## EMAIL.FSINV

**Mode:** Outbound-generator · **Lines:** 28 · **Relevance:** none

Builds an 'email.bat' command line in the FSINV directory file to email an FSINV invoice attachment via the ericmail utility.

**Files:** reads/writes FSINV ('email.bat')  
**Calls:** none (DOS execute commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| EMAIL.FSINV.01 | Email command = C:\ericmail from/to/subject/body/server IP/CC (EMAIL.PARAMS<2..6>) with attachment C:\ACCOUNTS\PRO\FSINV\<FSID> | L15-23 | OBSOLETE-INTEGRATION |
| EMAIL.FSINV.02 | Waits on lock of FSINV 'email.bat' (single shared batch file) | L8-13 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Execute is commented out, so no email is sent from here; IDATE param unused.

## EMAIL.INVOICES

**Mode:** Outbound-generator · **Lines:** 41 · **Relevance:** none

Builds INVOICES.DBF (email notification feed) listing invoice PDF URLs per member for invoices posted on a given date.

**Files:** reads WEBSTMT (ARHIST opened, unused) · writes INVOICES.DBF (cleared first)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT WEBSTMT

| ID | Rule | Source | Tag |
|---|---|---|---|
| EMAIL.INVOICES.01 | Include WEBSTMT invoices with NET <> 0 and DT.POSTED = entered date, by member | L19 | KEEP |
| EMAIL.INVOICES.02 | Link = http://members.promaster.com/invoices/<chars 5-10 of key>.pdf; member = key chars 1-4 | L10-11,L21-22 | OBSOLETE-INTEGRATION |
| EMAIL.INVOICES.03 | Max 25 links per INVOICES.DBF record; overflow continues in member:count records | L24-37 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** L35 `IF ... COUNT = COUNT + 1` lacks THEN; no header comment/date.

## FIX.AGE

**Mode:** Utility/maintenance · **Lines:** 24 · **Relevance:** none

One-off (2003) fix-up resetting ARINV aging for EDI invoices from the due date logged in EDILOG.

**Files:** reads EDILOG, ARINV · writes ARINV  
**Calls:** none (uses an active select list)

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.AGE.01 | Aging (ARINV attr 5) = (current month + 1) - month of EDILOG attr 8 IDUE; EDILOG key = member(4) + invoice(5) | L7,L12-17 | OBSOLETE |

**Bugs / oddities:** Month-only arithmetic ignores year (Dec/Jan wrap gives wrong age); MATREADU no LOCKED clause; error messages say ARING.

## FIX.AGE.MEMB

**Mode:** Utility/maintenance · **Lines:** 34 · **Relevance:** none

Fix-up: set aging to an operator-entered value for all of one member's invoices dated on/before a cutoff.

**Files:** reads ARMST, ARINV · writes ARINV  
**Calls:** EXECUTE SELECT ARINV

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.AGE.MEMB.01 | For member's ARINV entries with attr 2 DATE <= cutoff, set attr 5 AGING = entered age (any numeric) | L19-27 | OBSOLETE |

**Bugs / oddities:** Does not re-bucket ARMST aging totals; MATREADU no LOCKED clause.

## FIX.AGING

**Mode:** Utility/maintenance · **Lines:** 24 · **Relevance:** none

Month-end fix-up: for invoices of a given date with terms 0 and aging 0, set aging to -1.

**Files:** reads/writes ARINV  
**Calls:** EXECUTE SELECT ARINV WITH DATE

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.AGING.01 | If ARINV attr 2 DATE = entered date and attr 4 TERMS = 0 and attr 5 AGING = 0 then AGING = -1 (one month future) | L13-17 | QUESTION |

**Bugs / oddities:** Why terms-0 invoices must be aged -1 is undocumented; MATREADU no LOCKED clause.

## FIX.ARINV

**Mode:** Utility/maintenance · **Lines:** 19 · **Relevance:** none

One-off conversion of ARINV invoice dates (attr 2) from MM/DD/YY text to internal date.

**Files:** reads/writes ARINV  
**Calls:** none (active select list)

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.ARINV.01 | Any ARINV attr 2 value not 5 digits is ICONV'd D2/ | L7-15 | OBSOLETE |

**Bugs / oddities:** READVU without LOCKED clause.

## FIX.ARINV.FSTOT

**Mode:** Utility/maintenance · **Lines:** 100 · **Relevance:** none

One-off (10/2011) fix-up making ARINV open-invoice amounts equal the ARHIST line total (adding missing FSTOT), and adjusting ARMST balances.

**Files:** reads ARHIST, ARINV, ARMST · writes ARINV, ARMST  
**Calls:** INCLUDE ARHIST.FIELDS/ARINV.FIELDS/ARMST.FIELDS; EXECUTE SUM ARMST, SELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.ARINV.FSTOT.01 | Hard-coded starting invoice 932587 (only ARHIST invoices >= this) | L35 | QUESTION |
| FIX.ARINV.FSTOT.02 | Hard-coded member 7000 holds all invoices whose number starts with 'S' (FS invoices) instead of the member's own ARINV | L23,L30,L50,L76-81 | QUESTION |
| FIX.ARINV.FSTOT.03 | Invoice amount = SUM(ARHIST AMOUNT lines); difference applied to ARMST BALANCE and aging bucket NEWMON+AGE | L49,L65-72 | OBSOLETE |

**Bugs / oddities:** Writes 7000 records only at end (long lock); one-off.

## FIX.FSINV

**Mode:** Utility/maintenance · **Lines:** 31 · **Relevance:** PO

Fix-up that rewrites the <ORDERNUMBER> tag in FSINV XML invoice staging records with the member PO from ARHIST.

**Files:** reads ARHIST · reads/writes FSINV  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.FSINV.01 | ORDERNUMBER = ARHIST attr 5 (PO) for key member:vendor-invoice-number taken from the <ACCOUNTNUMBER> and <VENDORINVOICENUMBER> tags | L13-21 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Depends on tag order (ORDERNUMBER must follow the other two); READU without LOCKED.

## FSINV.FIELDS

**Mode:** Utility/maintenance · **Lines:** 23 · **Relevance:** PO, PRICING

Not a program: list of XML tag names making up an FSINV electronic invoice (header and line fields).

**Files:** none · Calls: none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| FSINV.FIELDS.01 | FSINV invoice field set: VENDORINVOICENUMBER, VENDORID, ACCOUNTNUMBER, INVOICEDATE, SHIPVIA, TRACKINGNUMBER, FREIGHT, CREDITINVOICE, INVOICEDETAILTYPE, DISCOUNTPERCENT, DISCOUNTDAYS, NETDAYS, COMMENT, INVOICENETTOTAL, FEDERALTAXAMOUNT, REGIONALTAXAMOUNT, ORDERNUMBER, LINENUMBER, SHIPPEDQUANTITY, PRODUCTCODE, INVOICEUNITPRICE, DESCRIPTION | L2-23 | OBSOLETE-INTEGRATION |

## IV.BLD.FSINV

**Mode:** Outbound-generator · **Lines:** 69 · **Relevance:** PO

Rebuilds the FSINV invoice export (XLS/XML) for Canadian members' invoices of a prior billing date and optionally emails it to PhotoSource.

**Files:** reads CONTROL ('FSINV.FIELDS','FSINV.EMAIL.PARAMS'), ARHIST, SCANORD, ORDHIST, IVMST, ARMST · writes FSINV (via subroutine)  
**Calls:** IV.UPD.FSINV.XLS, EMAIL.FSINV; EXECUTE SELECT ARHIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.BLD.FSINV.01 | Select ARHIST with member TYPE = "3" (shown as "CAN" = Canadian members) and DATE = billing date (not in future) | L42-51 | QUESTION |
| IV.BLD.FSINV.02 | Order link: ARHIST VINVNO → SCANORD attr 12 VORD → ORDHIST key = VORD chars 4-9 (strips 3-char vendor prefix) | L57-58 | KEEP |
| IV.BLD.FSINV.03 | Export columns come from CONTROL 'FSINV.FIELDS' (tab-separated header) | L30,L35 | OBSOLETE-INTEGRATION |
| IV.BLD.FSINV.04 | Export emailed to PhotoSource using CONTROL 'FSINV.EMAIL.PARAMS' (hard-coded recipient description) | L63-67 | QUESTION |

**Bugs / oddities:** Error text names IV.UPD.SCANORD; PASS program name typo 'IV..BLD.FSINV'; ARSHIP passed but never opened.

## IV.UPD.FSINV

**Mode:** Outbound-generator · **Lines:** 87 · **Relevance:** VENDOR

Original (June 2011) builder of a pseudo-XML invoice file for FotoSource (Canada) from an ARSHIP invoice, appended into FSINV record ORDERSmmddyy.

**Files:** reads FSINV · writes FSINV (record ORDERS<MMDDYY>)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.FSINV.01 | Field list driven by FSINV.FIELDS (header fields until LINENUMBER, then detail fields); lines starting '*' skipped | L15-57 | OBSOLETE-INTEGRATION |
| IV.UPD.FSINV.02 | Hard-coded VENDORID = 371 (PRO's vendor id at FotoSource) | L21 | QUESTION |
| IV.UPD.FSINV.03 | Header: account = member ID, invoice # = INV, date = today (MM-DD-YY), ship via UPS, credit NO, detail type ORDER, discount/net days 0, net total = SUM(ARSHIP amount) cents→MD2, taxes 0, order number = ARSHIP PO | L19-36 | OBSOLETE-INTEGRATION |
| IV.UPD.FSINV.04 | Detail per product: line #, shipped qty, product code, unit price = ARSHIP line AMOUNT (MD2) | L41-57 | QUESTION |

**Bugs / oddities:** tags written as '<<TAG>>' (malformed XML). UPD.FSINV is called per line and writes HDR:DET accumulated so far each time, so the header and earlier lines are duplicated per line; when a new file is created the record gets only the XML header and '<ORDERS>' and the first line's data is dropped. "Unit price" is the extended line amount. Superseded by IV.UPD.FSINV.XLS (IV.UPD.SCANORD now calls the .XLS version).

## IV.UPD.FSINV.XLS

**Mode:** Outbound-generator · **Lines:** 111 · **Relevance:** VENDOR, PRICING

Builds a tab-delimited (.xls) invoice/dues file for FotoSource (Canada) member billing, one row per invoice line, appended to FSINV record ORDERS|DUES<MMDDYYYY>.xls. Current version, called by IV.UPD.SCANORD (its SUBROUTINE statement still says IV.UPD.FSINV).

**Files:** reads FSINV · writes FSINV  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.FSINV.XLS.01 | Invoice date from PASS<2> (internal), formatted dd/mm/yyyy; file id TYPE:MMDDYYYY.xls where TYPE = DUES when PASS='AR8' else ORDERS | L21-25, L40 | OBSOLETE-INTEGRATION |
| IV.UPD.FSINV.XLS.02 | Hard-coded VENDORID = 371 | L38 | QUESTION |
| IV.UPD.FSINV.XLS.03 | Discount % from first word of ARSHIP TERMS; 'NET' → 0.00 and 0 discount days, else percent sent as whole number (e.g. 2.00) with 30 discount days; net days always 31 | L27-28, L48-51 | QUESTION |
| IV.UPD.FSINV.XLS.04 | Product 9990 on the invoice is the federal tax line: its amount is sent as FEDERALTAXAMOUNT, excluded from detail, and subtracted from INVOICENETTOTAL | L29-31, L53-54, L67 | QUESTION |
| IV.UPD.FSINV.XLS.05 | Dues invoices (PASS=AR8): ship via blank, detail type MEMO; otherwise UPS / ORDER | L41-47 | KEEP |
| IV.UPD.FSINV.XLS.06 | Order number = ARSHIP PO when called from IV.UPD.SCANORD, else ARHIST PO position | L56-57 | OBSOLETE-INTEGRATION |
| IV.UPD.FSINV.XLS.07 | Line number = position of product in ORDHIST product list (else sequence); unit price = INT(extended amount / qty + .5) cents → MD2 | L65-66 | KEEP |
| IV.UPD.FSINV.XLS.08 | Freight 0, regional tax 0, credit invoice NO, tracking blank | L43-45, L55 | QUESTION |

**Bugs / oddities:** header "XML" comments are stale (tab-delimited). INVOICENETTOTAL = OCONV(...,'MD2') − FEDERAL.TAX mixes formatted string arithmetic. Division by QTY=0 not guarded. ARHIST.PO used on array A dimensioned for ARSHIP fields — relies on positional equivalence.

## IV.UPD.FSINV.XML

**Mode:** Test-variant · **Lines:** 87 · **Relevance:** VENDOR

Duplicate of IV.UPD.FSINV (June 2011) producing proper '<TAG>' XML into FSINV ORDERSmmddyy.xml.

**Files:** reads FSINV · writes FSINV  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.FSINV.XML.01 | Writes well-formed '<TAG>value</TAG>' elements and '.xml' suffixed record id; otherwise identical, including hard-coded VENDORID 371 | L13, L21, L63-69 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** same per-line duplication / first-line-drop bug as IV.UPD.FSINV.

## IV.UPD.RETURNS

**Mode:** Batch · **Lines:** 97 · **Relevance:** PRICING, VENDOR, PRODUCT

Auto-credits unbilled member returns: prices returned lines with surcharge, posts credit invoices to AR, updates member sales history and return statistics.

**Files:** reads RETURNS, ARMST, IVMST, IVSOLD, CONTROL ('UPD','MS','INV'), VNMST · writes ARMST, ARINV, ARSHIP, IVRET, IVSOLD, CONTROL, RETURNS, VNMST  
**Calls:** EXECUTE SELECT RETURNS WITH NO DT.BILLED

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.UPD.RETURNS.01 | Run blocked if CONTROL 'UPD' attr 1 > 2 (update-cycle state) | L19-20 | QUESTION |
| IV.UPD.RETURNS.02 | Only RETURNS with no DT.BILLED (attr 8) processed; after posting attr 8 = posting date | L26, L91 | KEEP |
| IV.UPD.RETURNS.03 | Return line qty is negated; unit cost = special cost attr 9 if special qty attr 7 > 0 and /qty/ ≥ attr 7, else basic cost attr 8 (cents) | L40, L44 | KEEP |
| IV.UPD.RETURNS.04 | Credit price includes surcharge: COST + INT(COST × attr 12 / 1000 + .5) (attr 12 in tenths of %) | L45 | KEEP |
| IV.UPD.RETURNS.05 | Surcharge portion backed out of line total: INT(TOT − TOT/(1000+PCT)×1000 ± .5) accumulated to member SC, vendor VSC and CONTROL 'MS' attr 1 | L47-49 | KEEP |
| IV.UPD.RETURNS.06 | IVRET<prod>: attr 1 += returned qty, attr 2 += returned value (cents) | L50-52 | KEEP |
| IV.UPD.RETURNS.07 | Member IVSOLD history decremented by returned qty; product removed when it nets to 0 | L53-61, L66 | KEEP |
| IV.UPD.RETURNS.08 | ARMST updates: attr 9 YTD sales, 10 NEW.MON, 15 balance, 21 surcharge += credit; attr 18 last sale = date; attr 17 open orders reduced (floor 0); attr 26 PRO.SALES += total − surcharge; high credit attr 16 (whole dollars) raised if balance/100 exceeds it | L67-71 | QUESTION |
| IV.UPD.RETURNS.09 | New invoice number from CONTROL 'INV' +1, wraps to 1 at 999999; ARINV<member> gets invoice, date, amount, terms 0, aging 0 | L74-82, L88 | KEEP |
| IV.UPD.RETURNS.10 | ARSHIP<member:inv> written with date, products, qtys, amounts (cents), ref = RETURNS attr 4, terms text "NET mm/10/yy" (next month 10th), surcharge, posting date | L21-24, L83-84 | KEEP |
| IV.UPD.RETURNS.11 | CONTROL 'MS' attr 3 += credit total (month-to-date sales control) | L85, L89 | QUESTION |
| IV.UPD.RETURNS.12 | Hard-coded vendor 497: all return credits added to VNMST 497 attr 7 (YTD sales) and attr 9 (surcharges) | L94-96 | QUESTION |

**Bugs / oddities:** L36 reads IVSOLD with PROD (not yet set / previous member's product) but writes to IVSOLD MEMBER — history read from wrong key, likely overwriting the member's IVSOLD record. L43 adds the previous line's TOT to MS(2) before current TOT is computed (and never the last line). ETOT never assigned (always 0). UNITS accumulated but unused. Returns whose member is locked/missing still get DT.BILLED stamped (L91 outside the ARMST THEN) — credit silently lost. Vendor 497 credited regardless of product's actual vendor. Year in terms text not 2-digit-padded after +1.

## IV4A

**Mode:** Test-variant · **Lines:** 117 · **Relevance:** PRICING, VENDOR

2001 interactive member-returns credit entry (older copy of IV4B).

**Files:** reads ARMST, IVMST, IVRET, ARINV, VNMST, CONTROL, IVSOLD, ARHIST (opened, unused) · writes ARMST, IVRET, ARINV, ARSHIP, IVSOLD, CONTROL, VNMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV4A.01 | Invoice numbers wrap at 99999; no average-cost line, no DT.POSTED, no >100 qty confirmation | L96 | OBSOLETE |

**Bugs / oddities:** ARHIST opened (comment "in progress") but never used.

## IV4B

**Mode:** Interactive · **Lines:** 127 · **Relevance:** PRICING, VENDOR, PRODUCT

Operator-keyed member returns: credits a member for returned products at current cost + surcharge, posts a credit invoice and return statistics.

**Files:** reads ARMST, IVMST, IVRET, ARINV, VNMST, IVSOLD, CONTROL ('UPD','MS','INV') · writes ARMST, IVRET, ARINV, ARSHIP, IVSOLD, CONTROL, VNMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV4B.01 | Run blocked when CONTROL 'UPD' attr 1 > 2 | L23-24 | QUESTION |
| IV4B.02 | Operator keys terms (default 2%/10th of next month; 0-9%, 0 = NET) | L33-40 | QUESTION |
| IV4B.03 | Member reference number captured on the credit (ARSHIP attr 5) | L48, L114 | KEEP |
| IV4B.04 | Only charge products 9998 and 9999 allowed among products > 9900; amount forced negative, added to MS attr 2 | L54-62 | QUESTION |
| IV4B.05 | Returned qty forced negative; qty > 100 needs confirmation | L63-69 | KEEP |
| IV4B.06 | Credit unit price = special cost attr 9 if attr 7 > 0 and /qty/ ≥ attr 7, else basic cost attr 8, plus surcharge (attr 12 tenths of %) | L70, L77 | KEEP |
| IV4B.07 | ARSHIP attr 15 cost = qty × average cost (SUM attr 25 / SUM attr 24), else raw cost attr 19 with yen converted at hard-coded 110 ¥/$ | L71-76, L94 | QUESTION |
| IV4B.08 | Surcharge split, IVRET, IVSOLD, ARMST, ARINV (wrap 999999), CONTROL MS updates as IV.UPD.RETURNS | L79-120 | KEEP |
| IV4B.09 | Hard-coded vendor 497 receives all return credits in VNMST attr 7/9 | L123-125 | QUESTION |

**Bugs / oddities:** returned goods are not added back to IVMST stock layers (attr 24-26) — stock unaffected by returns. Yen conversion constant 110 hard-coded. ETOT/UNITS not reset per member for UNITS.

## LBL.TEST

**Mode:** Test-variant · **Lines:** 27 · **Relevance:** none

Test print of "PRO invoice" remittance labels (invoice #, date, amount, terms, account) for selected ARSHIP/ARHIST invoices, each label printed 275 times.

**Files:** reads ARSHIP, ARHIST · writes none (printer)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| LBL.TEST.01 | Look up invoice in ARSHIP first, fall back to ARHIST; key ID[1,4] = member account, ID[5,5] = PRO invoice number | L14-15,20,22 | OBSOLETE |
| LBL.TEST.02 | Label shows date (attr 1), amount attr 4 in cents formatted MD2, "Invoice Due" = attr 6 (TERMS) | L21-22 | OBSOLETE |

**Bugs / oddities:** FOR I=1 TO 275 prints the same label 275 times per invoice (L13) — test/one-off. Header says "label for Vendor Invoice" but prints PRO invoice.

## LJ.INV1

**Mode:** Report/print · **Lines:** 49 · **Relevance:** PRICING

Prints laser (PCL) member invoices from a select list of ARSHIP records.

**Files:** reads ARSHIP, ARMST, IVMST, IVMST.DISC (CONTROL, APMST opened but unused) · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| LJ.INV1.01 | Invoice header uses ARMST (key ID[1,4]) name attr 1, street attr 3, city/state/zip attrs 4-6; invoice # = ID[5,5]; date attr 1; PO attr 5, terms attr 6, vendor invoice attr 7 | L19,41-45 | SIMPLIFY |
| LJ.INV1.02 | Line description from IVMST attr 4, else IVMST.DISC attr 4, else blank | L24-26 | KEEP |
| LJ.INV1.03 | Lines with QTY=0 are not printed; unit price = AMOUNT/QTY (amount attr 4 in cents, shown /100); if QTY non-numeric zero, unit = AMOUNT | L28-30 | KEEP |
| LJ.INV1.04 | Invoice total = sum of line AMOUNTs (cents); no surcharge/freight lines added | L31,34 | QUESTION |
| LJ.INV1.05 | 39 lines per page, then page break and reprinted header | L32 | OBSOLETE |

**Bugs / oddities:** MSG '** THIS IS A CREDIT **' defined but never printed (credits not distinguished); GTOT never used; QTY=0 lines skipped but their amounts (if any) excluded from total.

## LJ.INV2

**Mode:** Test-variant · **Lines:** 54 · **Relevance:** PRICING

Variant of LJ.INV1 (laser invoice print from ARSHIP) using LOOP/REPEAT, form feeds and PRINTER ON spooling.

**Files:** reads ARSHIP, ARMST, IVMST, IVMST.DISC · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| LJ.INV2.01 | Same rules as LJ.INV1.01-05; differs only in unlimited line loop (stops at first blank product), form feed page breaks, printer reset ESC E, wider product column | L24-37,43 | OBSOLETE |

**Bugs / oddities:** same as LJ.INV1.

## LJ.INV3

**Mode:** Test-variant · **Lines:** 54 · **Relevance:** PRICING

Near-identical copy of LJ.INV2 (laser invoice print), differing only in print column layout and no ESC E reset.

**Files:** reads ARSHIP, ARMST, IVMST, IVMST.DISC · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| LJ.INV3.01 | No rule differences from LJ.INV2; layout-only differences (L33, L39, L43-44) | L33-44 | OBSOLETE |

**Bugs / oddities:** duplicate of LJ.INV2.

## MOD.AGING

**Mode:** Utility/maintenance · **Lines:** 62 · **Relevance:** none

One-off fix-up (2004) re-deriving ARINV aging buckets from ARHIST terms for invoices dated on/after 02/15/04, then rebuilding ARMST aging totals.

**Files:** reads ARHIST, ARINV, ARMST · writes ARINV, ARMST  
**Calls:** INCLUDE FILE.INCLUDES ARMST.FIELDS/ARHIST.FIELDS/ARINV.FIELDS (not in extract)

| ID | Rule | Source | Tag |
|---|---|---|---|
| MOD.AGING.01 | Hard-coded cutoff date 02/15/04 for invoices to re-age | L14 | OBSOLETE |
| MOD.AGING.02 | Due months DM = number before '/' in 2nd word of ARHIST TERMS; new aging = 4 - DM written to ARINV attr 5 (AGING) for that invoice | L22-29 | QUESTION |
| MOD.AGING.03 | ARMST aging rebuild: clear FUTURE and NEW.MON..90DAYS buckets, then for each open invoice add (AMOUNT attr 3 - AMT.PAID attr 7, cents) to FUTURE if aging < 0 else to bucket NEW.MON+min(aging,4) | L39-53 | KEEP |

**Bugs / oddities:** include files not available so ARMST field equates unconfirmed (dict: 10 NEW.MON, 11 CURRENT, 12-14 30/60/90, 24 FUTURE); MATREADU ELSE aborts on not-found (L59-60); "4 - DM" formula meaning unclear.

## MOD.AR.INV

**Mode:** Interactive · **Lines:** 140 · **Relevance:** none

Operator changes terms (discount %) and future-dating/aging of a single open member invoice in ARINV and moves the amount between ARMST aging buckets.

**Files:** reads ARMST, ARINV, CONTROL ('MON') · writes ARINV attrs 4-5, ARMST attrs 10-14, 24; CONTROL 'MON' (initialised if missing)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| MOD.AR.INV.01 | Aging code meaning: >4 over 90 days past due, 4 = 90, 3 = 60, 2 = 30, 1 = current, 0 = due next month, negative = future, due in month (/aging/+1+current month) | L45-56 | KEEP |
| MOD.AR.INV.02 | Terms entry must be a single digit discount % 0-9 (optionally with %); blank keeps existing | L88-95 | QUESTION |
| MOD.AR.INV.03 | Future aging entry is 0-9 months, stored as negative number (aging*-1) | L109-113 | KEEP |
| MOD.AR.INV.04 | On update, ARMST buckets moved: orig 0 -> future only if invoice month = current month (attr 10 NEW.MON -> attr 24 FUTURE); orig >0 -> future moves from attr (orig+10) to 24; orig >0 -> 0 moves to attr 10; orig capped at 4 | L126-136 | QUESTION |
| MOD.AR.INV.05 | Amounts in ARINV attr 3 are cents (displayed MD2) | L57 | KEEP |

**Bugs / oddities:** no bucket move for future -> current or orig 0 in a different month; entering aging 0 stores 0 (not -0) fine but cases where AGING unchanged still pass through CASE; "1N" restricts future dating to 9 months.

## NEWAR5

**Mode:** Report/print · **Lines:** 107 · **Relevance:** PRICING

Prints monthly member statements (three-part form) from ARINV open invoices with prompt-pay discount, past-due flags, aging totals and grand totals; advances CONTROL 'UPD' step from 3 to 4.

**Files:** reads ARMST, ARINV, CONTROL ('UPD') · writes ERROR (missing records), CONTROL 'UPD' attr 1  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| NEWAR5.01 | Month-end sequencing: CONTROL 'UPD' attr 1 < 3 warns "statements being printed with no update" and requires typing OK; on finish, if UPD=3 set to 4 | L18-23,105 | SIMPLIFY |
| NEWAR5.02 | Members with ARMST attr 15 (BALANCE) = 0 get no statement | L44 | KEEP |
| NEWAR5.03 | Line gross = ARINV AMOUNT (attr 3) - AMT.PAID (attr 7), cents | L56 | KEEP |
| NEWAR5.04 | Prompt-pay discount: if aging (ARINV attr 5) < 2, discount = round(gross * TERMS% (attr 4) / 100); else no discount and print "* PAST-DUE *" | L66-68 | KEEP |
| NEWAR5.05 | Discount deadline printed as "MD/10" where MD = (statement month + 2) - aging, wrapped into 1-12 (0 -> 12) — i.e. discount if paid by the 10th of month MD | L27,62-65,67 | QUESTION |
| NEWAR5.06 | Invoices with aging <= 0 are future: excluded from amount due (DUE=0), flagged with '*' on invoice number; still included in gross and in discount total | L70 | QUESTION |
| NEWAR5.07 | Totals: future = gross - due; net due = due - discount; footer shows ARMST aging buckets attrs 11 CURRENT, 12 30, 13 60, 14 90 and YTD surcharge attr 21 (cents) | L90-95 | KEEP |
| NEWAR5.08 | Optional two-line operator message (max 55 chars each) printed on all statements | L30-38 | SIMPLIFY |
| NEWAR5.09 | Missing ARINV/ARMST record logged to ERROR file and run aborts with error message at end | L42-43,106 | SIMPLIFY |

**Bugs / oddities:** TDISC includes discounts on future (DUE=0) invoices so NET DUE = DUE - TDISC can understate (L70-71,90); DDATE=SDATE[1,2]+2 can exceed 12 before wrapping (handled by MD>12 check only once). UPD READVU lock held through the whole run.

## PDF.INV.HIST

**Mode:** Outbound-generator · **Lines:** 65 · **Relevance:** PRICING

Reprints historical member invoices from ARHIST to PDF (spooler .CFG/.TXT) for a pre-selected list.

**Files:** reads ARHIST (opened as ARSHIP variable), ARMST, IVMST, IVMST.DISC · writes spool hold files  
**Calls:** EXECUTE SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| PDF.INV.HIST.01 | Same line logic as LJ.INV1.02-04 (description IVMST/IVMST.DISC attr 4; qty 0 skipped; unit = AMOUNT/QTY; cents) | L39-46 | KEEP |
| PDF.INV.HIST.02 | PDF via spooler .CFG/.TXT hold-file pair named by invoice ID[5,6] | L23-33 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** page break handled twice (L48-49: after GOSUB 50 resets L=1, second test harmless); invoice # uses ID[5,6] here vs ID[5,5] in LJ.INV*; header terms/PO positions same as PDF.INV2.

## PDF.INV2

**Mode:** Outbound-generator · **Lines:** 66 · **Relevance:** PRICING

Renders all current ARSHIP member invoices to PDF via spooler hold files with an invoice background bitmap.

**Files:** reads ARSHIP, ARMST, IVMST, IVMST.DISC · writes spool hold files  
**Calls:** EXECUTE SSELECT ARSHIP BY INVNO, SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| PDF.INV2.01 | Same line/total logic as PDF.INV.HIST.01 but source is ARSHIP (unposted current invoices), all records by invoice number | L18,40-47 | KEEP |
| PDF.INV2.02 | PDF via .CFG (with background C:\PDFTEST\INVOICE.BMP) + .TXT hold files | L24-34 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** same as PDF.INV.HIST; credits not labelled (MSG unused).

## PRINT.LABEL

**Mode:** Report/print · **Lines:** 25 · **Relevance:** none

Production version of LBL.TEST: prints one remittance label per selected invoice (ARSHIP, else ARHIST).

**Files:** reads ARSHIP, ARHIST · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRINT.LABEL.01 | Label = PRO invoice # ID[5,5], date attr 1, amount attr 4 (cents, MD2), "invoice due" = TERMS attr 6, account ID[1,4]; ARSHIP first, ARHIST fallback | L13-20 | SIMPLIFY |

**Bugs / oddities:** header says "label for Vendor Invoice" — it is a PRO invoice label.

## PRINT.LABEL.96

**Mode:** Test-variant · **Lines:** 25 · **Relevance:** none

Copy of PRINT.LABEL that falls back to archive file ARHIST.96 instead of ARHIST.

**Files:** reads ARSHIP, ARHIST.96 · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRINT.LABEL.96.01 | Only difference: history fallback file ARHIST.96 (1996 archive) | L9 | OBSOLETE |

## PRO_CREDIT

**Mode:** Outbound-generator · **Lines:** 24 · **Relevance:** none

Exports a member credit spreadsheet (PRO_CREDIT.XLS) to the Windows download directory via WIN.IMPORT.

**Files:** reads CONTROL ('FTP.DIR' attr 2), ARMST · writes PC file <FTP.DIR>\PRO_CREDIT.XLS, saved list PRO_CREDIT  
**Calls:** WIN.IMPORT; EXECUTE SELECT/SSELECT/SAVE-LIST

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRO_CREDIT.01 | Members included: ID < "9990", TP = "1", and BALANCE > 0 or T.ORDERS > 0, sorted by name | L9-10 | QUESTION |
| PRO_CREDIT.02 | Hard-coded member-number cutoff 9990 (accounts 9990+ excluded — presumably internal/house accounts) | L9 | QUESTION |
| PRO_CREDIT.03 | Columns: SNAME, EXC.PCT, EXCESS3, AVAILABLE, ADJ.BAL, BAL, HI.CRED, CY.HI.CRED, LLIMIT, INVESTMENT, PD, T.ORDERS, YTD (credit-exposure calculations live in dictionary I-types, not code) | L17-19 | QUESTION |
| PRO_CREDIT.04 | Delivery via WIN.IMPORT to PC directory (default C:\DOWNLOADS) | L7,15,22 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** TP attr 23 used as a member-type filter (=1) here; meaning unconfirmed.

## REMOVE.FROM.FSINV

**Mode:** Utility/maintenance · **Lines:** 91 · **Relevance:** none

Moves open invoices that were billed under FotoSource consolidated account 7000 back to the real member's ARINV when the invoice exists in ARHIST under that member, then rebuilds aging for both via RESET.ARMST.

**Files:** reads ARMST, ARINV, ARHIST (CONTROL opened unused) · writes ARMST (7000 and member — unchanged copies), ARINV (7000 and member)  
**Calls:** EXECUTE RUN BP RESET.ARMST (with DATA 7000, member, END); INCLUDE ARINV.FIELDS, ARMST.FIELDS; SUMM

| ID | Rule | Source | Tag |
|---|---|---|---|
| REMOVE.FROM.FSINV.01 | Hard-coded FotoSource account 7000 | L26,56,58-59 | QUESTION |
| REMOVE.FROM.FSINV.02 | Comment names members 3522 and 3571 as the 09-24-12 targets (comment-only evidence; member is operator-entered) | L5 | QUESTION |
| REMOVE.FROM.FSINV.03 | An open 7000 invoice belongs to member M if ARHIST record M:invoice exists; all 15 ARINV attrs of that invoice are moved to M's ARINV | L42-51 | QUESTION |
| REMOVE.FROM.FSINV.04 | ARMST aging/balances are recomputed afterwards by RESET.ARMST for 7000 and the member | L59-60 | KEEP |

**Bugs / oddities:** moved-total uses INV (destination) at index I instead of FSINV (L45-47), so the reported total is wrong; header comment says "convert FotoSource member invoices to FotoSource" (reverse of what it does); error text says CONVERT.ARINV (copied); RESET.ARMST reads a select list, not the stacked DATA, so the aging rebuild in .04 likely never runs (see RESET.ARMST).

## RESET.ARMST

**Mode:** Batch · **Lines:** 53 · **Relevance:** none

Recomputes ARMST aging buckets and balance from ARINV open invoices for every account in the active select list, backing up before/after images to ERRFL.

**Files:** reads ARINV, ARMST · writes ARMST attrs 10-15, ERRFL (<acct>I, <acct>M backups)  
**Calls:** none (ARLOG opened; UPD.ARLOG call commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| RESET.ARMST.01 | Open amount per invoice = ARINV AMOUNT (attr 3) - SUM(AMT.PAID attr 7), cents | L33 | KEEP |
| RESET.ARMST.02 | Bucket = ARMST attr (10 + aging attr 5) for aging >= 0, capped at attr 14 (90+); aging <= 0 also accumulated as FTR | L34-39 | QUESTION |
| RESET.ARMST.03 | ARMST attr 10 (NEW.MON) overwritten = FTR - ARMST attr 24 (FUTURE); attr 24 is presumed correct and not recalculated (05-27-05) | L8,41 | QUESTION |
| RESET.ARMST.04 | BALANCE (attr 15) = FUTURE (attr 24) + attrs 10..14 | L42-45 | KEEP |
| RESET.ARMST.05 | Before-image of ARINV and ARMST written to ERRFL keyed acct:'I' / acct:'M' | L28-29 | SIMPLIFY |

**Bugs / oddities:** header says "add input of account" but this version uses READNEXT (names appear swapped with RESET.ARMST.SEL); invoked by REMOVE.FROM.FSINV with DATA 7000/member, which this program never reads, so that caller's reset silently does nothing unless a select list is active; aging-0 amounts land in both FTR and attr 10 before attr 10 is overwritten; ARLOG update claimed in comment (07-23-09) is commented out; "CHAIN 'ABFLT'" typo L13.

## RESET.ARMST.SEL

**Mode:** Interactive · **Lines:** 53 · **Relevance:** none

Same as RESET.ARMST but prompts the operator for each account instead of reading a select list.

**Files:** reads ARINV, ARMST · writes ARMST attrs 10-15, ERRFL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| RESET.ARMST.SEL.01 | Identical calculation to RESET.ARMST.01-05; only input differs (operator-entered account, E ends) | L17-21 | SIMPLIFY |

**Bugs / oddities:** program name ".SEL" suggests select-list driven but it is the interactive one (names swapped with RESET.ARMST).

## RESET.CREDIT.AGING

**Mode:** Utility/maintenance · **Lines:** 37 · **Relevance:** none

One-off fix-up that moves member credits (negative open invoice amounts) out of the 30/60/90 aging buckets back into Current, after backing up the records to ERRFL.

**Files:** reads ARINV, ARMST · writes ERRFL, ARMST, ARINV  
**Calls:** EXECUTE SELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| RESET.CREDIT.AGING.01 | Selects every ARINV record that has any AMOUNT (attr 3, multivalued) less than 0 | L10 | OBSOLETE |
| RESET.CREDIT.AGING.02 | Before changing anything, copies the ARINV record to ERRFL as `<member>I` and the ARMST record as `<member>M` (overwrites any earlier backup with the same key) | L16-17 | OBSOLETE |
| RESET.CREDIT.AGING.03 | For each invoice line with AMOUNT < 0 and AGING (ARINV attr 5) > 1, the credit is removed from ARMST bucket attr (AGING+10), capped at attr 14 (so 2 -> 30-DAYS attr 12, 3 -> 60-DAYS attr 13, 4+ -> 90-DAYS attr 14), added to CURRENT (ARMST attr 11), and the line's AGING is reset to 1. In other words, credits always age as Current. Money units are not stated (no conversion in this program). | L19-30 | QUESTION |

**Bugs / oddities:** One-off fix-up script (1999). MATREADU has THEN and no ELSE, so a missing ARMST record is skipped silently and the ARINV lock is held until RELEASE. ERRFL backups are overwritten on every run. The policy "credits always sit in Current" should be confirmed for PIV2 aging.

## RESET.ERRFL

**Mode:** Utility/maintenance · **Lines:** 24 · **Relevance:** none

Undo for RESET.CREDIT.AGING. It writes every ERRFL backup record back over ARINV (keys containing 'I') or ARMST (other keys).

**Files:** reads ERRFL · writes ARINV, ARMST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| RESET.ERRFL.01 | Each ERRFL key containing 'I' is restored to ARINV under FIELD(ID,'I',1). Every other key is restored to ARMST under FIELD(ID,'M',1). The restore is unconditional overwrite. | L10-21 | OBSOLETE |

**Bugs / oddities:** It restores everything in ERRFL. Records that other programs wrote to ERRFL would also be pushed into ARMST. READU locks are never released explicitly. ERRFL is not cleared afterwards.

## RESET.RBT.CHKS

**Mode:** Utility/maintenance · **Lines:** 27 · **Relevance:** none

Clears the PRINTED flag on a range of customer rebate checks so they can be reprinted.

**Files:** reads RBTDATA · writes RBTDATA  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| RESET.RBT.CHKS.01 | Operator enters a starting and ending check number. RBTDATA records with CHK.NO (key) in that range get PRINTED (attr 7) set to empty, which makes them eligible for reprint. There is no check of who runs it, no audit and no check that a check was actually voided. | L15-22 | SIMPLIFY |

**Bugs / oddities:** `GOTO10` on L21 has no space (it depends on the compiler accepting it). The range select compares check numbers as strings/numbers through a query and is not validated. The "E" exit only tests the first character.

## RESTORE

**Mode:** Utility/maintenance · **Lines:** 31 · **Relevance:** VENDOR

Recovery tool for manually re-keying lost ARHIST (member billing of vendor invoices) records, pulling the amount from APHIST.

**Files:** reads APHIST · writes ARHIST (ARHIST, ARSHIP are opened; ARSHIP is unused)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| RESTORE.01 | Hard-coded date: every record written gets ARHIST attr 1 = 10464 (internal date 1996-08-24) | L8 | QUESTION |
| RESTORE.02 | ARHIST key = member account : invoice number. If the operator leaves the invoice number blank, the previous number + 1 is used. | L12-16 | OBSOLETE |
| RESTORE.03 | The amount (attr 4) comes from APHIST record `<vendor>*<vendor invoice>` attr 2 (GROSS). If that record is missing, the vendor/invoice is rejected and re-entry starts over. Amount entry by hand is commented out. | L17, L24-28 | OBSOLETE |
| RESTORE.04 | Other fields are entered by hand: attr 2 vendor, attr 5 PO, attr 6 terms (blank terms keeps the prior record's terms), attr 7 vendor invoice, attr 8 surcharge (no dictionary for ARHIST, so units are unknown) | L9, L18-23 | OBSOLETE |

**Bugs / oddities:** One-off 1996/1999 recovery script. INVOICE is uninitialised on the first blank entry (it becomes 1). Blank TERMS carries the previous value forward. ARSHIP is opened and never used.

## REV.MEMEZPAY

**Mode:** Batch · **Lines:** 191 · **Relevance:** none

Reverses a posted EZPAY run (member automatic payment). Each EZPAY gross amount goes back into the member's balance and aging bucket, the paid dates are reset, the cash control total is backed out, and WEBSTMT is rebuilt.

**Files:** reads EZPAY, CONTROL ('UPD','MS'), ARMST, ARINV · writes ARMST, ARINV, ARHIST (attr 16), CONTROL 'MS' (ARLOG, ZIPREF, WEBERRORS are opened but unused)  
**Calls:** EXECUTE SSELECT, RUN WEBSTMT (UPD.ARLOG call commented out)

| ID | Rule | Source | Tag |
|---|---|---|---|
| REV.MEMEZPAY.01 | Posting is blocked when CONTROL 'UPD' attr 1 > 1 (AR update in progress) | L27-31 | KEEP |
| REV.MEMEZPAY.02 | Month-end cutoff: if the entered date's day is > 25 and its month equals CONTROL 'UPD' attr 2 (the open month), the posting is refused until the previous month is closed. December (attr 2 = 12) is exempt. | L46-52 | QUESTION |
| REV.MEMEZPAY.03 | The operator enters the "prior payment" date (MM.DD.YY), or Y/blank for today. That date becomes the reversal's DT.PAID and LAST.PAID. | L39-53 | QUESTION |
| REV.MEMEZPAY.04 | Money units: EZPAY amounts (attr 3 gross, 4 disc, 6 EZ-disc, 7 EZ-net) are stored in dollars and multiplied by 100 to cents before they are posted to ARMST/ARINV | L75-76 | SIMPLIFY |
| REV.MEMEZPAY.05 | All EZPAY records are processed, grouped by member and invoice. Each invoice must exist on the member's ARINV and must already have AMTPAID set, or the whole run aborts mid-stream with no rollback. | L55-83, L133-160 | QUESTION |
| REV.MEMEZPAY.06 | Gross is added back to ARMST BALANCE and to the aging bucket chosen by ARINV AGING (attr 5): >4 = 90-day, 3 = 60, 2 = 30, 1 = Current, 0 = New-month, <0 = Future | L142-151 | QUESTION |
| REV.MEMEZPAY.07 | ARINV DT.PAID (attr 6) for the invoice is set to the entered date. AMTPAID is NOT cleared (the line is commented out). | L152 | QUESTION |
| REV.MEMEZPAY.08 | If the invoice line is flagged vendor-credit (ARINV attr 8 = 1), gross is subtracted from the vendor-credit total | L153 | QUESTION |
| REV.MEMEZPAY.09 | ARMST LAST.PAID = the entered date. ARMST EZPAY.DISC (attr 41) is reduced by the member's EZ-discount total. | L162 | KEEP |
| REV.MEMEZPAY.10 | ARHIST `<member><invoice>` attr 16 (named DT.PAID in the ARSHIP dict; ARHIST has no dict) is set to the entered date | L180-189 | QUESTION |
| REV.MEMEZPAY.11 | CONTROL 'MS' attr 4 (purpose unclear, apparently a running cash/EZPAY total) is reduced by the grand total gross | L88-97 | QUESTION |
| REV.MEMEZPAY.12 | EZPAY records are not deleted after reversal (the DELETE is commented out), so a re-run would double-reverse | L155 | QUESTION |
| REV.MEMEZPAY.13 | Prints the reversal report (gross, discount, EZ-disc, net per member, plus a grand total), then runs WEBSTMT to rebuild web statements | L98-107 | KEEP |

**Bugs / oddities:** AGING = 4 is not covered in the CASE, so ATTR keeps the previous invoice's bucket (RESET.CREDIT.AGING maps 4+ to 90). L153 subscripts ARI with the ARMST.VNCRED equate (wrong array and attr). The header comment ("Update Member Orders via EDI") is copy-pasted. The error message says UPD.MEMEZPAY. The L184 READU sets NOT.LOCKED = 1 in its LOCKED clause, so a locked record never waits. An abort part-way leaves some members reversed and others not.

## RPDF.EDI.INV

**Mode:** Report/print · **Lines:** 74 · **Relevance:** VENDOR

Reprints member billing invoices for vendor (EDI) invoices from ARHIST, as print-to-PDF hold entries with a companion .CFG file.

**Files:** reads ARHIST (as ARSHIP), ARMST, APMST · writes printer hold entries (IVMST, CONTROL opened but unused)  
**Calls:** EXECUTE SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| RPDF.EDI.INV.01 | ARHIST key = 4-character member number + invoice number. The member is ID[1,4] and the invoice is ID[5,6]. This assumes 4-digit member numbers. | L33-36, L65, L70 | QUESTION |
| RPDF.EDI.INV.02 | Invoice lines come from ARHIST attr 10 vendor product, 11 vendor description (first 43 chars), 12 vendor qty, 13 vendor cost (cents). Line amount = cost x qty. Printing stops at the first blank product. | L26, L46-57 | KEEP |
| RPDF.EDI.INV.03 | Invoice total = sum of line amounts only. The surcharge (attr 8) is neither printed nor added. | L55-58 | QUESTION |
| RPDF.EDI.INV.04 | Header: billing vendor name from APMST attr 1 for vendor ARHIST attr 9 ("VENDOR UNKNOWN" if missing). Also prints date attr 1, terms attr 6, PO attr 5, vendor invoice attr 7, and member name/address from ARMST attrs 1,3,4,5,6. | L64-70 | KEEP |
| RPDF.EDI.INV.05 | Each invoice is spooled as a hold file `<invoice>.CFG` (lines '66','97','CM,0,.1,0,.1' for the PDF converter) plus `<invoice>.TXT` | L34-44 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** It does no SELECT (commented out) and relies on an active select list. MSG ("THIS IS A CREDIT") is never used. Header mentions comments about terms that do not exist. 39-line paging.

## RPRT.EDI.INV

**Mode:** Report/print · **Lines:** 60 · **Relevance:** VENDOR

Older printed (HP PCL) version of RPDF.EDI.INV that prints member billing invoices for vendor invoices from ARHIST, falling back to ARHIST.00.

**Files:** reads ARHIST, ARHIST.00, ARMST, APMST · writes printer  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| RPRT.EDI.INV.01 | Same line/total logic as RPDF.EDI.INV.02-.04 (attrs 10-13, cost in cents, cost x qty, vendor name from APMST attr 1) | L33-56 | KEEP |
| RPRT.EDI.INV.02 | Falls back to the archive file ARHIST.00 when the invoice is not in ARHIST | L28-30 | OBSOLETE |
| RPRT.EDI.INV.03 | Prints the surcharge (ARHIST attr 8 / 100, so cents) in the header but does NOT include it in the invoice total | L56, L45 | QUESTION |
| RPRT.EDI.INV.04 | Invoice number printed as ID[5,5] (5 chars) versus ID[5,6] in RPDF.EDI.INV, with the member as ID[1,4] | L31, L56 | QUESTION |
| RPRT.EDI.INV.05 | HP PCL escape sequences for fonts and layout | L17-18, L48-49 | OBSOLETE |

**Bugs / oddities:** `GOTO5` typo on L29. No SELECT. An unused MSG constant.

## RPT.INV

**Mode:** Report/print · **Lines:** 70 · **Relevance:** VENDOR, PRODUCT

Reprints member invoices from ARHIST. It handles both warehouse product invoices and "billing for vendor" (drop-ship/vendor-direct) invoices, the latter with a terms-dispute notice.

**Files:** reads ARHIST, ARMST, IVMST, IVMST.DISC, APMST · writes printer (CONTROL opened, unused)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| RPT.INV.01 | ARHIST layout used (no dict; matches ARSHIP dict): attr 1 date, 2 product (multivalued) or vendor, 3 qty, 4 amount (cents), 5 PO, 6 terms, 7 vendor invoice, 8 surcharge (cents). Key = 4-char member + invoice (ID[5,5]). | L21-22, L46-51, L62-66 | KEEP |
| RPT.INV.02 | If qty (attr 3) is empty, the record is a vendor billing. It prints "BILLING FOR <APMST attr 1 name of vendor in attr 2>" with the single amount attr 4, noted as "includes surcharge and shipping if applicable". A negative amount prints "** THIS IS A CREDIT **". | L24-31, L43 | KEEP |
| RPT.INV.03 | Terms-dispute policy on vendor billings: the member must notify PRO of any terms discrepancy by invoice date + 10 days. After that, terms cannot be altered, and invoices not paid on the original terms incur a service charge, "NO EXCEPTIONS" | L25, L33-41 | QUESTION |
| RPT.INV.04 | Product invoice lines: description from IVMST attr 4, else IVMST.DISC attr 4. Unit cost = amount/qty, or amount itself when qty = 0. Total = sum of line amounts (attr 4, cents). Up to 200 lines. | L45-57 | KEEP |
| RPT.INV.05 | Surcharge (attr 8 / 100) is printed in the header and is not added to the product-invoice total | L66, L57 | QUESTION |
| RPT.INV.06 | Prints "REPRINT" on every page | L55, L59 | SIMPLIFY |

**Bugs / oddities:** Relies on an active select list. The member is assumed to be the first 4 chars of the key. Pre-printed form layout with a 24-line page.

## RPT.INV.97

**Mode:** Test-variant · **Lines:** 64 · **Relevance:** VENDOR

Copy of RPT.INV pointed at the 1997 archive file ARHIST.97.

**Files:** reads ARHIST.97, ARMST, IVMST, APMST · writes printer  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| RPT.INV.97.01 | Differs from RPT.INV only in reading ARHIST.97 and having no IVMST.DISC description fallback | L4, L44 | OBSOLETE |

**Bugs / oddities:** Year-specific copy of RPT.INV.

## RPT.LJ.INV

**Mode:** Report/print · **Lines:** 56 · **Relevance:** PRODUCT

LaserJet (PCL) reprint of member product invoices from ARHIST, with a fallback to ARHIST.98.

**Files:** reads ARHIST, ARHIST.98, ARMST, IVMST, IVMST.DISC · writes printer (CONTROL, APMST opened, unused)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| RPT.LJ.INV.01 | Lines are taken until the first blank product (attr 2). Lines with qty = 0 are skipped (not printed or totalled). Unit cost = amount/qty. Total = sum of attr 4 (cents). | L26-40 | KEEP |
| RPT.LJ.INV.02 | Falls back to the archive file ARHIST.98 when the record is not in ARHIST | L21-23 | OBSOLETE |
| RPT.LJ.INV.03 | Unlike RPT.INV, there is no vendor-billing / terms-notice branch and no surcharge printed | L19-54 | QUESTION |
| RPT.LJ.INV.04 | HP PCL page setup codes, 39 lines per page | L44-46, L38 | OBSOLETE |

**Bugs / oddities:** The open-error message for ARHIST.98 says 'ARHIST'. A vendor-billing record (qty blank) would print one line with qty blank, skipped as 0.

## RPT.LJ.INVC

**Mode:** Test-variant · **Lines:** 56 · **Relevance:** PRODUCT

Copy of RPT.LJ.INV.

**Files:** reads ARHIST, ARHIST.00, ARMST, IVMST, IVMST.DISC · writes printer  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| RPT.LJ.INVC.01 | Differs from RPT.LJ.INV only in the fallback archive (ARHIST.00 instead of ARHIST.98), the PCL form code (&f1y vs &f9y) and printing invoice ID[5,6] (6 chars) instead of ID[5,5] | L7, L45, L52 | OBSOLETE |

**Bugs / oddities:** Duplicate of RPT.LJ.INV.

## UPD.ARHIST

**Mode:** Utility/maintenance · **Lines:** 37 · **Relevance:** none

One-off 2009 backfill of ARHIST attr 16 (DT.PAID per the ARSHIP dict, which ARHIST shares per UPD.DICTS) from ARINV paid dates.

**Files:** reads ARHIST, ARINV · writes ARHIST  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.ARHIST.01 | For ARHIST records with blank DT.PAID (attr 16): member = ID[1,4], invoice = ID[5,9]. If the invoice is still on ARINV, DT.PAID = ARINV attr 6 for that invoice (which may be blank). If the invoice or member is not on ARINV (purged = paid), DT.PAID = the invoice date (attr 1). | L18-30 | OBSOLETE |

**Bugs / oddities:** One-off fix-up. Using the invoice date as the paid date for purged invoices is an approximation.

## UPD.ARLOG

**Mode:** Subroutine · **Lines:** 16 · **Relevance:** none

Writes an audit entry to ARLOG whenever a program changes ARMST.

**Files:** writes ARLOG  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.ARLOG.01 | Audit record key = member_date_time (internal date and seconds). Attr 1 = program, attr 2 = @LOGNAME, attr 3 = attribute/value changed. | L6-13 | SIMPLIFY |

**Bugs / oddities:** The key has one-second resolution, so two changes in the same second for the same member overwrite each other (the READU only waits on a lock and does not detect an existing record).

## UPD.CHARGES

**Mode:** Utility/maintenance · **Lines:** 50 · **Relevance:** none

Dev-environment sync that copies open invoices from the production PRO account (PRO.ARINV) into the PRO.DEVLP account's ARINV, rolls them into ARMST balances, and copies CONTROL 'MS'.

**Files:** reads PRO.ARINV, PRO.CONTROL, ARINV, ARMST, CONTROL · writes ARINV, ARMST, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.CHARGES.01 | Invoices on PRO.ARINV that are missing from local ARINV are appended (attrs 1-5: number, date, amount, terms, aging) | L22-30 | OBSOLETE |
| UPD.CHARGES.02 | Aging bucket mapping when adding an invoice: aging < 0 -> FUTURE (ARMST attr 24). Otherwise aging is capped at 4 and goes to ARMST attr 10+aging (0 = NEW.MON, 1 = CURRENT, 2 = 30, 3 = 60, 4 = 90). Amount is also added to BALANCE (attr 15). This is the canonical bucket mapping, consistent with REV.MEMEZPAY except for that program's missing case 4. | L31-36 | KEEP |
| UPD.CHARGES.03 | Local CONTROL 'MS' is replaced by production's 'MS', keeping the local attr 4 | L44-48 | OBSOLETE |

**Bugs / oddities:** MATREADU ... ELSE MAT x = '' conflates "locked" and "not found", which is a silent-fallthrough bug suspect. If CONTROL 'MS' does not exist locally, nothing is written.

## UPD.MEMEZPAY

**Mode:** Batch · **Lines:** 217 · **Relevance:** none

Posts the EZPAY (member automatic payment) batch. Each EZPAY invoice is marked paid on ARINV and its gross is removed from ARMST balance/aging. EZ-discount is accumulated, the cash control total is updated, and WEBSTMT is rebuilt.

**Files:** reads EZPAY, CONTROL ('UPD','MS'), ARMST, ARINV · writes ARMST, ARINV, ARHIST attr 16, CONTROL 'MS' (ARLOG, ZIPREF, WEBERRORS opened, unused)  
**Calls:** EXECUTE SSELECT, RUN WEBSTMT (UPD.ARLOG commented)

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.MEMEZPAY.01 | Blocked when CONTROL 'UPD' attr 1 > 1 (AR update in progress) | L28-32 | KEEP |
| UPD.MEMEZPAY.02 | Month-end cutoff: a payment date after the 25th in the still-open month (CONTROL 'UPD' attr 2) is refused, except in December | L45-51 | QUESTION |
| UPD.MEMEZPAY.03 | EZPAY amounts (gross, disc, EZ-disc, EZ-net) are stored in dollars and converted x100 to cents | L122-123 | SIMPLIFY |
| UPD.MEMEZPAY.04 | Each EZPAY invoice must be on the member's ARINV and not already paid (AMTPAID blank). Already-paid or missing invoices go to an error report and are skipped. | L151-158, L177-180 | KEEP |
| UPD.MEMEZPAY.05 | Payment applies the FULL GROSS: ARMST BALANCE and the aging bucket chosen by ARINV AGING (>4 = 90, 3 = 60, 2 = 30, 1 = Current, 0 = New-month, <0 = Future) are reduced by gross. ARINV DT.PAID = payment date and AMTPAID = gross. So the cash discount and EZ discount are not deducted from what is recorded as paid. | L162-172 | QUESTION |
| UPD.MEMEZPAY.06 | Vendor-credit invoices (ARINV attr 8 = 1) add gross to the vendor-credit total | L173 | QUESTION |
| UPD.MEMEZPAY.07 | ARMST LAST.PAID = payment date. ARMST EZPAY.DISC (attr 41) += member's EZ-discount total. | L183 | KEEP |
| UPD.MEMEZPAY.08 | ARHIST `<member><invoice>` attr 16 (DT.PAID) = payment date | L206-215 | KEEP |
| UPD.MEMEZPAY.09 | CONTROL 'MS' attr 4 += total gross posted (purpose of attr 4 unclear) | L84-93 | QUESTION |
| UPD.MEMEZPAY.10 | EZPAY records are not deleted after posting (commented out). Re-run protection relies on the AMTPAID check. | L175 | QUESTION |
| UPD.MEMEZPAY.11 | Prints the posting and error reports, then runs WEBSTMT | L94-112 | KEEP |

**Bugs / oddities:** SKIP.MEMBER bug: when a member's ARMST/ARINV cannot be read, the flag is set while the NEXT member's first record is being extracted, so that next member's remaining invoices are silently skipped. AGING = 4 is not handled (the previous bucket is reused). L173 uses the ARMST.VNCRED equate on the ARI array. The L210 READU sets NOT.LOCKED = 1 in its LOCKED clause, so it never waits. The header comment ("Update Member Orders via EDI") is copy-pasted.

## UPDATE.ARSHIP

**Mode:** Test-variant · **Lines:** 117 · **Relevance:** VENDOR

Truncated/broken copy of UPD.EDICREDITS (member-billing half only) that was meant to rebuild ARMST/ARINV/ARSHIP from EDI invoice data.

**Files:** (would write) ARMST, ARINV, ARSHIP, CONTROL 'INV','MS'  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPDATE.ARSHIP.01 | Duplicates UPD.EDICREDITS.10, .15, .20-.23, .25 (ARMST/ARINV/ARSHIP posting, member terms, invoice numbering). It has no AP posting, surcharge calculation, due-date bucketing or VENDORD logic. SRCH, FTR, MDUE, APM, SPCDED, VEND and PO are never set. | L47-115 | OBSOLETE |

**Bugs / oddities:** EDIREC is never read, so the loop does nothing. GOSUB 55 targets a label that does not exist (compile or run failure). Non-functional fragment.

## VERIFY.ARMST

**Mode:** Report/print · **Lines:** 60 · **Relevance:** none

Integrity check that recomputes each member's balance and aging buckets from ARINV and reports mismatches against ARMST.

**Files:** reads ARINV, ARMST · writes none (screen)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| VERIFY.ARMST.01 | ARMST BALANCE (attr 15) must equal sum of ARINV AMOUNT (attr 3) - sum of AMTPAID (attr 7) | L14-17 | KEEP |
| VERIFY.ARMST.02 | BALANCE must equal FUTURE (24) + NEW.MON (10) + CURRENT (11) + 30 (12) + 60 (13) + 90 (14) | L18-20 | KEEP |
| VERIFY.ARMST.03 | Expected buckets per open amount (amount - paid): aging >= 4 = 90, 3 = 60, 2 = 30, 1 = Current. Aging 0 dated on/after the 1st of this month = New-month, aging 0 dated earlier = Future, aging < 0 = Future. | L21-55 | QUESTION |

**Bugs / oddities:** Posting programs put all aging-0 amounts in NEW.MON (UPD.CHARGES.02, UPD.EDICREDITS.10), but this check expects old-dated aging-0 amounts in FUTURE, so the rules disagree. SELECT is commented out (needs an active list).

## WEBRBTS

**Mode:** Staging-processor · **Lines:** 36 · **Relevance:** none

Converts online consumer-rebate submissions staged in CONTROL 'RBTDATA' into PENDRBTS (pending rebate checks) records.

**Files:** reads CONTROL 'RBTDATA' · writes PENDRBTS, deletes CONTROL 'RBTDATA'  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| WEBRBTS.01 | Staging: one CONTROL record 'RBTDATA' with rebates delimited by 'ENDOFDATA'. Per rebate: id, code, date + 5 customer-data fields, 2 product fields, then 1 skipped field. | L7-29 | OBSOLETE-INTEGRATION |
| WEBRBTS.02 | PENDRBTS `<id>`: attr 3 CODE, attr 4 CUST (value 1 = internal date, 2-6 = customer data), attr 6 PROD (2 values). DEALER/MEMBER (attr 2) and AMOUNT (attr 5) are NOT set here, so they must be filled later (not in this program). | L19-28, L33-34 | QUESTION |
| WEBRBTS.03 | An existing PENDRBTS id is overwritten with no duplicate check | L34 | QUESTION |

**Bugs / oddities:** The staging record is held in CONTROL rather than a dedicated file. The skipped trailing field's purpose is unknown.

## WEBSTMT

**Mode:** Batch · **Lines:** 65 · **Relevance:** VENDOR

Rebuilds the member web-statement files. It writes one WEBSTMT record per open invoice (with discount, net and due date) and one STMTSUM per member (totals and aging).

**Files:** reads ARINV, ARMST, ARHIST, ARHIST.98 · writes WEBSTMT, STMTSUM (both cleared first)  
**Calls:** EXECUTE CLEAR-FILE, SSELECT

| ID | Rule | Source | Tag |
|---|---|---|---|
| WEBSTMT.01 | Open amount per invoice = ARINV AMOUNT (attr 3) - AMTPAID (attr 7), in cents | L36 | KEEP |
| WEBSTMT.02 | Due month = (last statement month entered + 2) - aging, wrapped to 1-12. The due date is shown as "<month>/10" (always the 10th). | L15-20, L37-40, L49 | QUESTION |
| WEBSTMT.03 | Discount available only when aging < 2 (not yet past due): disc = round(open x terms % (ARINV attr 4) / 100). Otherwise disc = 0 and the due date shows "PAST-DUE". Net = open - disc. | L41-45, L51-52 | KEEP |
| WEBSTMT.04 | Amount due now = open amount when aging > 0, otherwise 0 (future/new-month). The statement discount total counts only due-now invoices. | L44-45 | QUESTION |
| WEBSTMT.05 | Hard-coded vendor 1322 is shown as the vendor for warehouse (PRO stock) invoices. For vendor-billing invoices (ARHIST qty blank), the vendor (ARHIST attr 2) and vendor invoice (attr 7) are shown instead. This implies 1322 is PRO's own warehouse vendor number (compare UPD.EDICREDITS.18). | L46-50 | QUESTION |
| WEBSTMT.06 | STMTSUM per member: gross, due, discount, net (due - disc), ARMST Current/30/60/90 (attrs 11-14), future = gross - due | L58-61 | KEEP |
| WEBSTMT.07 | Falls back to the 1998 archive ARHIST.98 when the invoice is not in ARHIST | L46-48 | OBSOLETE |

**Bugs / oddities:** It is interactive (prompts for month), yet UPD.MEMEZPAY/REV.MEMEZPAY run it unattended. When ARHIST is not found, AR keeps the previous invoice's values, so a stale vendor/vendor invoice is shown (W(8) "not on file" is also overwritten). Statement month is not validated against the open month. WEBSTMT keys are a sequential counter from 1001.
