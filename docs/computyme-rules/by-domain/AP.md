# AP — Computyme programs and rules

10 programs, 38 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## AP.SEL.INVSPC

**Mode:** Interactive · **Lines:** 126 · **Relevance:** VENDOR, PRICING

Selects all unpaid AP invoices for one vendor for payment while taking an extra "special" discount off each invoice.

**Files:** reads APDIST, APHIST, APDUE, APMST, CONTROL · writes APDIST, APHIST, APDUE, CONTROL (APCHK)  
**Calls:** CALL IDATE

| ID | Rule | Source | Tag |
|---|---|---|---|
| AP.SEL.INVSPC.01 | Blocks new selection if CONTROL 'APCHK' attr 3 > 0 (a selection exists or checks printed but not updated) | L18-26 | KEEP |
| AP.SEL.INVSPC.02 | Vendor must exist in APMST (attr 1 NAME read) | L35-37 | KEEP |
| AP.SEL.INVSPC.03 | Payment date defaults to today; validated by IDATE | L40-45 | KEEP |
| AP.SEL.INVSPC.04 | Additional discount % defaults to 2; accepts N, N.N or N.NN (error text says 1–9% but 0 and fractions under 1 are accepted) | L47-57 | QUESTION |
| AP.SEL.INVSPC.05 | Selects APDIST for the vendor where STAT.PAID = "0" | L60 | KEEP |
| AP.SEL.INVSPC.06 | Hard-coded exclusion: invoices with DUE = "02/15/03" are skipped | L61 | QUESTION |
| AP.SEL.INVSPC.07 | Special discount SPC = ROUND(APDIST attr 3 GROSS × disc% / 100) (integer, half-up; units as stored in APDIST, likely cents) | L84 | KEEP |
| AP.SEL.INVSPC.08 | Net to pay = GROSS (attr 3) − regular DISC (attr 4) − SPC | L85 | KEEP |
| AP.SEL.INVSPC.09 | Credits/zero nets (NET ≤ 0, or running total + NET ≤ 0) are held and only selected when a later positive invoice is selected, so credits net against payables | L86-95, L105-124 | SIMPLIFY |
| AP.SEL.INVSPC.10 | On selection: APDIST attr 1 STATUS 2nd character set to "1" (selected); APDIST attr 4 DISC += SPC; APHIST attr 3 NET = NET; APDUE record written with 1 = due/pay date, 2 = net, 5 = additional discount | L96-102 | KEEP |
| AP.SEL.INVSPC.11 | CONTROL APCHK attr 2 = pay date, attr 3 = check count (1 if total > 0 else 0) | L68-70 | KEEP |

**Bugs / oddities:** Held credits left in the list at end of run are never written (lost); held items use APHIST key FIELD(id,'*',1,2) while main path uses full ID — inconsistent keys; error prefix says "AP9"; MATREADU ELSE treats locked as not-found.

## AP10

**Mode:** Interactive · **Lines:** 38 · **Relevance:** VENDOR

Cancels the entire pending AP payment selection and reverses special discounts.

**Files:** reads CONTROL, APDUE, APDIST, APHIST · writes APDIST, APHIST, CONTROL; deletes APDUE  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| AP10.01 | Requires explicit "Y" confirmation | L15-16 | KEEP |
| AP10.02 | If CONTROL APCHK attr 4 is set, warns that checks were printed and must be voided manually (does not block) | L18-20 | QUESTION |
| AP10.03 | For every APDUE record: delete it, reset APDIST attr 1 STATUS 2nd char to "0", APDIST attr 4 DISC −= APDUE attr 5 ADD.DISC, APHIST attr 3 NET += ADD.DISC | L28-36 | KEEP |
| AP10.04 | Clears CONTROL APCHK attrs 2, 3, 4 when done | L23-26 | KEEP |

**Bugs / oddities:** Any read failure CHAINs to ABORT mid-run leaving a partially reversed selection; reverses using APHIST key = APDUE ID whereas AP.SEL.INVSPC held-credit path wrote APHIST under FIELD(id,'*',1,2).

## CUST.RBT.CHKS

**Mode:** Report/print · **Lines:** 70 · **Relevance:** PRODUCT

Reprints/prints consumer rebate checks from RBTDATA for a check-number range not yet flagged printed.

**Files:** reads RBTDATA, IVMST · writes RBTDATA (attr 7 PRINTED flag)  
**Calls:** EXECUTE SSELECT RBTDATA

| ID | Rule | Source | Tag |
|---|---|---|---|
| CUST.RBT.CHKS.01 | Select RBTDATA checks with CHK.NO between operator-entered start and end and WITHOUT PRINTED = Y | L18-22 | KEEP |
| CUST.RBT.CHKS.02 | Sets RBTDATA attr 7 = "Y" (printed) BEFORE the check is actually printed; a printer failure leaves it marked printed | L26 | QUESTION |
| CUST.RBT.CHKS.03 | Check layout: date from RBTDATA attr 1, dealer name attr 2 value 2, consumer name/address attr 4 values 2-6, amount attr 5 (cents, shown MD2), up to two products from attr 6 with IVMST attr 4 DESC printed as "A <desc> AND A <desc>" | L27-57 | KEEP |
| CUST.RBT.CHKS.04 | Hard-coded bank MICR line on check: routing 021000021 and a bank account number embedded in code | L45 | QUESTION |
| CUST.RBT.CHKS.05 | Check printing via HP PCL escape codes and a fixed 63-line form | L8-9,L42-62 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Printed flag written before print; `CHKN0` (zero) typo var unused.

## CUST.RBT.LJ

**Mode:** Interactive · **Lines:** 114 · **Relevance:** PRODUCT

Enter a consumer rebate (dealer, rebate code, products, consumer address), store in RBTDATA and print the rebate check on a LaserJet; also voids checks.

**Files:** reads ARMST, STRNAME, RBTCODES, IVMST, RBTDATA · writes RBTDATA  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CUST.RBT.LJ.01 | Check number is operator-entered starting number and auto-increments by 1 after each check printed | L18,L103 | SIMPLIFY |
| CUST.RBT.LJ.02 | If entered check # already exists in RBTDATA, operator may void it; otherwise must enter a new starting number (no overwrite) | L20-23 | KEEP |
| CUST.RBT.LJ.03 | Void: if attr 2 value 1 already "VOID" reject; else set attr2<1,1>="VOID", attr2<1,3>=original check date, attr 1 = today, amount attr 5 negated by prefixing "-" | L106-111 | KEEP |
| CUST.RBT.LJ.04 | Dealer name looked up first in STRNAME attr 1, else ARMST attr 1 NAME; dealer must exist in one of them | L28-29 (STRNAME purpose unclear) | QUESTION |
| CUST.RBT.LJ.05 | Rebate amount and description come from RBTCODES (attr 1 desc, attr 2 amount in cents, attr 3 printed on check line 8); code must exist | L33-35,L78 | KEEP |
| CUST.RBT.LJ.06 | One required product and one optional second product, each must exist in IVMST; desc from IVMST attr 4 | L37-45 | KEEP |
| CUST.RBT.LJ.07 | Purchase date must match NN.NN.NN, stored internal; consumer name/street/city/state/zip required, state must be 2 chars | L48-65 | KEEP |
| CUST.RBT.LJ.08 | RBTDATA layout: 1=check date (today), 2=dealer#VMdealer name, 3=rebate code, 4=purchase date VM name VM street VM city VM state VM zip, 5=amount, 6=prod1 VM prod2 | L71-77 | KEEP |
| CUST.RBT.LJ.09 | LaserJet escape codes and fixed 60-line check form | L78-101 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** L64 `IF ZIP = 'E' ZIP='END'` missing OR (syntax/logic bug); CUSTRBT.LJ is a near-duplicate.

## CUSTRBT.LJ

**Mode:** Test-variant · **Lines:** 114 · **Relevance:** PRODUCT

Duplicate of CUST.RBT.LJ (consumer rebate entry + check print) with a different check layout including a MICR line.

**Files:** reads ARMST, STRNAME, RBTCODES, IVMST, RBTDATA · writes RBTDATA  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CUSTRBT.LJ.01 | Prints check number in large font and a hard-coded MICR line with routing 021000021 and a bank account number | L80,L83 | QUESTION |
| CUSTRBT.LJ.02 | Different PCL layout (lines 5-60, orientation/margin escapes) | L80-97 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Fixes the L64 ZIP OR bug of CUST.RBT.LJ (L66 has OR). Which of the two is live is unknown.

## CUSTRBT.NEW

**Mode:** Test-variant · **Lines:** 92 · **Relevance:** PRODUCT

Copy of CUST.RBT.LJ that records consumer rebates in RBTDATA without printing a check (checks printed later by CUST.RBT.CHKS).

**Files:** reads ARMST, STRNAME, RBTCODES, IVMST, RBTDATA · writes RBTDATA  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CUSTRBT.NEW.01 | Rebate record is written to RBTDATA with no check printed; check number still operator-entered and incremented | L72-81 | SIMPLIFY |

**Bugs / oddities:** L62 `IF STATE = 'E' STATE='END'` missing OR. Unused PCL vars/FORM array left over.

## CUSTRBTNEW1

**Mode:** Test-variant · **Lines:** 79 · **Relevance:** PRODUCT

Variant of CUSTRBT.NEW that takes the next rebate check number from CONTROL instead of operator entry; no void function.

**Files:** reads ARMST, STRNAME, RBTCODES, IVMST, CONTROL · writes RBTDATA, CONTROL  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| CUSTRBTNEW1.01 | Next rebate check number kept in CONTROL record 'RBTCHK' attr 1; read at start, incremented per entry, written back only when operator exits with E at dealer prompt | L20,L24,L76 | SIMPLIFY |
| CUSTRBTNEW1.02 | No check-exists test: MATWRITE overwrites any existing RBTDATA record with the same number; no void path | L74 | QUESTION |

**Bugs / oddities:** Counter only persisted on clean exit (crash/disconnect reuses numbers); two users would share/collide; L57 STATE OR bug.

## FIX.RBTCHK

**Mode:** Utility/maintenance · **Lines:** 10 · **Relevance:** none

One-off renumbering of consumer rebate checks.

**Files:** reads/writes RBTDATA  
**Calls:** EXECUTE SELECT RBTDATA

| ID | Rule | Source | Tag |
|---|---|---|---|
| FIX.RBTCHK.01 | Hard-coded: checks >= 35790 copied to new id '2' + chars 2-5 of old id (old record not deleted) | L4-8 | OBSOLETE |

**Bugs / oddities:** Creates duplicates (old records kept).

## LJ.CHK.TEST

**Mode:** Test-variant · **Lines:** 24 · **Relevance:** none

Test print of a sample check with MICR line on the laser printer (dummy data).

**Files:** none  
**Calls:** EXECUTE TERM

| ID | Rule | Source | Tag |
|---|---|---|---|
| LJ.CHK.TEST.01 | Printer-test only; prints dummy payee/amount and MICR string 'C12345C A028000121A 261D050346C' (contains what looks like a routing/account number — confirm whether real) | L16 | OBSOLETE |

**Bugs / oddities:** hard-coded MICR line may contain a real bank routing/account number.

## REBUILD.APBR

**Mode:** Utility/maintenance · **Lines:** 23 · **Relevance:** VENDOR

One-off rebuild of the AP check register (APBR) from AP distribution records in saved list APDIST.JOHN, one APBR record per check.

**Files:** reads APDIST, APMST · writes APBR  
**Calls:** EXECUTE GET-LIST APDIST.JOHN

| ID | Rule | Source | Tag |
|---|---|---|---|
| REBUILD.APBR.01 | APDIST key ID[1,4] = AP vendor (APMST key); APBR record per check # (APDIST attr 15): attr 1 vendor, 2 vendor name (APMST attr 1), 3 date paid (APDIST attr 10), 4 sum gross (attr 3), 5 sum discount (attr 4), 6 net = gross - discount | L8-19 | KEEP |
| REBUILD.APBR.02 | Hard-coded saved list APDIST.JOHN (user-specific one-off) | L5 | OBSOLETE |

**Bugs / oddities:** relies on list being sorted by check (control break, L9); vendor/name/date taken from last APDIST row of the check; APDIST attr 13 deductions ignored in net; OPEN failures only print and continue.
