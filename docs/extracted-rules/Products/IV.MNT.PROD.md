# IV.MNT.PROD — Product maintenance

**Source program:** `BP/IV.MNT.PROD`
**Domain:** Products
**Integration mode:** Interactive
**Lines of code:** 675
**Last code change:** 03/20/2004 (header line 3; last change-log entry "3-20-04 - SJL")
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

> **Read this first: which version is live.** This file is the canonical *name*, but it is the **oldest** of the three product-maintenance sources (2004). `IV.MNT.PROD.N` and `IV.MNT.PROD.O` carry 2011 headers and add authorization, change logging (IVMST.LOG), discontinued-number protection and about 12 more fields. `IV.DSP.PROD` (2012) displays DUTY and ENTRY.NO, which only `.N` maintains. The source in this file may therefore be a stale copy and not the cataloged production object. Confirm against the VOC/catalog entry for `IV.MNT.PROD` on the live account before anything here is tagged OBSOLETE or built as-is. See Section 11.

## 1. Purpose — what this program does

An operator uses this green-screen program to look up a product (by product number, UPC or vendor catalog number), change any of about 24 product-master fields, or create a new product. Fields include description, groups, PRO vendor, AP ("actual") vendor, raw cost, PO cost, Price-1/2/3, retail, MAP, surcharge %, rebate %, UPC, catalog number and order quantities. On save it writes the IVMST record and maintains the UPC/catalog-number index (IVCAT). It can also hand off to IV8 (reprice existing member orders after a Price-1 change) and CHANGE.VNORD (move open vendor-order lines after a PRO-vendor change). It does **not** log changes, check user authority, create purchase orders, or maintain stock, receipts or sales history.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master, one record per product number | READ+WRITE |
| IVCAT | Alternate-key index: key = UPC or catalog number, attr 1 = product number | READ+WRITE (WRITEV, DELETE) |
| VNMST | PRO vendor master; used to validate PRO.VEND and show its name | READ |
| APMST | AP (accounts-payable) vendor master; used only to show the ACT.VEND name | READ |
| IGROUPS | Product groups; validates GRP and supplies its description | READ |
| EGROUPS | Web ("E") groups; validates E.GRP and supplies its description | READ |
| GROUPS | Listed by SORT-LABEL when the operator types "?" at GRP. Purpose unclear from this program; it is not the file used for validation (IGROUPS). Confirm | READ (via EXECUTE) |
| CONTROL | Record `PID` attr 1 = next product number | READ+WRITE |
| SCREENS | Records `IV.MNT.PROD` (screen text) and `IV.MNT.PROD.PRMTS` (field names, columns, rows, justification, max lengths) | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `CALL EDIT.LINE` (line 638) | Full-line field input. Pre-fills the current value, returns it unchanged on Enter, clears it if `\` is typed in column 1, and **upper-cases every keystroke** (EDIT.LINE line 23) |
| `CALL MONEY` (lines 453, 501, 513, 525, 560, 572) | Validates and converts money input to integer cents (see rule .14) |
| `CALL DSP.REPORT` (line 291) | Pop-up pick list for groups/vendors |
| `EXECUTE 'RUN IV8'` (line 170) | Reprices every existing member order line for this product (IVORD) and adjusts ARMST open-order totals (attr 17) |
| `EXECUTE 'RUN CHANGE.VNORD'` (line 179) | Moves the product's open vendor-order lines (VNORD) and NUMBER records from the old PRO vendor to the new one |
| `EXECUTE 'SORT-LABEL ...'` (lines 273, 283) | Builds the "?" list of groups/vendors |
| `EXECUTE 'TERM ...'` (lines 271, 274, 281, 284) | Terminal page-size juggling for the list |
| `CHAIN 'ABORT'` (lines 23, 35, 646) | Fatal-error exit |
| `INCLUDE FILE.INCLUDES IVMST.FIELDS` etc. (lines 38–43) | EQU names for attribute positions. **The include file is not in the BP dump**, so attribute numbers in Section 6 are inferred from `D_IVMST` and corroborating programs |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| INP.PROD | 65–117 | main loop (55) |
| INP.OPT | 119–185 | main loop (60) |
| DSP.FLDS | 206–238 | DSP.PROD, every INP.* routine |
| INP.FLDS (dispatcher) | 301–329 | ADD.PROD (192), INP.OPT (131) |
| GET.NEXT.PROD | 642–659 | INP.OPT (135), CALC.UPC (661) |
| CALC.UPC | 660–673 | INP.UPC (584) |

## 4. Business rules — extracted

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.01 | The operator's entry is looked up in the UPC/catalog index (IVCAT) first. If found, the indexed product number is used; otherwise the entry is treated as a product number. A UPC or catalog number that equals another product's number therefore takes precedence over it. | 88–90 | KEEP |
| IV.MNT.PROD.02 | A product number not on file can be created by keying it in only if it is exactly 4 digits and the operator answers "Y" to "add?". Any other unknown entry is rejected. | 91–106 | QUESTION |
| IV.MNT.PROD.03 | "A" or "N" starts a new product as a **copy of the last product shown in this session**, with only UPC and catalog number blanked. If no product has been shown yet, it starts blank and walks the operator through every field. The keyed-number add path (rule .02) copies the same way. | 57–59, 75–86, 101–102, 187–196 | QUESTION |
| IV.MNT.PROD.04 | Product description is mandatory; the field loops until it is non-blank. | 331–339 | KEEP |
| IV.MNT.PROD.05 | Product group (GRP) must exist in IGROUPS; the field loops until a valid group is entered. "?" shows a list. | 354–369 | KEEP |
| IV.MNT.PROD.06 | Web group (E.GRP) must exist in EGROUPS; the field loops until valid. | 379–394 | KEEP |
| IV.MNT.PROD.07 | Sub-group, web description and web-display flag are free text with no validation (the web-display help text says "N" or blank, but any value is stored). `\` clears them. | 340–353, 370–378 | SIMPLIFY |
| IV.MNT.PROD.08 | UPC must not already belong to another product in IVCAT. UPCs and catalog numbers share one key space, so a UPC that equals another product's catalog number is also rejected. The message names the other product. | 578–594 | KEEP |
| IV.MNT.PROD.09 | Catalog number must not already belong to another product in IVCAT (same shared key space as UPCs). | 595–610 | KEEP |
| IV.MNT.PROD.10 | Typing "C" or "CALC" at UPC generates a PRO UPC-A: prefix + product number + a standard mod-10 check digit (odd positions x3 plus even positions, rounded up to the next 10). If the product is still "NEW", a product number is assigned first (rule .25). | 584, 660–673 | KEEP |

### 4.2 Vendor rules (PRO vendor / AP vendor)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.11 | PRO vendor (IVMST attr 5) must exist in VNMST; the field loops until valid. The display shows the VNMST name, or "* MISSING VNMST *" if the stored value has no VNMST record. | 249–253, 395–410 | KEEP |
| IV.MNT.PROD.12 | Actual/AP vendor (IVMST attr 37) **accepts any input**. APMST is read only to show a name (blank if not found). Validation was commented out on 6-17-03 "until vendors are setup" and never restored. | 254–260, 411–428 (commented 421–422) | QUESTION |

QUESTION .12: The business must say whether every product's actual vendor has to be a real AP vendor, and whether it has to agree with the AP vendor linked to the product's PRO vendor (VNMST attr 12 APID). Today nothing enforces either.

### 4.3 Terms, pricing, discounts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.13 | Raw cost (attr 19) accepts three forms: (a) whole number `1234`, stored as typed and displayed as 12.34, so it is effectively cents; (b) `12.34`, converted to cents (1234); (c) whole number + "Y" (e.g. `1500Y`), stored as text with the suffix and displayed as typed: a foreign-currency amount in whole units. Raw cost cannot be blanked (a blank fails the pattern). | 217–219, 429–446 | QUESTION |
| IV.MNT.PROD.14 | PO cost, Price-1, Price-2, Price-3, Retail and MAP are entered through MONEY. `n.nn`, `n.n` and `n.` are converted to integer cents. **A whole number is stored unscaled as cents** (`25` = $0.25) even though the help text says "in dollars". Blank (or `\`) clears the field. Stored with 2 implied decimals (MD2). | 447–458, 495–530, 554–577; MONEY 6–19 | QUESTION |
| IV.MNT.PROD.15 | PO cost (attr 38) is an optional product-level "special cost", separate from raw cost. This program only stores it; IV45 (print PO) uses it **instead of the PO line's cost** whenever it is non-blank (IV45 line 208). | 447–458; cross-ref IV45 208 | QUESTION |
| IV.MNT.PROD.16 | Surcharge % (attr 12) is entered as a whole percent and multiplied by 10 before storing, so it is held in tenths of a percent (MD1: 60 = 6.0%). No numeric validation: non-numeric text is stored as typed. Member cost including surcharge is computed elsewhere as NET.1 x (1000 + PCT) / 1000 (IV8 line 27; D_IVMST COST.1). | 226, 542–553 | SIMPLIFY |
| IV.MNT.PROD.17 | Rebate % (attr unknown, see Section 6) must be a 1–2 digit whole number (0–99). 0 or "-" clears it. Stored as a whole percent, **not** tenths like the surcharge. | 235, 620–634 | QUESTION |
| IV.MNT.PROD.18 | Special-price quantity (attr 7, SP-QTY) must be digits or blank. Its link to Price-2/Price-3 is not in this program. | 531–541 | QUESTION |

QUESTION .13: Is "Y" on raw cost always yen, or a generic foreign-currency flag? Dictionary formulas read it as yen or RMB depending on country of origin (Section 8). Is "whole number = cents" the intended keying convention?
QUESTION .14: Confirm the keying convention for money (digits with implied decimals vs whole dollars). This decides the unit conversion for every legacy price on import and for the PIV2 entry screens.
QUESTION .15: Should a product-level special PO cost silently override the cost on every future PO for that product, and who may set it?
QUESTION .17: What is this rebate % (vendor rebate to PRO? member rebate? instant rebate?), who pays it, and is it per product or per vendor?
QUESTION .18: What does "special price quantity" trigger: Price-2 at or above that quantity, or something else?

### 4.4 Date and quantity rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.19 | PO quantity, case quantity, carton quantity, multiple-order quantity and month's supply are stored as typed. The help says "whole number" but nothing is validated; `\` clears. | 459–494, 611–619 | SIMPLIFY |
| IV.MNT.PROD.20 | On saving an existing product, if Price-1, Price-2 or Price-3 changed, attr 11 (DATE-CHG, multi-valued) is **replaced** with today's date as a single value. On a new product it is set to today. Raw cost, MAP and retail changes do not stamp a date. | 137–142 | QUESTION |
| IV.MNT.PROD.21 | If Price-1 changed, after saving the operator is asked "change existing orders (Y/N)?"; "Y" runs IV8 for this product to reprice open member orders. | 138, 162–174 | KEEP |
| IV.MNT.PROD.22 | Changes to Price-2, Price-3, surcharge %, raw cost, retail or MAP do **not** offer to reprice existing orders, although IV8's order cost includes the surcharge. | 138–140 (only Price-1 sets PRICE.CHG) | QUESTION |
| IV.MNT.PROD.23 | If the PRO vendor changed, after saving the program automatically runs CHANGE.VNORD to move this product's open vendor-order lines (VNORD/NUMBER) from the old PRO vendor to the new one. | 141, 175–181 | KEEP |
| IV.MNT.PROD.24 | Changing the actual/AP vendor (attr 37) triggers no downstream update. | 141 (only PRO.VEND compared) | QUESTION |

QUESTION .20: Should every price type (raw, P1, P2, P3, MAP, retail) keep its own last-changed date? The dictionary expects positions 1–6 of attr 11 (created, P1, P2, P3, raw, MAP), but this program overwrites them all.
QUESTION .22: Should a surcharge or Price-2/3 change also offer to reprice open orders?
QUESTION .24: When the AP vendor of a product changes, should open POs or vendor orders follow?

### 4.5 New product numbering

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.25 | A new product's number is assigned at save time (or when a UPC is calculated) from CONTROL `PID` attr 1. While that number already exists in IVMST it is increased by 7, and the number after the one used (+7) is written back. | 134–136, 642–659, 661 | QUESTION |

QUESTION .25: Why do product numbers step by 7, and must new PIV2 product numbers keep this series (it matters for the UPC prefix scheme, rule .26)?

### 4.6 Product-identifier hard-codes

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.26 | Generated PRO UPCs always start `0291440` followed by the product number. With 4-digit products this gives 11 digits + check digit = 12-digit UPC-A. A 5-digit product number would produce an invalid 13-digit code. | 662 | QUESTION |

QUESTION .26: Confirm `029144` is PRO's GS1 company prefix and how many item numbers remain; confirm that PRO-generated UPCs are only for 4-digit products.

### 4.7 Persistence

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.27 | "U", or just Enter at the command line, saves: the whole IVMST record is written. | 127, 133–143 | KEEP |
| IV.MNT.PROD.28 | After the save, IVCAT is maintained: UPC→product and catalog number→product are written, and the previous UPC/catalog keys are deleted if they changed. | 144–159 | KEEP |
| IV.MNT.PROD.29 | "E" at the command line abandons all field edits for the product without confirmation; edits are held only in memory until "U". | 129, 184 | SIMPLIFY |

### 4.8 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.30 | An existing product is read with an exclusive lock (MATREADU) **with no LOCKED clause**, so a second user waits indefinitely. The lock is released only on the "not on file" paths and is **not released** after a save or "E"; locks build up until the program ends. | 53–61, 91, 98, 104 | QUESTION |
| IV.MNT.PROD.31 | The next-product-number counter (CONTROL PID) is read and rewritten **without a lock**. | 643, 649–653 | SIMPLIFY |

QUESTION .30: Confirm the business expectation when two people edit the same product (block, warn, or last-write-wins).

### 4.9 Authorization

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.32 | No authorization check: anyone able to run the program can change any field, including costs, prices, vendors and UPCs. (The .N/.O variants add a user + authority-code gate; neither variant restricts individual fields.) | 12–63 (no check present) | QUESTION |

QUESTION .32: Who may change costs (raw, PO), sell prices (P1–P3, retail, MAP), vendors and UPCs? Field-level permissions need defining for PIV2.

### 4.10 Error handling

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.33 | The program aborts if any file, screen definition or the CONTROL PID record cannot be read. | 12–36, 643–647 | SIMPLIFY |

### 4.11 Anything else

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.34 | The list of maintainable fields, their order, screen positions and **maximum input lengths** come from SCREENS record `IV.MNT.PROD.PRMTS` (data), not from code. | 31–32, 190, 296–299 | QUESTION |
| IV.MNT.PROD.35 | All input is upper-cased by EDIT.LINE, so descriptions and web descriptions are stored in capitals. | 638; EDIT.LINE 23 | QUESTION |

QUESTION .34: The SCREENS record must be dumped to know the real max lengths (e.g. description, catalog number) before PIV2 column sizes are fixed.
QUESTION .35: Is all-caps description an intended standard, or should PIV2 allow mixed case (the web description in particular)?

Customer-specific exceptions (hard-coded member numbers): N/A — none in this program.
Vendor-specific exceptions (hard-coded vendor numbers): N/A — none in this program (several exist in the D_IVMST dictionary; see Section 8).
Product-group rules (hard-coded group numbers): N/A — none in this program.
Wire format / parsing: N/A — interactive program.

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `0291440` | Other (UPC company prefix) | 662 | Prefix of PRO-generated UPCs | QUESTION |
| `7` | Magic-number | 651, 653 | Step between new product numbers | QUESTION |
| `'4N'` | Threshold | 92 | Only 4-digit product numbers may be added by keying | QUESTION |
| `'PID'` | Other (CONTROL key) | 643, 653 | Next-product-number counter | QUESTION |
| `10` (x10) | Magic-number | 547 | Converts whole % to tenths for surcharge | QUESTION |
| `'1N'`/`'2N'` (max 99) | Threshold | 626 | Rebate % cap | QUESTION |
| `'GROUPS'` | File-path | 360 | File listed for "?" at GRP (validation uses IGROUPS) | QUESTION |
| `'IV.MNT.PROD'`, `'IV.MNT.PROD.PRMTS'` | Other (SCREENS keys) | 31–32 | Screen/field layout records | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### IVMST (read into matrix IVM, DIM 50; copy OIVM)

EQU names come from `FILE.INCLUDES IVMST.FIELDS`, which is **not in the dump**. Attribute numbers are matched by name to `D_IVMST`; "confirmed" means another program addresses the attribute by number.

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 1 | IVMST.SUB.GRP | Sub-group | n/a | Free text |
| 2 or 21 | IVMST.PO.QTY | "PO Quantity" | units | **Unconfirmed.** D_IVMST attr 2 = ORD.QTY (single), attr 21 = PO.QTY/QTY.ORD (multi-valued open-PO quantities). If the EQU is 21, this screen overwrites the open-PO quantity list with one number. Confirm |
| 4 | IVMST.DESC | Description | n/a | Required; upper-cased |
| 5 | IVMST.PRO.VEND | PRO vendor → VNMST | n/a | 3-digit vendor id (D_IVMST 3R) |
| 6 | IVMST.GRP | Product group → IGROUPS | n/a | |
| 7 | IVMST.SP.QTY | Special-price quantity | units | |
| 8 | IVMST.PRICE.1 | Price-1 (D_IVMST NET.1 "COST") — member cost before surcharge | **cents** (MD2) | Confirmed: IV8 reads M(8) |
| 9 | IVMST.PRICE.2 | Price-2 (NET.2) | **cents** (MD2) | |
| 10 | IVMST.PRICE.3 | Price-3 (NET.3) | **cents** (MD2) | |
| 11 | IVMST.DATE | Price-change date(s), multi-valued | Pick date | **Overloaded positions**: D_IVMST reads value 1 = created, 2 = P1 change, 3 = P2, 4 = P3, 5 = raw, 6 = MAP. This program overwrites the whole attribute |
| 12 | IVMST.SCH.PCT | Surcharge % | **tenths of a percent** (MD1) | Confirmed: IV8 M(12) |
| 16 | IVMST.MO.QTY | Multiple-order quantity (MULT) | units | Unvalidated |
| 19 | IVMST.RAW.COST | Raw cost | **cents** (MD2) **or** foreign whole units with "Y" suffix | **Overloaded**: mixed numeric/text with currency flag |
| 27 | IVMST.CASE.QTY | Case pack | units | Unvalidated |
| 29 | IVMST.UPC | Retail UPC | n/a | Indexed in IVCAT |
| 30 | IVMST.CATNO | Vendor catalog number | n/a | Indexed in IVCAT |
| 31 | IVMST.RETAIL | Retail price | **cents** (MD2) | |
| 32 | IVMST.MAP | MAP | **cents** (MD2) | |
| 33 | IVMST.CARTON.QTY | Carton quantity | units | Unvalidated |
| 34 | IVMST.MS / IVMST.MON.SUP | Month's supply | months | Input writes `IVMST.MS`, display reads `IVMST.MON.SUP`; assumed same attr. Confirm |
| 35 | IVMST.WEB.DESC | Web description | n/a | Upper-cased |
| 36 | IVMST.WEB.DISP | Web display flag ("N" = hide?) | n/a | Unvalidated |
| 37 | IVMST.ACT.VEND | Actual/AP vendor → APMST | n/a | Unvalidated free text (D_IVMST 20L) |
| 38 | IVMST.PO.COST | Special PO cost | **cents** (MD2) | Confirmed: .N header comment and IV45 M(38) |
| 39 | IVMST.E.GRP | Web group → EGROUPS | n/a | |
| ? (40 QRB is a candidate) | IVMST.REBATE.PCT | Rebate % | **whole percent** | Unconfirmed attr. Unit differs from surcharge (tenths) |
| 0 | — | Product number | n/a | 4 digits for keyed adds; D_IVMST allows 5 |

All other attributes (stock layers 20–26, sales history 13/17/18/44/45, etc.) are carried through unchanged, or **copied** on "A"/"N" (bug suspect 3). DIM 50 is smaller than the record (attrs up to 69); see bug suspect 14.

### IVCAT (READV/WRITEV attr IVCAT.PROD)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 0 | — | UPC **or** catalog number | n/a | **Overloaded key space**: both identifiers share one key namespace |
| 1 | IVCAT.PROD | Product number | n/a | |

### CONTROL `PID`

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 1 | — | Next product number | n/a | Incremented by 7 |

### VNMST / APMST / IGROUPS / EGROUPS

Only the name/description is read (VNMST.NAME attr 1, APMST.NAME attr 1, IGROUPS.DESC, EGROUPS.DESC); existence is the validation test.

## 7. Bug suspects

1. **Lock wait / silent-fallthrough check (line 91):** `MATREADU` has no LOCKED clause, so on UniVerse the session hangs until the other user releases the record. The ELSE branch means "not found" only, but there is no operator feedback while waiting.
2. **Locks never released after a save or "E" (lines 53–61):** the main loop has no RELEASE, so every product edited stays locked until the program STOPs, blocking other users. (.N adds RELEASE at its line 110.)
3. **New product inherits inventory/history (lines 76, 101):** "A"/"N" and the keyed-number add copy the whole prior record except UPC and catalog number. That includes receipt layers (QTY.REC/AMT.REC/DT.REC), open PO data (PO.NO, QTY.ORD, QTY.BO), member orders (REQ), YTD shipments and sales/profit history, so a new product can appear with stock and history it never had.
4. **Surcharge compounds x10 (line 547):** EDIT.LINE pre-fills the stored value (e.g. 60 = 6.0%); pressing Enter returns 60, which is then multiplied to 600 (60.0%). Every pass through the field, including the full-field walk on add, multiplies the surcharge by 10.
5. **Price-change date history destroyed (lines 138–142):** the multi-valued DATE-CHG attribute is replaced by one date, wiping created/P1/P2/P3/raw/MAP dates that dictionary items (DT.CREATED, PRICE.1.CHG, RAW.CHG, MAP.CHG) read by position.
6. **Product-number race (lines 643–653):** PID is read and written without a lock and the "exists?" check happens before the record is written, so two operators can get the same number. A number is also consumed when "C" is used on a NEW product that is later abandoned (line 661).
7. **"?" list and validation use different files (lines 360 vs 363):** the GRP pick list sorts file `GROUPS`, but validation reads `IGROUPS`.
8. **Display typo (line 242):** `ROW=6` instead of `MROW=6` in DSP.GRP, so the group description prints at the wrong row.
9. **Money entry unit vs help text (MONEY line 19 vs help at 450, 498 etc.):** help says "in dollars as $$$$", but a whole number is stored unscaled as cents (25 → $0.25). Raw cost (line 435) behaves the same way.
10. **Raw cost cannot be cleared (line 435):** blank fails all three patterns and the loop repeats; there is no `\` handling.
11. **IVCAT key swap (lines 144–159):** if the new UPC equals the old catalog number (or vice versa), the later DELETE of the old key removes the index entry just written. The `READV ... ELSE NULL` before each write/delete is an unlocked no-op.
12. **No transactional guard:** IVMST write, up to four IVCAT writes/deletes, IV8 (which updates IVORD and ARMST) and CHANGE.VNORD are separate writes; an abort midway leaves the index or orders inconsistent with the product.
13. **Edits lost if a field value is exactly "U" (line 184):** after a line edit, IP keeps the last typed value; `UNTIL IP='E' OR IP='U'` then exits INP.OPT without MATWRITE. (.N works around this for ORIGIN only.)
14. **DIM IVM(50) vs record of up to 69 attributes (line 26):** overflow attributes are kept in the zero/last element depending on the account flavor. Confirm the account flavor so attrs 50–69 survive the MATWRITE.
15. **Two EQU names for month's supply (lines 234 vs 612–616):** input writes `IVMST.MS`, display reads `IVMST.MON.SUP`. If they differ in the include, entry and display use different attributes. Also, line 612 sets OP instead of OVAL.

## 8. Schema-design notes for the CTO

- **Entities:** Product (IVMST), Product alternate identifiers (IVCAT: UPC and vendor catalog number, sharing one key space today), PRO vendor (VNMST, read), AP vendor (APMST, read), product group and web group (read). Side effects reach member orders (IVORD/ARMST via IV8) and vendor orders (VNORD/NUMBER via CHANGE.VNORD).
- **Two vendor links per product, unreconciled:** attr 5 PRO vendor (validated) and attr 37 actual/AP vendor (free text). The PRO vendor carries its own AP link (VNMST attr 12 APID, maintained by IV2). Nothing checks that product attr 37 equals VNMST(attr 5).APID. The Vendor Desk needs one rule: either derive the AP vendor from the PRO vendor, or store it per product with validation.
- **Overloaded attributes to split:** raw cost (amount + currency flag "Y" in one string) → amount + currency code; DATE-CHG (6 positional dates) → one dated price-history table per price type; IVCAT key (UPC vs catalog number) → separate typed identifiers with their own uniqueness rules.
- **Units to resolve before schema commit:** all prices are integer cents (MD2); surcharge % is tenths (MD1, keyed as whole %); rebate % is whole percent; IV2 keys vendor surcharge directly in tenths; weight (.N) is literal decimal text. Pick one percent representation (decimal) and one money representation (decimal with currency).
- **Price calculations live outside these programs (dictionary I-descriptors in D_IVMST).** They are not rules of this program, but the PO and price sections depend on them, so they need their own extraction:
  - Member cost with surcharge: `COST.1/N1WSC = (PCT+1000)*NET.1/1000` (also NET.2, NET.3); IV8 rounds `INT((1+PCT/1000)*NET.1+.5)`.
  - `SCOST` = surcharged NET.3 if NET.3 ≥ 1, otherwise surcharged NET.1. Price-3 takes precedence when present.
  - Hard-coded vendors: `NETNET` = COST.1 x 92% for VEND 479/497 else 99%; `DNETNET` 88%/99%; `RALNET` 90%/97%; `DATING` = Y for VEND 479/497; `TERMS2` = 0 for vendors 700/992/999/900 else 6; `PTERMS` = 0 for 700/992/900 else 2; `VBRAND` = 2869 when BRAND = 'PROMASTER'.
  - Retail/MAP: `PMCCALC` = MAP x 1.10 unless that is < 1 or ≥ RETAIL x 0.95, then RETAIL x 0.95; `CL.NET` = NET.1 x 1.05; `MCOST.1` = avg cost x 1.07; `MNET.1` = avg cost x 107/101.
  - **Currency:** RAW with "Y" is converted via CONTROL records `YEN`, `YEN.CONV`, `RMB`, `AUS.YEN`, `AUS.RMB`, `AUS.YEN.CONV`, `AUS.RMB.CONV`. `OPEN.VALUE.2`/`USACOST` choose yen when COO = "J" and RMB when COO = "C", so the "Y" suffix means "foreign currency, inferred from country of origin". `USACOST` divides by 0.82 (landed-cost factor?). `YRAW` divides by 1000 for group 19, else 10000.
  - Avg cost = SUM(AMT.REC)/SUM(QTY.REC); on order = SUM(PO.QTY)+SUM(BO.QTY); reorder `QTO` rounds MIN.STK − TOT.AVAIL up to case pack.
- **No cross-field price validation exists** (e.g. MAP ≤ Retail, Price-1 ≥ raw cost, Price-2 ≤ Price-1). Decide which guards PIV2 enforces.
- **Missing audit:** this version logs nothing (no user, no old/new values). .N/.O add IVMST.LOG for screen fields only. PIV2 should audit every price/cost/vendor change, including creation.
- **Missing authorization:** none here. PIV2 needs field-level permissions (cost vs sell price vs vendor link).
- **Sibling programs/artifacts to extract before any Product or Vendor-Desk schema commit:** IV.MNT.PROD.N (likely live), IV8, CHANGE.VNORD, IV45 (PO print; PO.COST override), MONEY, EDIT.LINE, the `FILE.INCLUDES IVMST.FIELDS` include (missing from the dump; needed to pin attribute numbers), SCREENS records `IV.MNT.PROD*.PRMTS` (data), CONTROL records `PID`, `IV.MNT.PROD`, `COO`, `YEN*`, `RMB*`, the D_IVMST I-descriptors, whatever writes DATE-CHG positions 5/6 (raw/MAP change dates) and IVMST.DISC, and any program that writes PRICE.CHANGES / MAP.PRICE.

## 9. Questions for COO/CFO — consolidated

1. Should 5-digit product numbers be creatable, and is manual numbering still needed? (IV.MNT.PROD.02)
2. Should "new product" copy an existing product's attributes, and which fields may be copied? (IV.MNT.PROD.03)
3. Must the actual/AP vendor on a product be a valid AP vendor, and must it match the PRO vendor's AP link? (IV.MNT.PROD.12)
4. Does "Y" on raw cost mean yen only, or any foreign currency? Is whole-number money entry meant to be cents? (IV.MNT.PROD.13)
5. Confirm the money keying convention (implied decimals vs whole dollars). (IV.MNT.PROD.14)
6. Should a product-level special PO cost override every PO line cost, and who sets it? (IV.MNT.PROD.15)
7. What is the product rebate %, who pays it, and is it product- or vendor-level? (IV.MNT.PROD.17)
8. What does the special-price quantity trigger? (IV.MNT.PROD.18)
9. Should each price type keep its own change date and full history? (IV.MNT.PROD.20)
10. Should surcharge or Price-2/Price-3 changes also offer to reprice open orders? (IV.MNT.PROD.22)
11. When a product's AP vendor changes, should open POs/vendor orders move? (IV.MNT.PROD.24)
12. Why the step of 7 in product numbers, and must PIV2 keep it? (IV.MNT.PROD.25)
13. Confirm the UPC prefix 029144 and the remaining capacity. (IV.MNT.PROD.26)
14. Expected behaviour when two users edit the same product? (IV.MNT.PROD.30)
15. Who may change costs, sell prices, vendors and UPCs? (IV.MNT.PROD.32)
16. What are the real max field lengths (SCREENS data)? (IV.MNT.PROD.34)
17. Is upper-case product text an intended standard? (IV.MNT.PROD.35)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 12 | .01, .04, .05, .06, .08, .09, .10, .11, .21, .23, .27, .28 |
| SIMPLIFY | 6 | .07, .16, .19, .29, .31, .33 |
| OBSOLETE | 0 | — |
| OBSOLETE-INTEGRATION | 0 | — |
| QUESTION | 17 | .02, .03, .12, .13, .14, .15, .17, .18, .20, .22, .24, .25, .26, .30, .32, .34, .35 |
| WAREHOUSE-ONLY | 0 | — |

Total: 35 rules (12 + 6 + 17 = 35).

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling (variant) | IV.MNT.PROD.N | 2011 header; adds authority code, IVMST.LOG, IVMST.DISC check, "R"epeat, ~12 fields, PID lock/rollover. **Likely the current production logic.** |
| Sibling (variant) | IV.MNT.PROD.O | Same as .N minus DUTY/ENTRY.NO; reads the same SCREENS keys as this program |
| Sibling (display) | IV.DSP.PROD | Read-only copy of this screen (2004), extended to 2012 |
| Called program | IV8 | Reprices open member orders (IVORD, ARMST attr 17) on Price-1 change |
| Called program | CHANGE.VNORD | Moves VNORD/NUMBER lines on PRO-vendor change; has its own hard-code for group 10 |
| Subroutine | MONEY, EDIT.LINE, DSP.REPORT | Input/conversion helpers |
| Related program | IV45 | Prints POs; uses IVMST attr 38 PO.COST to override the PO line cost |
| Related program | IV2 | Maintains VNMST and the VNMST↔APMST link that this program validates against |
| Shared file | IVMST, IVCAT, VNMST, APMST, IGROUPS, EGROUPS, CONTROL, SCREENS | |
| Include | FILE.INCLUDES IVMST/APMST/VNMST/IGROUPS/EGROUPS/IVCAT.FIELDS | **Not in dump**; required to pin EQU → attribute numbers |
| Domain crossover | Vendors, Orders (member orders, vendor orders), Purchasing (PO cost) | |

**Sibling-series flag:** This is the canonically named member of the IV.MNT.PROD / IV.MNT.PROD.N / IV.MNT.PROD.O series, but its source is the oldest (03/20/2004). The variants are later supersets of it. Treat the canonical source as **possibly stale** until the cataloged object is checked. If the live object turns out to be built from .N, most rules here are superseded by IV.MNT.PROD.N, and the canonical-only behaviours (no authorization, no log, copy-on-add, whole-attribute date stamp) are OBSOLETE candidates.
