# EDI — Computyme programs and rules

9 programs, 109 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## EDI.CREDIT

**Mode:** Staging-processor · **Lines:** 194 · **Relevance:** VENDOR, PRICING

Parses vendor credit memos from staging record EDI 'CREDITS' (for non-PRO "MDS" billing) and writes one EDICREDITS record per credit with computed terms and surcharge.

**Files:** reads EDI ('CREDITS','ERROR'), CONTROL ('UPD','DAYS','EDIC'), APMST, VNIDX, VNMST, ARMST, VENDORD · writes EDICREDITS, EDI ('ERROR', 'CREDITS' rewritten then deleted), CONTROL ('EDIC')  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| EDI.CREDIT.01 | Staging: all credits arrive in one record EDI 'CREDITS'; invoices separated by 'ENDOFINVOICE' line; header fields 1=vendor(APMST id), 2=member, 3=invoice date, 4=invoice #, 5=PO, 6=terms %, 7=due date, 8=amount, 9=shipping; then 4-line detail groups (qty, cost, vendor prod, desc) | L51-74,L82-174 | OBSOLETE-INTEGRATION |
| EDI.CREDIT.02 | Abort if CONTROL 'UPD' attr 1 > 2 (control/run state; purpose unclear) | L31-32 | QUESTION |
| EDI.CREDIT.03 | Vendor must exist in APMST and member in ARMST; otherwise the invoice is appended to EDI 'ERROR' and skipped | L83-105 | KEEP |
| EDI.CREDIT.04 | APMST vendor mapped to VNMST via VNIDX attr 1; VNMST attr 15 ADMDAYS and attr 14 SPCDED used in terms | L91-95 | KEEP |
| EDI.CREDIT.05 | Billing cutoff: if today is after the 22nd, the billing month start (DAY.ONE) is moved forward by CONTROL 'DAYS' days for the month | L37-46 | QUESTION |
| EDI.CREDIT.06 | Member due date: day = APMST attr 10 DUE.DAYS; month = invoice month+1 if invoice day < 26 and invoice date >= billing month start, else +2 | L111-120 | QUESTION |
| EDI.CREDIT.07 | Future-terms count FTR by days between vendor due date and today less ADMDAYS: <=45 ->0, 46-76 ->1, 77-107 ->2, 108-137 ->3, else 4; due month pushed forward FTR months; +1 if early-month invoice before billing month start (only in first two bands) | L123-145 | QUESTION |
| EDI.CREDIT.08 | Vendor discount APMST attr 9 PCT: if > 20 it is treated as a flat whole-dollar amount (x100 cents) else a percent rounded; result NET is computed but never stored | L148-153 | QUESTION |
| EDI.CREDIT.09 | Surcharge SRCH = round(AMT * APMST attr 30 SRCH / 1000) (attr 30 in tenths of a percent, AMT in cents); added into amount only when APMST attr 29 CODE = 2 | L155-157 | KEEP |
| EDI.CREDIT.10 | Member terms text = (EDI terms % - APMST attr 30/10 - VNMST SPCDED) as "N% " else "NET ", followed by computed due date | L159-161 | QUESTION |
| EDI.CREDIT.11 | Credit sequence number from CONTROL 'EDIC' attr 1, +1, wraps to 1 at 99999; EDICREDITS key = member:seq | L163-165,L180 | SIMPLIFY |
| EDI.CREDIT.12 | EDICREDITS layout: 1=inv date, 2=vendor, 4=amount, 5=PO, 6=terms text, 7=vendor invoice #, 8=surcharge, 9=vendor, 10-13 detail vendor prod/desc/qty/cost(cents) | L166-174 | KEEP |
| EDI.CREDIT.13 | Shipping amount added as a detail line with hard-coded product code 9999 "Shipping Charges" qty 1 | L175-179 | QUESTION |
| EDI.CREDIT.14 | Grand total of credits displayed; staging record deleted at end | L184-185 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** AGING (L162), NET, APAMT computed but unused; empty IF at L40-41; AMT taken from <8> as-is with ICONV MD2 (input dollars, stored cents); ERRS/GCTOT not initialized; RELEASE of ARMST/VENDORD never locked; on APMST error EDI 'CREDITS' rewritten with the remaining (not current) data.

## EDI.CREDITS

**Mode:** Test-variant · **Lines:** 343 · **Relevance:** VENDOR, PO, PRICING

Older (11/2001) copy of EDI.UPDATE, the EDI drop-ship ("non-PRO MDS") billing run; rules listed in full because it was read before EDI.UPDATE, see EDI.UPDATE for the current logic: parses vendor invoices from staging record EDI 'DATA', bills members in AR (ARINV/ARSHIP/ARMST), books AP (APDIST/APHIST/APMST), updates vendor and PO-tracking totals; negative invoices are parked in EDICREDITS.

**Files:** reads EDI ('DATA','ERROR'), CONTROL ('UPD','APBAT','APPER','DAYS','NEXT.EDICR','INV','MS'), APMST, VNIDX, VNMST, ARMST, VENDORD, APHIST, ARINV, IVEND · writes EDI ('DATA','ERROR', delete 'DATA'), EDICREDITS, CONTROL ('APBAT','NEXT.EDICR','INV','MS'), APMST, VNMST, VENDORD, IVEND, ARMST, APDIST, APHIST, ARINV, ARSHIP  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| EDI.CREDITS.01 | Staging: single record EDI 'DATA' holds all invoices separated by 'ENDOFINVOICE'; header 1=APMST vendor, 2=member, 3=inv date, 4=vendor inv #, 5=PO, 6=terms %, 7=vendor due date, 8=amount (dollars, ICONV MD2 to cents), 9=shipping; 4-line detail groups qty/cost/vendor prod/desc | L66-102,L132,L168,L303-309 | OBSOLETE-INTEGRATION |
| EDI.CREDITS.02 | Abort if CONTROL 'UPD' attr 1 > 2 (control state; purpose unclear) | L39-40 | QUESTION |
| EDI.CREDITS.03 | AP batch number from CONTROL 'APBAT' attr 1 (incremented each run, zero-padded to 3 digits) and period from 'APPER'; APDIST id piece = PERIOD:BATCH:counter | L42-47,L273 | SIMPLIFY |
| EDI.CREDITS.04 | After the 22nd of the month in the billing month (CONTROL 'UPD' attr 2), operator must type OK to continue; billing-month start DAY.ONE then moved forward by CONTROL 'DAYS'<month> days | L52-61 | QUESTION |
| EDI.CREDITS.05 | Negative-amount invoices (credits) are not billed: whole raw invoice written to EDICREDITS under next free number from CONTROL 'NEXT.EDICR', and reported as an error line for manual handling | L86-98 | QUESTION |
| EDI.CREDITS.06 | Vendor must exist in APMST and member in ARMST, else invoice appended to EDI 'ERROR' and skipped | L133-157 | KEEP |
| EDI.CREDITS.07 | Duplicate check: if APHIST already has key vendor*invoice#, invoice rejected to EDI 'ERROR' | L170-186 | KEEP |
| EDI.CREDITS.08 | Member due date: day = APMST attr 10 DUE.DAYS; month = invoice month+1 if invoice day < 26 and invoice date >= billing month start, else +2 | L187-197 | QUESTION |
| EDI.CREDITS.09 | Future-terms months FTR from (vendor due date - today - VNMST attr 15 ADMDAYS): <=45 ->0, 46-76 ->1, 77-107 ->2, 108-137 ->3, else 4; member due month pushed FTR months; FTR+1 when invoice day < 26 and before billing month start (bands 0-1 only) | L198-222,L7 | QUESTION |
| EDI.CREDITS.10 | Vendor AP discount from APMST attr 9 PCT: > 20 treated as flat dollar amount x100, else percent rounded; gives AP NET | L225-230 | QUESTION |
| EDI.CREDITS.11 | PO tracking: if invoice PO is in member's VENDORD for that vendor, add amount to VENDORD attr 5 BILLED; when BILLED > 90% of attr 4 AMOUNT the PO line is removed (considered fully billed) | L231-247 | QUESTION |
| EDI.CREDITS.12 | Member surcharge SRCH = round(AMT x APMST attr 30 SRCH / 1000) (tenths of a percent, cents), added to the billed amount only when APMST attr 29 CODE = 2 | L250-252 | KEEP |
| EDI.CREDITS.13 | Hard-coded vendors 497, 569 (comment: charge back) and 1322 skip the IVEND member-by-vendor purchase accumulation | L253-254 | QUESTION |
| EDI.CREDITS.14 | IVEND per member: vendor list kept sorted; attr 2 += amount, attr 3 += surcharge; vendor entry removed when amount nets to 0 | L255-264 | KEEP |
| EDI.CREDITS.15 | ARMST updates: attr 9 YTD.SALES += amt, 15 BALANCE += amt, 21 SURCHG += srch, 18 LAST.SALE = invoice date; attr 22 VN.CRED += amt if VNMST attr 13 (purpose unclear) set; amt to attr 10 NEW.MON if FTR=0 else attr 24 FUTURE | L266-268 | KEEP |
| EDI.CREDITS.16 | High credit: if BALANCE/100 > ARMST attr 16 HI.CRED then HI.CRED = INT(BALANCE/100) — HI.CRED stored in whole dollars while BALANCE is cents | L269 | QUESTION |
| EDI.CREDITS.17 | AP distribution APDIST (key vendor*invoice): 1='100' (purpose unclear), 2=period+batch+counter, 3=gross, 4=discount = gross x EDI terms % (not APMST PCT), 5=inv date, 6=member due date, 7/9=APMST attr 12 LEDGER and amount when ledger set; APHIST 1 date, 2 gross, 3 net, 6 due | L271-282 | QUESTION |
| EDI.CREDITS.18 | Member terms = EDI terms % - APMST attr 30/10 - VNMST attr 14 SPCDED; shown "N% " or "NET " plus due date | L283-285 | QUESTION |
| EDI.CREDITS.19 | AR invoice number from CONTROL 'INV' attr 1, +1, wraps to 1 at 99999; appended to ARINV attrs 1-5 (inv, date, amount incl. surcharge, MTERMS, AGING = -FTR); ARINV attr 8 VN.CRED = 1 when VNMST attr 13 = 1 | L286-300 | SIMPLIFY |
| EDI.CREDITS.20 | ARSHIP (key member:inv) holds invoice header and line detail; shipping added as line with hard-coded product 9999 "Shipping Charges" | L301-316 | QUESTION |
| EDI.CREDITS.21 | Vendor totals flushed per vendor: APMST attr 15 YTD.GROSS and 16 OPEN.GROSS += gross, attr 31 += surcharge (dict names attr 31 R.CSZ — purpose unclear); VNMST attr 7 YTD.SALES += billed, attr 9 SURCHARGES += surcharge | L106-127 | KEEP |
| EDI.CREDITS.22 | Monthly sales totals CONTROL 'MS' attrs 1-6 accumulated (1 = surcharge, 3 = billed amount; others purpose unclear) | L265,L318-323 | QUESTION |
| EDI.CREDITS.23 | Run totals displayed (billings, credits, shipping, AP gross/disc/net); staging record deleted | L327-334 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** VDISC reused as both vendor discount rate (L225) and discount accumulator (L279), so A/P DISC total is wrong; first GOSUB 55 uses unassigned VEND; ARINV MATREADU (L287) has no LOCKED clause (silent fallthrough); shipping is not added to AMT (L224 commented) but is listed on ARSHIP; on vendor/member error the remaining queue (not the bad invoice) is rewritten to EDI 'DATA'; EDICREDITS gets raw EDI text here but a structured record from EDI.CREDIT (two layouts in one file).

## EDI.UPDATE

**Mode:** Staging-processor · **Lines:** 413 · **Relevance:** VENDOR, PO, PRICING

Current EDI drop-ship ("non-PRO MDS") billing run: validates and posts vendor invoices from staging record EDI 'DATA' to member AR (ARINV/ARSHIP/ARMST) and vendor AP (APDIST/APHIST/APMST), tracks PO billing, then chains EDI.CREDIT for credit invoices.

**Files:** reads EDI ('DATA'), CONTROL ('UPD','APBAT','APPER','INV','MS'), APMST, VNIDX, VNMST, ARMST, VENDORD, APHIST, ARINV, IVEND · writes EDI ('DATA','ERROR','EDIAMTS','CREDITS','EDIVEND','EDITERMS','EDIDUPS'), CONTROL, APMST, VNMST, VENDORD, IVEND, ARMST, APDIST, APHIST, ARINV, ARSHIP, EDILOG  
**Calls:** EXECUTE RUN BP EDI.CREDIT (when credits found)

| ID | Rule | Source | Tag |
|---|---|---|---|
| EDI.UPDATE.01 | Staging: one record EDI 'DATA' with invoices separated by 'ENDOFINVOICE'; header 1=APMST vendor, 2=member, 3=inv date, 4=vendor inv #, 5=PO, 6=terms %, 7=vendor due date, 8=total (dollars), 9=misc/shipping; detail in 4-line groups qty / unit cost (dollars, up to 3 decimals) / vendor product / description | L91-114,L117-121,L365-372 | OBSOLETE-INTEGRATION |
| EDI.UPDATE.02 | Abort if CONTROL 'UPD' attr 1 > 2 (run state; purpose unclear) | L59-60 | QUESTION |
| EDI.UPDATE.03 | AP batch from CONTROL 'APBAT' (incremented per run, 3-digit) and period 'APPER' form APDIST ref PERIOD:BATCH:counter | L62-67,L335 | SIMPLIFY |
| EDI.UPDATE.04 | Standard member due date STDDUE = 10th of next month; if run after the 22nd and month is closed (current month <> CONTROL 'UPD' attr 2) CLOSED.MN=1 and STDDUE moves to 10th of the month after; if after the 22nd and month not closed operator must type OK | L72-87 | QUESTION |
| EDI.UPDATE.05 | Operator can type DEBUG at the OK prompt to enter the debugger | L78 | OBSOLETE |
| EDI.UPDATE.06 | Total check: sum(qty x unit x 100) rounded + shipping must equal invoice total (cents) exactly, else invoice moved to EDI 'EDIAMTS' | L117-131 | KEEP |
| EDI.UPDATE.07 | Negative-total invoices are appended to EDI 'CREDITS' and processed afterwards by EDI.CREDIT | L132-137,L407-409 | KEEP |
| EDI.UPDATE.08 | Vendor must be non-blank and in APMST, else invoice to EDI 'EDIVEND' | L172-183 | KEEP |
| EDI.UPDATE.09 | APMST vendor mapped to VNMST via VNIDX attr 1; VNMST attr 15 value 1 = admin days, value 2 = PRO terms adjustment; attr 14 SPCDED special deduction; attr 18 VND.TERMS | L184-189,L21 | KEEP |
| EDI.UPDATE.10 | EDI terms % must equal VNMST attr 18 VND.TERMS, else invoice to EDI 'EDITERMS'; then terms += PRO terms adj (VNMST 15.2) | L190-198 | KEEP |
| EDI.UPDATE.11 | Member must exist in ARMST (waits on lock), else to EDI 'ERROR' | L199-212 | KEEP |
| EDI.UPDATE.12 | Reject invoice dated more than 7 days after today to EDI 'ERROR' | L222-231 | KEEP |
| EDI.UPDATE.13 | Duplicate if APHIST key vendor*invoice# exists; to EDI 'EDIDUPS' | L232-248 | KEEP |
| EDI.UPDATE.14 | Base due month: invoice day < 26 → invoice month +1 (or +2 if CLOSED.MN); invoice day >= 26 → +2; due day = first 2 chars of APMST attr 10 DUE.DAYS | L249-259 | QUESTION |
| EDI.UPDATE.15 | Dating: DUEDAYS = vendor due date - today - admin days; <=45 base month, 46-76 +1 month, 77-107 +2, 108-137 +3, >137 +4 | L260-282 | QUESTION |
| EDI.UPDATE.16 | Member due date never earlier than STDDUE; FTR (future months) = due month - STDDUE month (mod 12); AGING = -FTR | L283-284,L348 | KEEP |
| EDI.UPDATE.17 | Vendor AP discount APMST attr 9 PCT: > 20 = flat dollar amount (x100 cents) else percent rounded → AP NET | L287-292 | QUESTION |
| EDI.UPDATE.18 | PO tracking in VENDORD: matching vendor+PO line gets attr 5 BILLED += amount; line removed when BILLED > 90% of attr 4 AMOUNT | L293-309 | QUESTION |
| EDI.UPDATE.19 | Member surcharge = round(amount x APMST attr 30 SRCH / 1000) (attr 30 in tenths of %); added to billed amount only if APMST attr 29 CODE = 2 | L312-314 | KEEP |
| EDI.UPDATE.20 | Hard-coded vendors 497, 569 (comment "Charge Back") and 1322 excluded from IVEND member purchase totals | L315-316 | QUESTION |
| EDI.UPDATE.21 | IVEND per member, sorted vendor list: attr 2 += amount, attr 3 += surcharge, entry dropped when amount nets to zero | L317-326 | KEEP |
| EDI.UPDATE.22 | ARMST: 9 YTD.SALES, 15 BALANCE += amount; 21 SURCHG += surcharge; 18 LAST.SALE = invoice date; 22 VN.CRED += amount if VNMST attr 13 (purpose unclear) set; amount to 10 NEW.MON when FTR=0 else 24 FUTURE | L328-330 | KEEP |
| EDI.UPDATE.23 | ARMST attr 16 HI.CRED kept in whole dollars: set to INT(BALANCE/100) when exceeded (BALANCE in cents) | L331 | QUESTION |
| EDI.UPDATE.24 | APDIST/APHIST keyed vendor*invoice: gross = invoice amount before surcharge; discount = gross x EDI terms % (after PRO adj, not APMST PCT); 1='100' (purpose unclear); ledger APMST attr 12 copied to attr 7 with amount attr 9 | L333-344 | QUESTION |
| EDI.UPDATE.25 | Member terms % = terms - APMST attr 30/10 - SPCDED; text "N% <due>" or "NET <due>" | L345-347 | QUESTION |
| EDI.UPDATE.26 | AR invoice # from CONTROL 'INV' attr 1, +1, wraps to 1 above 999999; ARINV attrs 1-5 appended (inv, date, amount incl surcharge, member terms %, aging); attr 8 VN.CRED flag = 1 when VNMST attr 13 = 1 | L349-362,L378 | SIMPLIFY |
| EDI.UPDATE.27 | ARSHIP member:inv: 1 date, 2/9 vendor, 4 amount, 5 PO, 6 terms text, 7 vendor inv, 8 surcharge, 10-13 line vendor prod/desc/qty/unit cents, 14 DT.POSTED = today; misc/shipping line uses hard-coded product 9999 | L363-377 | QUESTION |
| EDI.UPDATE.28 | EDILOG member:inv records due-date derivation (DUEDAYS, months, FTR, admin days, closed flag, vendor, run date) for audit | L285,L380-381 | SIMPLIFY |
| EDI.UPDATE.29 | Per-vendor flush: APMST 15 YTD.GROSS and 16 OPEN.GROSS += gross, attr 31 += surcharge (dict calls 31 R.CSZ; purpose unclear); VNMST 7 YTD.SALES += billed, 9 SURCHARGES += surcharge | L146-170 | KEEP |
| EDI.UPDATE.30 | CONTROL 'MS' monthly totals attrs 1-6 accumulated (1 surcharge, 3 billed; others purpose unclear) | L327,L383-388 | QUESTION |

**Bugs / oddities:** L129 increments ERR not ERRS so amount-mismatch errors are not counted/listed; VDISC reused as rate and accumulator so A/P DISC total wrong; ARINV MATREADU (L349) no LOCKED clause; CLOSED.MN uninitialized; first GOSUB 55 with unassigned VEND; operator-contact comment with phone number at L80; IVEND READU has no lock handling.

## IPBILL

**Mode:** Outbound-generator · **Lines:** 58 · **Relevance:** VENDOR

Builds an EDI-format billing batch (IPBILL 'DATA', same ENDOFINVOICE layout consumed by EDI.UPDATE) for imaging-service charges in a date range, one invoice per member per vendor.

**Files:** reads IPBILL, VENDXREF · writes IPBILL ('TEMPREC','DATA')  
**Calls:** EXECUTE DELETE IPBILL TEMPREC, SSELECT IPBILL BY ACCOUNT BY VENDOR

| ID | Rule | Source | Tag |
|---|---|---|---|
| IPBILL.01 | Include IPBILL records with CDATE in entered range; vendor = VENDXREF attr 1 for IPBILL attr 1; member = first 4 chars of attr 2 | L19-26 | QUESTION |
| IPBILL.02 | New invoice whenever member or vendor changes; invoice # = IPBILL id of first record | L27-29,L36-44 | KEEP |
| IPBILL.03 | Header: invoice date today, hard-coded terms 7 (%), due date today+30, total = sum of attr 6 amounts (dollars, 2 dp) | L9,L32,L37-42 | QUESTION |
| IPBILL.04 | Detail per record: qty 1, unit = attr 6, product/code = attr 3, description "DATE: attr4 SHIPPED: attr5" | L31-34 | KEEP |
| IPBILL.05 | Output written field-by-field into IPBILL 'DATA' with ENDOFINVOICE separators (staging for EDI.UPDATE) | L45-57 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** IPBILL 'DATA' not cleared first (stale tail lines possible); date prompt says MM.DD.YY but pattern requires '/'; vendor-not-on-file aborts the whole run; DIM DATA(999) limit; OPEN failures ignored.

## PDF.EDI.INV

**Mode:** Outbound-generator · **Lines:** 74 · **Relevance:** VENDOR, PRICING

Renders vendor (EDI / direct-ship) billing invoices in ARSHIP to PDF via spooler hold files (.CFG + .TXT per invoice), using vendor-supplied product, description, qty and cost.

**Files:** reads ARSHIP, ARMST, APMST (IVMST, CONTROL opened unused) · writes spool hold files <INV>.CFG / <INV>.TXT  
**Calls:** EXECUTE SSELECT ARSHIP BY INVNO, SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| PDF.EDI.INV.01 | Line data comes from vendor fields ARSHIP attr 10 VPROD, 11 VDESC, 12 VQTY, 13 VCOST (cents); line amount = VCOST * VQTY; description truncated to 43 chars | L26,46-54 | KEEP |
| PDF.EDI.INV.02 | Invoice total = sum of vendor line amounts (does not use ARSHIP attr 4 AMOUNT or attr 8 surcharge) | L55,58 | QUESTION |
| PDF.EDI.INV.03 | "Billing for" vendor name = APMST attr 1 keyed by ARSHIP attr 9 VEND; else "VENDOR UNKNOWN" (ARSHIP VEND is an APMST key) | L64-66 | KEEP |
| PDF.EDI.INV.04 | Header: member ARMST address, invoice date attr 1, invoice # ID[5,6], terms attr 6, PO attr 5, vendor invoice # attr 7 | L65-70 | KEEP |
| PDF.EDI.INV.05 | PDF generation by writing a .CFG control file (invoice id, 66, 97, CM margins) and .TXT body to spooler HOLD for an external PDF converter | L34-43 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** comment L4 mentions "comments regarding terms on vendor invoices" but none are in code; selects all of ARSHIP, not only EDI invoices (no filter on attr 10 populated) — invoices without VPROD produce empty bodies.

## PRT.EDI.CREDIT

**Mode:** Report/print · **Lines:** 58 · **Relevance:** VENDOR, PRICING

Prints vendor (EDI) credit memos from EDICREDITS on the laser printer, using vendor-supplied line data, with "Billing for <vendor>" header.

**Files:** reads EDICREDITS, ARMST, APMST (IVMST, CONTROL opened unused) · writes none  
**Calls:** EXECUTE SSELECT EDICREDITS

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRT.EDI.CREDIT.01 | EDICREDITS uses ARSHIP layout; lines from attr 10 VPROD, 11 VDESC (43 chars), 12 VQTY, 13 VCOST (cents); line amount = VCOST*VQTY; total = sum | L21,31-43 | KEEP |
| PRT.EDI.CREDIT.02 | Vendor name from APMST attr 1 keyed by attr 9 VEND, else "VENDOR UNKNOWN" | L49-51 | KEEP |
| PRT.EDI.CREDIT.03 | Header prints surcharge attr 8 (cents) alongside date, invoice ID[5,5], terms attr 6, PO attr 5, vendor invoice attr 7 | L54 | QUESTION |

**Bugs / oddities:** credits printed as positive amounts — "THIS IS A CREDIT" MSG defined but never printed (L22); surcharge printed but not included in total. Credit identity relies on file, not sign.

## PRT.EDI.INV

**Mode:** Report/print · **Lines:** 58 · **Relevance:** VENDOR, PRICING

Laser-print version of PDF.EDI.INV: prints all ARSHIP invoices using vendor (EDI) line data with vendor "Billing for" header.

**Files:** reads ARSHIP, ARMST, APMST · writes none  
**Calls:** EXECUTE SSELECT ARSHIP

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRT.EDI.INV.01 | Identical to PRT.EDI.CREDIT.01-03 except source ARSHIP and invoice # ID[5,6] | L24,54 | KEEP |

**Bugs / oddities:** duplicate of PRT.EDI.CREDIT; selects all ARSHIP, not only EDI-sourced invoices; header surcharge (attr 8) not in total.

## REDI.RPT

**Mode:** Utility/maintenance · **Lines:** 18 · **Relevance:** VENDOR

Intended to reprint EDI invoices from ARHIST for an invoice-number range by calling PDF.EDI.INV.

**Files:** reads ARHIST (select only) · writes none  
**Calls:** intended PDF.EDI.INV (malformed)

| ID | Rule | Source | Tag |
|---|---|---|---|
| REDI.RPT.01 | Select ARHIST by INVNO between two operator-entered numbers (prompts mislabelled as dates and validated as MM.DD.YY) | L10-15 | OBSOLETE |

**Bugs / oddities:** L16 "RPDF.EDI.INV" is not a valid statement (likely meant EXECUTE 'RUN BP PDF.EDI.INV') and L16-17 loop forever; "WITH WITH" in select (L15); start number validated as a date pattern. Program cannot work as written.

## UPD.EDICREDITS

**Mode:** Staging-processor · **Lines:** 344 · **Relevance:** VENDOR, PO, PRICING

"Billing for NON-PRO MDS via EDI". It processes vendor invoices for member direct-ship orders staged in EDI 'DATA'. Each invoice posts AP (APDIST/APHIST/APMST/VNMST), bills the member (ARINV/ARSHIP/ARMST/IVEND) with PRO surcharge and member terms, closes the member's vendor PO (VENDORD), and diverts credit invoices to EDICREDITS.

**Files:** reads EDI 'DATA', CONTROL (UPD, APBAT, APPER, DAYS, INV, NEXT.EDICR, MS), APMST, VNIDX, VNMST, ARMST, VENDORD, APHIST · writes APMST, VNMST, APDIST, APHIST, ARMST, ARINV, ARSHIP, IVEND, VENDORD, EDICREDITS, EDI ('ERROR', 'DATA' deleted), CONTROL (APBAT, INV, NEXT.EDICR, MS) (ERROR file opened, unused)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.EDICREDITS.01 | Blocked if CONTROL 'UPD' attr 1 > 2 (update in progress) | L40-41 | KEEP |
| UPD.EDICREDITS.02 | AP batch number = CONTROL 'APBAT' attr 1, incremented per run and shown as 3 digits. Period = CONTROL 'APPER'. Each APDIST gets reference period:batch:counter. | L43-48, L274 | SIMPLIFY |
| UPD.EDICREDITS.03 | Month-end: after the 22nd, if the current month = CONTROL 'UPD' attr 2, the operator must type OK to proceed. Also after the 22nd, the "first day of billing month" (DAY.ONE) is moved forward by CONTROL 'DAYS' attr <month> days, i.e. to next month. Comments say 25th while code uses 22. | L51-62, L10-13 | QUESTION |
| UPD.EDICREDITS.04 | Staging format: one record EDI 'DATA', invoices delimited by an 'ENDOFINVOICE' field. Header fields: 1 PRO vendor (APMST id), 2 member, 3 invoice date, 4 vendor invoice#, 5 member PO, 6 terms %, 7 vendor due date, 8 amount (dollars, ICONV MD2 to cents), 9 shipping (dollars to cents). Detail starts at field 10 in groups of 4 (qty, unit cost dollars, vendor product#, description). The record is deleted at the end. | L67-84, L133-147, L169, L199, L224, L304-310, L329 | OBSOLETE-INTEGRATION |
| UPD.EDICREDITS.05 | Credit invoices (amount < 0) are NOT posted. They are written to EDICREDITS under the next CONTROL 'NEXT.EDICR' number (skipping used ids) and listed as "CREDIT INVOICE" for manual handling. | L87-99 | QUESTION |
| UPD.EDICREDITS.06 | Rejections go to EDI 'ERROR' with a message: vendor not in APMST, member not in ARMST, or duplicate invoice (APHIST key vendor*vendor-invoice already exists) | L134-141, L150-158, L171-187 | KEEP |
| UPD.EDICREDITS.07 | The APMST vendor is mapped to the VNMST vendor through VNIDX attr 1. VNMST supplies attr 15 ADMDAYS (admin days), attr 14 SPCDED (special deduction %) and attr 13 (vendor-credit flag, purpose not named in dict) | L142-146, L268, L299 | QUESTION |
| UPD.EDICREDITS.08 | Member due-date base month: if the invoice day < 26 and the invoice date >= DAY.ONE, invoice month + 1. Otherwise (day >= 26, or dated before the billing month) invoice month + 2. Due day-of-month = first 2 chars of APMST attr 10 DUE.DAYS. | L188-198 | QUESTION |
| UPD.EDICREDITS.09 | Extended-terms buckets on (vendor due date - today - ADMDAYS): <=45 days = base month, FTR 0. 46-76 = +1 month, FTR 1. 77-107 = +2, FTR 2. 108-137 = +3, FTR 3. Over 137 = +4, FTR 4. FTR is incremented by 1 more (buckets <=76 only) when invoice day < 26 and the date is before DAY.ONE. | L199-223 | QUESTION |
| UPD.EDICREDITS.10 | Member billing with FTR = 0 goes to ARMST NEW.MON (attr 10). With FTR > 0 it goes to FUTURE (attr 24), and the ARINV aging is set to -FTR. | L269, L287 | KEEP |
| UPD.EDICREDITS.11 | AP discount for APHIST net: APMST attr 9 PCT. If > 20 it is treated as a flat dollar amount (x100 cents), otherwise as a percent rounded to the cent | L226-231 | QUESTION |
| UPD.EDICREDITS.12 | APDIST discount = invoice amount x EDI terms % (field 6), rounded. APDIST: attr 1 '100' (purpose unclear), 3 gross, 4 discount, 5 invoice date, 6 due = the member due date computed above (not the vendor's due date), 7 GL = APMST attr 12, 9 gross. APHIST: attr 1 date, 2 gross, 3 net (from rule .11), 6 due. Two different discount bases are used. | L272-282 | QUESTION |
| UPD.EDICREDITS.13 | Member PO close-out: on VENDORD <member>, find the PO (attr 2) for this vendor (attr 1) and add the invoice amount to attr 5 BILLED. When billed > 90% of the PO amount (attr 4), the PO line is removed (treated as fully billed). | L232-250 | QUESTION |
| UPD.EDICREDITS.14 | PRO surcharge = round(amount x APMST attr 30 / 1000), i.e. attr 30 in tenths of a percent (dict calls attr 30 R.ADD.SHORT/SRCH%). The surcharge is added to the member's billed amount only when APMST attr 29 CODE = 2. Otherwise it is recorded but not added. | L251-253 | QUESTION |
| UPD.EDICREDITS.15 | Member terms shown on the invoice = EDI terms % - (APMST attr 30 / 10) - VNMST SPCDED. If <= 0 the member gets "NET". Terms text = "<pct>% <due date>". So PRO keeps surcharge points out of the vendor's discount. | L284-286 | QUESTION |
| UPD.EDICREDITS.16 | Hard-coded vendor 497: no IVEND (member purchases-by-vendor) update. The comment calls it a charge back. | L254-255 | QUESTION |
| UPD.EDICREDITS.17 | Hard-coded vendor 569: no IVEND update (comment: charge back) | L254-255 | QUESTION |
| UPD.EDICREDITS.18 | Hard-coded vendor 1322: no IVEND update (not explained in comment) | L255 | QUESTION |
| UPD.EDICREDITS.19 | IVEND <member>: per-vendor attr 2 += amount (incl. surcharge if added), attr 3 += surcharge. The vendor entry is removed when its amount nets to 0. | L256-265 | KEEP |
| UPD.EDICREDITS.20 | ARMST updates: attr 9 YTD += amount, attr 15 balance += amount, attr 21 surcharge += surcharge, attr 18 LAST.SALE = invoice date, attr 22 VN.CRED += amount when VNMST attr 13 is set. High credit attr 16 = INT(balance/100) when higher, which is stored in dollars while balance is in cents. | L266-271 | QUESTION |
| UPD.EDICREDITS.21 | Member invoice number = CONTROL 'INV' + 1, wrapping to 1 at 99999, with no collision check | L289-291 | QUESTION |
| UPD.EDICREDITS.22 | ARINV append: number, date, amount, terms (MTERMS %), aging. Attr 8 = 1 for vendor-credit vendors (VNMST attr 13 = 1). | L288-301 | KEEP |
| UPD.EDICREDITS.23 | ARSHIP `<member><inv>`: 1 date, 2 vendor, 4 amount, 5 PO, 6 terms text, 7 vendor invoice, 8 surcharge, 9 vendor. Lines in attrs 10-13 (vendor product, description, qty, cost cents). Non-zero shipping is added as pseudo-product 9999 "Shipping Charges", qty 1. | L302-317 | KEEP |
| UPD.EDICREDITS.24 | Shipping (field 9) is NOT added to the billed amount (`AMT += SHIP` is commented out) and is only listed as a detail line. This assumes the vendor amount already includes it. | L224-225 | QUESTION |
| UPD.EDICREDITS.25 | CONTROL 'MS' running totals: attr 1 += surcharge, attr 3 += billed amount | L266, L319-324 | QUESTION |
| UPD.EDICREDITS.26 | Per vendor (flushed when processing moves on): APMST attr 15 YTD.GROSS and attr 16 OPEN.GROSS += gross, APMST attr 31 += surcharge (dict names attr 31 R.CSZ, so the purpose is unclear). VNMST attr 7 YTD.SALES += billed, attr 9 SURCHARGES += surcharge. | L107-131 | QUESTION |
| UPD.EDICREDITS.27 | End-of-run totals: billings, credits, shipping, AP gross/discount/net, error list | L330-343 | SIMPLIFY |

**Bugs / oddities:** Program name says CREDITS, but it bills all EDI invoices. VDISC is reused as the APMST percent and as the discount accumulator (L226 vs L280), so GDISC/"A/P DISC" totals are wrong. GOSUB 55 runs on the first pass with VEND unassigned. MATREADU ELSE conflates locked/not-found for APMST, VENDORD, ARINV and CONTROL MS (silent-fallthrough). Error paths re-write EDI 'DATA' but it is deleted at the end anyway, so remaining data is not preserved. FTR increment comments conflict with code. Hi-credit unit mismatch (dollars vs cents). The month bucket arithmetic omits zero-padding (e.g. '2/15/27').
