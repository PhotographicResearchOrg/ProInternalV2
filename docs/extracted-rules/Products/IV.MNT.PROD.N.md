# IV.MNT.PROD.N — Product maintenance (variant ".N": authorization, change log, extended fields)

**Source program:** `BP/IV.MNT.PROD.N`
**Domain:** Products
**Integration mode:** Test-variant
**Lines of code:** 1116
**Last code change:** 2 June 2011 (header line 2). DUTY/ENTRY.NO code has no header entry; IV.DSP.PROD dates matching display changes to 05-11-12.
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

> **Scope of this extraction:** only behaviour that **differs** from `IV.MNT.PROD` (see `Products/IV.MNT.PROD.md`). Rules not repeated here are the same as the canonical rule with the same intent; the canonical IDs are referenced where useful.
>
> **Mode caveat:** tagged Test-variant as instructed because it is not *provably* live. The evidence points the other way: this is the newest and most complete product-maintenance source (2011 header, ~16 change-log entries after the canonical 2004 version), and IV.DSP.PROD (2012) displays DUTY and ENTRY.NO, which only this variant maintains. It reads its own SCREENS records (`IV.MNT.PROD.N`, `IV.MNT.PROD.PRMTS.N`), so it can only run if those exist. **Check the VOC/catalog on the live account: if `IV.MNT.PROD` is cataloged from this source, re-tag the mode to Interactive and treat these rules as production.**

## 1. Purpose — what this program does

Same job as IV.MNT.PROD (look up, change or create a product master record and maintain the UPC/catalog index), plus five additions. It (a) gates entry with a per-user authority code; (b) writes an IVMST.LOG audit record of changed screen fields on every save; (c) blocks reuse of discontinued product numbers (IVMST.DISC); (d) adds brand, delete status, warehouse rebate/IPI flags, discard, do-not-ship, weight, dimensions, country of origin, HS code, duty and customs entry number; (e) separates "new blank product" (A/N) from "repeat last product" (R). It does not create POs or maintain stock.

## 1.5. Integration footprint

N/A — interactive (test-variant).

## 2. Files (tables) read or written

Only differences from IV.MNT.PROD are listed; all canonical files are still used.

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST.DISC | Discontinued products (same layout as IVMST). Existence of a key blocks reuse of that product number | READ |
| IVMST.LOG | Product change log, key = `date*time` | WRITE (READU lock first) |
| CONTROL | Adds record `IV.MNT.PROD` (attr 1 = users, attr 2 = authority-code patterns) and `COO` (attr 1 = origin codes, attr 2 = country names); `PID` now read with a lock | READ+WRITE |
| APMST | Now also checked as a key space when generating product numbers | READ |
| SCREENS | Records `IV.MNT.PROD.N` and `IV.MNT.PROD.PRMTS.N` (variant-specific layout) | READ |

## 3. External subroutines / chained programs called

Same as IV.MNT.PROD (EDIT.LINE, MONEY, DSP.REPORT, RUN IV8, RUN CHANGE.VNORD, SORT-LABEL, TERM, CHAIN 'ABORT'). No new external calls.

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| (authorization block, unlabeled) | 70–89 | program start |
| COMPARE.FLDS | 1038–1099 | INP.OPT (254) |
| GET.NEXT.PROD (rewritten) | 1005–1036 | INP.OPT (211), CALC.UPC (1102) |
| INP.DIMENSIONS | 924–958 | INP.FLDS (463) |

## 4. Business rules — extracted (differences from IV.MNT.PROD only)

### 4.1 Authorization / hold / status checks

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.N.01 | To use the program, the user's login name (the part after `\` in @LOGNAME) must appear in CONTROL `IV.MNT.PROD` attr 1, and the authority code they type must **pattern-match** (UniVerse MATCHES) the entry at the same position in attr 2. Otherwise "NOT authorized" is shown and the program aborts. The code prompt is pre-filled with the text `ENCODE`. | 71–89 | QUESTION |
| IV.MNT.PROD.N.02 | Authorization is all-or-nothing: an authorized user can change every field, including raw cost, PO cost, Price-1/2/3, retail, MAP, surcharge, PRO vendor, AP vendor and UPC. | 71–89; 429–469 | QUESTION |
| IV.MNT.PROD.N.03 | A product number found in IVMST.DISC (discontinued) cannot be reused: "has been discontinued and cannot be reused". | 159–167 | KEEP |
| IV.MNT.PROD.N.04 | Delete status accepts only blank, 0, 1, 2 or 3. The meaning of each level is not in this program. | 330, 845–861 | QUESTION |
| IV.MNT.PROD.N.05 | Do-not-ship flag accepts blank or 1 ("Y" → 1, "N"/0 → blank); shown as YES/blank. IV.DSP.PROD's header identifies it as IVMST(46). | 343–345, 881–897 | KEEP |
| IV.MNT.PROD.N.06 | Discard flag accepts blank or 1 ("Y" → 1, "N"/0 → blank); shown as YES/No. | 340–342, 863–879 | QUESTION |

QUESTION N.01: Is a shared, pattern-matched code per user the intended control? PIV2 will use real identity and roles.
QUESTION N.02: Which roles may change cost fields, sell-price fields, vendor links and UPCs?
QUESTION N.04: Define delete-status 0/1/2/3. The dictionary suggests status ≥ 1 = winding down: ACTIVE = "N" when stock is gone, NPR, LTD.
QUESTION N.06: Discard is binary here, but the D_IVMST `DISCARD` item decodes attr 41 as 0 Disc, 1 Whse, 2 Offc, 3 Test, 4 Mem, 5 Vend (defective-return dispositions). Which is correct, and is this flag the same attribute?

### 4.2 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.N.07 | If the product is locked by another user, the program shows "locked by user N" for 3 seconds and returns to the product prompt instead of waiting. | 153–157 | KEEP |
| IV.MNT.PROD.N.08 | "A" or "N" starts a **blank** new product and walks every field. (Canonical: "A"/"N" copied the prior product.) | 125–128 | KEEP |
| IV.MNT.PROD.N.09 | "R" (repeat) copies the last product shown, clearing UPC, catalog no., YTD shipments, monthly orders (current and prior year), open PO numbers/quantities/amounts/backorders, receipt quantities/amounts/dates, member requests, sales YTD, profit YTD, delete status, pick and stock locations, warehouse UPC, weight and dimensions. Everything else (vendors, costs, prices, groups, flags, origin, HS code) is copied. | 129–148 | SIMPLIFY |
| IV.MNT.PROD.N.10 | The keyed-number add path ("not on file — add?") still copies the prior product minus UPC/catalog only, **without** the "R" clearing list. | 176–177 | QUESTION |
| IV.MNT.PROD.N.11 | On Update, if UPC is blank the operator is prompted to type "C" to generate a PRO UPC; any other answer saves without a UPC. | 214–224 | SIMPLIFY |
| IV.MNT.PROD.N.12 | Brand is free text with no validation. | 312, 500–506 | QUESTION |
| IV.MNT.PROD.N.13 | Sub-group: a negative entry shows "Must be null, 0 or greater than 0" but is **stored anyway**. | 532–544 | QUESTION |
| IV.MNT.PROD.N.14 | Month's supply must be a whole number or blank (the canonical version did not validate it). | 796–805 | KEEP |

QUESTION N.10: Should a keyed-number add start blank, like "A"/"N"?
QUESTION N.12: Should brand be a pick from the BRANDS file? D_IVMST attr 14 (BID) is read as a BRANDS key via `TRANS(BRANDS,BID,NAME)`.
QUESTION N.13: Are negative sub-groups ever valid?

### 4.3 Terms, pricing, rebates

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.N.15 | Warehouse-rebate flag accepts only "N" or blank. | 338, 823–832 | QUESTION |
| IV.MNT.PROD.N.16 | Warehouse-IPI flag accepts only "Y" or blank. | 339, 834–843 | QUESTION |
| IV.MNT.PROD.N.17 | On saving an existing product: a Price-1 change stamps today into value 2 of attr 11 (DATE-CHG); a Price-2 **or** Price-3 change stamps today into value 1. A new product sets attr 11 to today. (Canonical replaced the whole attribute.) | 226–231 | QUESTION |

QUESTION N.15: What does warehouse-rebate "N" exclude the product from (e.g. warehouse/quarterly rebate calculation)?
QUESTION N.16: What is "IPI" (instant price incentive / instant rebate?), and what does "Y" enable? D_IVMST also names attr 43 FUJI.REB and NOT.USED.
QUESTION N.17: Value 1 is read elsewhere as the **creation date** (DT.CREATED, YR.CREATED), and values 3/4 as the P2/P3 change dates. Should P2/P3 changes stamp values 3/4?

### 4.4 Logistics, customs and origin

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.N.18 | Weight in pounds: a whole number or up to 2 decimals, stored as text normalised to `n.nn`; blank clears. | 346–347, 899–922 | SIMPLIFY |
| IV.MNT.PROD.N.19 | Dimensions: three numbers (each whole or 1 decimal) separated by one consistent delimiter (`:`, `/`, space, `X`, `x`), stored as `LxWxH`. Units are not stated. | 348, 924–958 | SIMPLIFY |
| IV.MNT.PROD.N.20 | Country of origin must be one of the codes in CONTROL `COO` attr 1. Its name (first 6 chars of attr 2) is displayed. The field loops until valid or Esc. | 66–69, 349–353, 960–970 | KEEP |
| IV.MNT.PROD.N.21 | HS code: blank or `####.##.####` (10-digit tariff code). It replaces the whole attribute. | 354, 972–981 | QUESTION |
| IV.MNT.PROD.N.22 | Duty: blank or `n.n` (one decimal, text). | 355, 983–992 | QUESTION |
| IV.MNT.PROD.N.23 | Customs entry number: blank or `AA#-#######-#` (e.g. `AB1-1234567-8`). | 356, 994–1003 | QUESTION |

QUESTION N.21: D_IVMST attr 53 is multi-valued, with value 1 = US HS code and value 2 = Canadian HS code (US.HS.CODE, CA.HS.CODE). Must PIV2 hold one HS code per market (US, CA, EU)? This screen erases value 2.
QUESTION N.22: Is duty a percent? D_IVMST also names attr 54 SHIP.CHG (money, MD2Z): which meaning is real?
QUESTION N.23: A customs entry number is per import shipment, not per product. Why is it on the product, and is it still used?

### 4.5 New product numbering

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.N.24 | The next-number record CONTROL `PID` is read with a lock. If another user holds it, "locked by user N" is shown and the read retries every 3 seconds. | 1005–1016 | SIMPLIFY |
| IV.MNT.PROD.N.25 | A candidate number is skipped (+7) if it already exists as an IVMST product, an IVCAT key (UPC/catalog no.), an IVMST.DISC discontinued product **or an APMST vendor id**. Above 9989 it wraps to 1005. The number after the one used (+7) is stored back. | 1017–1030 | QUESTION |

QUESTION N.25: Why must product numbers avoid AP vendor ids? Does wrapping into the 1005+ range risk reusing old numbers? It is protected only by IVMST/IVMST.DISC/IVCAT/APMST existence.

### 4.6 Persistence — change log (IVMST.LOG)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.N.26 | After every save, each screen field is compared with its value when the product was read. If any differ, one IVMST.LOG record is written with key `internal-date*internal-time`, attr 1 = user, attr 2 = product, and attrs 3–6 = multi-valued field name, attribute number, old value, new value. | 183, 254, 1038–1099 | KEEP |
| IV.MNT.PROD.N.27 | Each logged change gets a type code in attr 7: D = description/web description, I = Price-1, V = Price-2, R = Retail, M = MAP, N = web-display flag. All other fields (raw cost, PO cost, Price-3, surcharge, vendors, UPC etc.) get a blank type. | 1085–1092 | QUESTION |
| IV.MNT.PROD.N.28 | Creating a product ("A"/"N"/"R") writes **no** log entries, because the comparison baseline is set to the new record just before saving. Only edits to existing products are logged. | 211 | QUESTION |

QUESTION N.27: Which downstream process reads the type codes (web feed, price-change notices to members)? PIV2 must keep feeding it.
QUESTION N.28: Should product creation (with its initial cost and prices) be audited?

### 4.7 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.N.29 | The product lock is released at the end of each product cycle (fixes canonical rule .30). | 110 | KEEP |
| IV.MNT.PROD.N.30 | IVCAT index keys are locked (READVU) before each write/delete. | 237–252 | KEEP |
| IV.MNT.PROD.N.31 | The IVMST.LOG key is locked (READU ... ELSE NULL, no LOCKED clause) before the log is written. | 1096–1097 | SIMPLIFY |

Customer-specific exceptions (hard-coded member numbers): N/A — none.
Vendor-specific exceptions (hard-coded vendor numbers): N/A — none.
Product-group rules: N/A — none.
Wire format / parsing: N/A — interactive.

## 5. Hard-coded business identifiers found

Identifiers additional to those in IV.MNT.PROD.md Section 5 (`0291440`, step 7, `'4N'`, `PID`, x10 surcharge, rebate cap 99, `GROUPS` all still present).

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `9989` | Threshold | 1028 | Highest product number before wrap | QUESTION |
| `1005` | Magic-number | 1028 | Wrap-around restart number (header comment says 1001) | QUESTION |
| `'IV.MNT.PROD'` (CONTROL key) | Other | 77 | User list + authority-code patterns | QUESTION |
| `'ENCODE'` | Other | 75 | Default text pre-filled in the authority-code prompt | QUESTION |
| `'COO'` (CONTROL key) | Other | 66 | Country-of-origin code table | QUESTION |
| `'U'` (origin) | Other | 968 | Special handling when origin = U (clears IP/EXIT, see bug 9) | QUESTION |
| `0/1/2/3` delete status | Threshold | 850–856 | Allowed delete-status levels | QUESTION |
| `"4N'.'2N'.'4N"` | Other | 977 | HS-code format | QUESTION |
| `"2A1N'-'7N'-'1N"` | Other | 999 | Customs entry-number format | QUESTION |
| Log type letters `D I V R M N` | Other | 1086–1091 | Change-type codes in IVMST.LOG | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVMST (matrix IVM, DIM 70; copies OIVM and TIVM = baseline for logging)

Attributes additional to IV.MNT.PROD.md Section 6. EQU include not in dump; mapped by name to D_IVMST.

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 3 | IVMST.REQ | Member requested qty | units | Cleared on "R" |
| 13 | IVMST.YTD | Monthly shipments (MV) | units | Cleared on "R" |
| 14 | IVMST.BRAND | Brand | n/a | Comment "change NMORD field to Brand". D_IVMST reads attr 14 as a BRANDS **key** (BID); this screen stores free text. **Conflict** |
| 15 (likely) | IVMST.DEL.STATUS | Delete status 0–3 | n/a | D_IVMST STATUS. Confirm |
| 17 / 18 | IVMST.MORD / IVMST.MPYR | Monthly member orders, current/prior year (MV) | units | Cleared on "R" |
| 20–26 | IVMST.PO.NO, QTY.ORD, PO.AMT, QTY.BO, QTY.REC, AMT.REC, DT.REC | Open POs and receipt layers (MV, positionally parallel) | PO.AMT and AMT.REC = **cents** (MD2); dates Pick | Cleared on "R" only |
| 41 (candidate) | IVMST.DISCARD | Discard flag 1/blank | n/a | D_IVMST DISCD decodes 0–5 dispositions. **Conflict**, confirm attr |
| 43 (likely) | IVMST.WHSIPI | Warehouse IPI Y/blank | n/a | D_IVMST IPI/WIPI; also named FUJI.REB, NOT.USED (**overloaded name history**) |
| ? | IVMST.WHSREB | Warehouse rebate N/blank | n/a | Attr unknown. Confirm |
| 44 / 45 | IVMST.SYTD / IVMST.PYTD | Monthly sales / profit (MV) | **cents** (MD2) | Cleared on "R" |
| 46 | IVMST.DONOTSHIP | Do-not-ship 1/blank | n/a | Confirmed by IV.DSP.PROD header; D_IVMST names it HOLD |
| 47 / 48 | IVMST.P.LOC / IVMST.S.LOC | Pick / stock location | n/a | Cleared on "R" |
| 49 | IVMST.WEIGHT | Weight | **pounds, literal decimal text** "n.nn" (not implied decimals) | Units differ from money convention |
| 50 | IVMST.DIMENSIONS | `LxWxH` | unstated (dictionary CI/DIM.WT imply inches) | |
| 51 | IVMST.W.UPC | Warehouse UPC/EAN | n/a | Cleared on "R"; not editable here |
| 52 | IVMST.ORIGIN | Country-of-origin code | n/a | Validated against CONTROL COO |
| 53 | IVMST.HS.CODE | HS code | n/a | **Multi-valued in D_IVMST (US, CA)**; this screen writes a single value |
| 54 | IVMST.DUTY | Duty `n.n` | unknown — confirm (percent?) | **Overloaded**: D_IVMST also SHIP.CHG, MD2Z money |
| 55 | IVMST.ENTRY.NO | Customs entry number | n/a | D_IVMST conversion MDZ (numeric) conflicts with an alphanumeric value |

### IVMST.LOG (matrix LOG, DIM 10) — key `DATE()*TIME()`

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 1 | — | User (login after `\`) | n/a | |
| 2 | — | Product number | n/a | |
| 3 | — | Field names (MV) | n/a | Screen names, e.g. PRICE.1 |
| 4 | — | Attribute numbers (MV) | n/a | |
| 5 | — | Old values (MV) | raw stored form (cents/tenths/text) | Units depend on the field |
| 6 | — | New values (MV) | same | |
| 7 | — | Type codes (MV) | n/a | D_IVMST.LOG defines TYPE as **single**-valued; the code writes MV |

### CONTROL `IV.MNT.PROD` / `COO`

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| IV.MNT.PROD 1 | — | Authorized user names (MV) | n/a | |
| IV.MNT.PROD 2 | — | Authority-code **patterns** (MV, parallel to 1) | n/a | Secrets stored in clear |
| COO 1 | — | Origin codes (MV) | n/a | e.g. C, T, H, J, K, U |
| COO 2 | — | Country names (MV, parallel) | n/a | |

## 7. Bug suspects

1. **Missing separator (line 205):** `CASE IP[1,1]='E' OR EXIT IP='E'` lacks the `;` that the canonical line 129 has. Confirm it compiles and behaves as intended.
2. **Stale-value logging (lines 1045–1094):** VAL/OVAL/ATTR are not reset per field. DUTY and ENTRY.NO are on the screen (INP.FLDS 466–467) but missing from the COMPARE.FLDS CASE, so their changes are never logged. If the previous field changed, its change is logged again under the name DUTY/ENTRY.NO.
3. **Log key collision (line 1039):** key = date*time to the second. Two saves in the same second (any users) produce the same key; the second MATWRITE overwrites the first record and audit is lost.
4. **HS code erasure (line 979):** writes the whole multi-valued attr 53, deleting the Canadian HS code in value 2.
5. **Wrong date positions (lines 228–229):** Price-2/Price-3 changes overwrite value 1, which dictionary items read as the creation date; raw cost and MAP changes (values 5/6) are never stamped.
6. **Wrap number vs comment (line 1028 vs header line 21):** the code wraps to 1005; the header says 1001.
7. **Keyed-number add copies inventory/history (lines 176–177):** see canonical bug 3; only the "R" path clears.
8. **Sub-group warning not enforced (lines 536–542):** a negative value is stored after the warning.
9. **Generic "U"/"E" exit hazard:** INP.OPT ends when IP = 'U' or 'E' after a line edit. INP.ORIGIN special-cases "U" (line 968) to avoid losing the save, but any other field whose last typed value is exactly "U" still exits without saving.
10. **Surcharge x10 compounding (line 727):** inherited from canonical (bug 4 there).
11. **Discard vs dictionary (lines 863–879):** the program can store only 1/blank and turns 0 into blank. If this is attr 41 (DISCD 0–5), it destroys dispositions 0 and 2–5.
12. **Brand into a key field (line 504):** free text is written into the attribute that dictionary items TRANS to the BRANDS file.
13. **Attr 54/55 conversion conflicts:** duty text in an attribute the dictionary formats as money (SHIP.CHG MD2Z); an alphanumeric entry number in an MDZ attribute.
14. **Log type single vs multi (line 1086 vs D_IVMST.LOG attr 7 S):** the NEW.PRICE.1/OLD.PRICE.1 dictionary items read value 1 of NEW/OLD, which is the *first changed field* in screen order, not necessarily Price-1.
15. **Authority-code weaknesses (lines 75–82):** the comparison is a pattern MATCH (a loose pattern such as `0X` accepts anything); the prompt is pre-filled with `ENCODE`; EDIT.LINE echoes the code on screen; if @LOGNAME has no `\`, USER is blank and may match an empty slot in attr 1.
16. **Loops that ignore up-arrow (lines 966, 978, 989, 1000):** ORIGIN/HS/DUTY/ENTRY loop until valid or Esc. With a blank origin during the add walk, the operator cannot step back.
17. **Generated UPC bypasses the duplicate check (lines 218–220):** the Update-time "C" writes the calculated UPC without the IVCAT lookup that INP.UPC performs.
18. **Log write not transactional with the product write (lines 233–254):** IVMST and IVCAT are written before COMPARE.FLDS; a failure in between leaves a change with no audit.

## 8. Schema-design notes for the CTO

- **Entities touched in addition to canonical:** product audit log (IVMST.LOG), discontinued-product archive (IVMST.DISC, read), user authorization list (CONTROL IV.MNT.PROD), country-of-origin code table (CONTROL COO).
- **Audit model:** IVMST.LOG is the only price history Computyme keeps. It is incomplete: creation is not logged; DUTY/ENTRY.NO are mis-logged; same-second collisions occur; values are stored in raw internal units without type. PIV2 should log every field (including create and delete) with typed, unit-normalised old/new values and a unique id. Importing IVMST.LOG history will need per-attribute unit conversion (cents, tenths, text).
- **Overloaded attributes to split:** attr 11 (positional dates), attr 43 (IPI / FUJI.REB / NOT.USED), attr 53 (US/CA HS codes), attr 54 (duty vs drop-ship/ship surcharge), attr 41/DISCARD (binary flag vs 6-way disposition), attr 14 (brand id vs brand text).
- **Status model:** delete status (0–3), do-not-ship, discard, web-display "N", and IVMST.DISC (archived) are separate, unrelated flags. PIV2 needs one product lifecycle (active / winding down / do-not-ship / discontinued) with defined transitions, plus a separate defective-return disposition.
- **International/customs:** the origin code list is a CONTROL record of single letters. HS code must be per market (US, CA, EU) and dated. Entry number looks shipment-level and probably belongs on goods receipt, not the product.
- **Units:** weight is literal decimal pounds; dimensions have no unit; duty has an unknown unit. Fix units (and a metric pair, matching D_IVMST KILOS/METDIM attrs 66/67) before schema commit.
- **Authorization:** the program-level user list and code must be replaced by role-based, field-level permissions; secrets are stored in clear in CONTROL today.
- **Siblings to extract first:** whatever writes IVMST.DISC (discontinue program), the consumers of IVMST.LOG type codes (web/price-change feeds), the CONTROL `COO` data, and the `FILE.INCLUDES IVMST.FIELDS` include (to confirm attrs for DEL.STATUS, DISCARD, WHSREB, WHSIPI, REBATE.PCT, PO.QTY).

## 9. Questions for COO/CFO — consolidated

1. Is a per-user pattern code the intended access control, and who should be on the list? (IV.MNT.PROD.N.01)
2. Which roles may change costs, sell prices, vendor links and UPCs? (IV.MNT.PROD.N.02)
3. What do delete-status levels 0–3 mean, and what does each block? (IV.MNT.PROD.N.04)
4. Is "discard" a yes/no flag or the 6-way defective-return disposition? (IV.MNT.PROD.N.06)
5. Should a keyed-number add start blank? (IV.MNT.PROD.N.10)
6. Should brand be chosen from the BRANDS list? (IV.MNT.PROD.N.12)
7. Are negative sub-groups ever valid? (IV.MNT.PROD.N.13)
8. What does warehouse-rebate "N" mean? (IV.MNT.PROD.N.15)
9. What is IPI, and what does "Y" enable? (IV.MNT.PROD.N.16)
10. Which date should each price change stamp, and should raw cost/MAP changes be dated? (IV.MNT.PROD.N.17)
11. Do we need HS codes per market? (IV.MNT.PROD.N.21)
12. Is duty a percent, and is attr 54 duty or shipping surcharge? (IV.MNT.PROD.N.22)
13. Is the customs entry number still used, and should it move to receiving? (IV.MNT.PROD.N.23)
14. Why must product numbers avoid AP vendor ids, and is wrap-around reuse acceptable? (IV.MNT.PROD.N.25)
15. Who consumes the change-type codes D/I/V/R/M/N? (IV.MNT.PROD.N.27)
16. Should product creation be audited? (IV.MNT.PROD.N.28)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 9 | N.03, N.05, N.07, N.08, N.14, N.20, N.26, N.29, N.30 |
| SIMPLIFY | 6 | N.09, N.11, N.18, N.19, N.24, N.31 |
| OBSOLETE | 0 | — |
| OBSOLETE-INTEGRATION | 0 | — |
| QUESTION | 16 | N.01, N.02, N.04, N.06, N.10, N.12, N.13, N.15, N.16, N.17, N.21, N.22, N.23, N.25, N.27, N.28 |
| WAREHOUSE-ONLY | 0 | — |

Total: 31 rules (9 + 6 + 16 = 31). (IDs abbreviated: "N.03" = IV.MNT.PROD.N.03.)

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Canonical | IV.MNT.PROD | 2004 source; this variant is a superset |
| Sibling (variant) | IV.MNT.PROD.O | Identical to this file except: no DUTY/ENTRY.NO, base SCREENS keys, slightly different clear-screen layout |
| Display | IV.DSP.PROD | Displays the fields this variant adds (incl. DUTY/ENTRY.NO, May 2012) |
| Called program | IV8, CHANGE.VNORD | Same as canonical |
| Related | IV45 | PO print, uses PO.COST (attr 38); header comment line 29 of this file |
| Shared file | IVMST.LOG | D_IVMST.LOG (dictionary) and WH.DATA reference it |
| Shared file | IVMST.DISC | Discontinued products; writer not identified yet |
| Shared file | CONTROL (PID, IV.MNT.PROD, COO) | |
| Domain crossover | Vendors (APMST key space in numbering), Customs/International, Rebates (WHSREB, WHSIPI, REBATE.PCT) | |

**Sibling-series flag:** variant of IV.MNT.PROD with the `.N` suffix ("new"?). It is the most recent and most complete of the three, and its fields match what IV.DSP.PROD (2012) displays. **Probable production logic; confirm the cataloged object before treating the canonical source as authoritative.** IV.MNT.PROD.O appears to be an earlier snapshot of this file (before DUTY/ENTRY.NO).
