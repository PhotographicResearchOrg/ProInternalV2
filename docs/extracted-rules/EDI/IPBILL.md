# IPBILL — Create Imaging EDI Data File for Any Period

**Source program:** `BP/IPBILL`
**Domain:** EDI
**Integration mode:** Outbound-generator
**Lines of code:** 59
**Last code change:** 04/06/2006 (header line 2, jeffn)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This program builds an EDI billing file for "imaging services" over a date range. It reads imaging charge detail records from the `IPBILL` file and groups them into invoices, one per member account and vendor. The vendor on the invoice is translated through the `VENDXREF` cross-reference to an AP vendor number. It writes a flat, positional EDI staging record (`IPBILL 'DATA'`) with a header, detail lines and an `ENDOFINVOICE` terminator per invoice. Invoices are dated today and due in 30 days. It does NOT post to AR or AP, send the file anywhere, or keep a history of what was billed. Who is billed (the member, the imaging vendor, or the vendor on behalf of the member) is not clear from the code.

## 1.5. Integration footprint

**Staging input (for staging-processor):**
- PICK file: `IPBILL` (detail records, any key except `DATA`/`TEMPREC`)
- Record key(s): unknown, likely an imaging job/charge number (the first key of each invoice is printed as the invoice number)
- Content format inside the record: structured multi-attribute record (6 attributes), not a filename-keyed blob
- Delimiter / structure: attribute-per-field (see Section 6)
- External producer (NOT in this zip): unknown. No BP program writes IPBILL detail. Probably an imaging-lab feed or manual import; confirm
- Modern equivalent: imaging charges arrive through the Integration API as canonical billing lines

**Staging output (for outbound-generator):**
- PICK file: `IPBILL`
- Record key written: `'DATA'` (final), `'TEMPREC'` (intermediate)
- Output format: one value per attribute (line-oriented), positional, invoices terminated by the literal `ENDOFINVOICE`
- External consumer: an EDI translator or billing partner picks up `IPBILL DATA` (unknown; confirm)
- Modern equivalent: API outbound call / generated invoice documents from PIV2 billing

Wire format details are in Appendix A.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| `IPBILL` | Imaging billing detail records (input), plus `TEMPREC` and `DATA` output records in the same file | READ+WRITE |
| `VENDXREF` | PRO vendor → AP vendor cross-reference (attr 1 `AVEND`) | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `EXECUTE 'DELETE IPBILL DATA TEMPREC'` | Clears the previous output (line 18) |
| `EXECUTE 'SSELECT IPBILL WITH CDATE GE .. AND WITH CDATE LE .. BY ACCOUNT BY VENDOR'` | Selects and sorts detail (line 19) |

**Internal labeled sections (subroutine-like):**

N/A — the labels 10/15/20/30/40/50 form one inline state machine; none is called from multiple places as a subroutine.

## 4. Business rules — extracted

### Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IPBILL.01 | The operator enters a beginning and ending date. Each must match `0N/0N/0N` (slash-separated). `E`/`END` exits. The range is inclusive on `CDATE`. | 12–17, 19 | SIMPLIFY |
| IPBILL.02 | Detail records in the range are processed sorted by ACCOUNT (member), then VENDOR. | 19 | KEEP |

### Vendor identity

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IPBILL.03 | The vendor on the invoice is `VENDXREF(<detail attr 1>)` attr 1, i.e. the **AP vendor** mapped from the detail's vendor. This is the **only** program in BP that reads VENDXREF, and no BP program writes it. The maintained PRO→AP link (`VNMST` attr 12 `APID`, set by IV2 together with `VNIDX`) is not used. | 25, 37 | QUESTION |
| IPBILL.04 | If a detail's vendor is missing from VENDXREF, the program prints "VENDOR NOT ON FILE" and **ends the whole run**. The previous DATA/TEMPREC have already been deleted, and no new output is written. | 18, 25, 58 | QUESTION |

IPBILL.03: The business must say whether VENDXREF is still maintained and authoritative, or whether it should be replaced by VNMST.APID. The two can disagree and nothing keeps them in sync.
IPBILL.04: The business must say whether one unmapped vendor should stop the entire billing run or only skip or flag that line.

### Customer / grouping rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IPBILL.05 | The member number is the first 4 characters of detail attr 2. | 26 | QUESTION |
| IPBILL.06 | A new invoice starts whenever the member changes, or the mapped AP vendor changes, from the previous detail. | 27–29 | KEEP |

IPBILL.05: The business must say whether member numbers are always 4 characters, and what the rest of attr 2 holds.

### Terms, dates, amounts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IPBILL.07 | Invoice date = today, and due date = today + **30** days (hard-coded net 30). | 9, 39, 42 | QUESTION |
| IPBILL.08 | Header position 6 is always the literal **7**. | 41 | QUESTION |
| IPBILL.09 | The invoice number (header position 4) is the IPBILL key of the first detail record in the invoice. | 40 | QUESTION |
| IPBILL.10 | Every detail line has quantity **1** (literal). The amount is detail attr 6, the description detail attr 3, plus a note `DATE: <attr 4> SHIPPED: <attr 5>`. | 31–34 | QUESTION |
| IPBILL.11 | The invoice total (header position 8) is the running sum of detail attr 6, re-formatted to 2 decimals after each line. The amounts are treated as **dollars with decimals** (`OCONV(x*100,'MR2')`). | 32 | SIMPLIFY |

IPBILL.07: The business must confirm net-30 terms for imaging billing, and whether they vary by member or vendor.
IPBILL.08: The business must explain what the constant 7 in header position 6 means (document type? terms code? store?).
IPBILL.09: The business must confirm that using the first charge's record key as the invoice number is acceptable, or say whether a real invoice-number sequence is needed.
IPBILL.10: The business must say whether imaging charges are always quantity 1, and what "DATE" vs "SHIPPED" mean.

### Wire format / parsing

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IPBILL.12 | Positional invoice layout: header positions 1–8 (1 vendor, 2 member, 3 invoice date, 4 invoice no, 5 blank, 6 `7`, 7 due date, 8 total, 9 blank), detail lines of 4 values starting at position 10, and invoice terminated by `ENDOFINVOICE`. | 20–44 | OBSOLETE-INTEGRATION |
| IPBILL.13 | Two-phase write: invoices are built in matrix DATA (one attribute per invoice) and saved as `IPBILL 'TEMPREC'`, then re-read and flattened into `IPBILL 'DATA'` with one attribute per value. | 45–57 | OBSOLETE-INTEGRATION |
| IPBILL.14 | The previous `DATA` and `TEMPREC` are deleted at the start of every run, so only the latest run's file exists. | 18 | OBSOLETE-INTEGRATION |
| IPBILL.15 | Capacity limits: at most 999 invoices per run (DIM DATA(999)) and 999 values per invoice in the flatten loop. | 6, 49 | OBSOLETE-INTEGRATION |

### Error handling / call-Computyme prompts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IPBILL.16 | If IPBILL or VENDXREF fails to open, a message is printed but the program continues. | 4–5 | SIMPLIFY |
| IPBILL.17 | An unreadable detail record is reported ("CANNOT READ") and skipped. | 24 | SIMPLIFY |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `30` (days) | Threshold | 9 | Due date = today + 30 | QUESTION |
| `7` | Magic-number | 41 | Header position 6 constant | QUESTION |
| `1` | Magic-number | 31 | Detail quantity always 1 | QUESTION |
| `[1,4]` member length | Magic-number | 26 | Member = first 4 chars of attr 2 | QUESTION |
| `"ENDOFINVOICE"` | Other (wire token) | 9, 23, 28–29, 51 | Invoice terminator | QUESTION |
| `'DATA'`, `'TEMPREC'` | Other (record keys) | 18, 45, 47, 51–52 | Output staging keys | QUESTION |
| `999` | Threshold | 6, 49 | Max invoices / values per invoice | QUESTION |

No customer-specific or vendor-specific identifiers found (no hard-coded member or vendor numbers).

## 6. Data shape — record layouts referenced

There is no `D_IPBILL` in BP. Names below come from the SSELECT clause and from usage. **Confirm all of them.**

### IPBILL detail (read into matrix TREC, DIM 6)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 1 | (VENDOR?) | Vendor key looked up in VENDXREF | — | Presumably a PRO vendor (VNMST) number, since VENDXREF is "PRO vendor → AP vendor". Confirm. The sort uses dictionary item VENDOR (position unknown) |
| 2 | (ACCOUNT?) | Member; first 4 chars used | — | Field 2: purpose of the remaining characters is unclear, confirm |
| 3 | — | Line description | — | |
| 4 | (CDATE?) | Printed as "DATE:" | unknown (printed raw) | If CDATE is internal, it prints as a day number. Confirm |
| 5 | — | Printed as "SHIPPED:" | unknown | Confirm |
| 6 | — | Line amount | **dollars** (decimal), inferred from `*100 MR2` | Confirm. If stored in cents, totals would be 100× wrong |

### VENDXREF

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 0 | key | PRO vendor | — | Per dictionary description |
| 1 | AVEND | AP vendor | — | Written to header position 1 |

### IPBILL 'DATA' (output) — see Appendix A

## 7. Bug suspects

- **One bad vendor kills the run (lines 18, 25):** the old DATA/TEMPREC are deleted first. Then a single VENDXREF miss jumps to `100 END`, so no file is produced and only a one-line message is shown.
- **Message contradicts the test (lines 14, 17):** the pattern requires `MM/DD/YY` (slashes), but the error says "use MM.DD.YY FORMAT".
- **Open failures not fatal (lines 4–5):** the program continues with unopened file variables, which causes a run-time abort later.
- **Sort and break keys differ (lines 19, 27–29):** records are sorted by the raw IPBILL VENDOR, but invoices break on the *mapped* AP vendor. Two raw vendors that map to the same AP vendor but are not adjacent produce several invoices for one member and vendor.
- **Capacity overflow (lines 6, 49):** more than 999 invoices overflows `DATA(999)` (run-time error). An invoice with more than 999 values is truncated without its `ENDOFINVOICE`, which merges it into the next invoice in the output.
- **Running total recomputed from a formatted string (line 32):** the total is re-formatted with MR2 after every line, so rounding is applied cumulatively.
- **Misleading message (line 47):** "CANNOT OPEN TEMPREC" is shown for a failed read.
- **No billed-flag:** detail records are not marked as billed, so overlapping date ranges re-bill the same charges.

## 8. Schema-design notes for the CTO

- Entities: **ImagingCharge** (input line), **ImagingInvoice** (member × vendor), **VendorCrossReference** (VENDXREF).
- **Vendor identity conflict:** VENDXREF (PRO→AP) duplicates VNMST attr 12 APID (and VNIDX), and BP has no maintenance program for VENDXREF. The Vendor Desk should keep one authoritative PRO-vendor → AP-vendor link and retire VENDXREF.
- Missing audit: billed flag or date per charge, invoice number sequence, who ran the billing.
- Units: confirm whether the IPBILL amount (attr 6) is dollars or cents. Everything else in the AP files is cents.
- Terms (net 30) and the header constant 7 should become configuration, not code.
- Before any schema commit: find the producer of the IPBILL detail records and the consumer of `IPBILL DATA` (both outside BP).

## 9. Questions for COO/CFO — consolidated

1. Is VENDXREF still maintained, and should it be replaced by the vendor master's AP link? (relates to IPBILL.03)
2. Should an unmapped vendor stop the whole billing run or only flag that charge? (relates to IPBILL.04)
3. Are member numbers always 4 characters on imaging charges? (relates to IPBILL.05)
4. Are imaging invoices always net 30? (relates to IPBILL.07)
5. What does the constant 7 in the invoice header mean? (relates to IPBILL.08)
6. Is the first charge's key acceptable as the invoice number? (relates to IPBILL.09)
7. Are imaging charges always quantity 1, and what do the "DATE" and "SHIPPED" fields mean? (relates to IPBILL.10)
8. Who is the billed party (the member, or the vendor) and who receives this EDI file? Is imaging billing still active? (relates to IPBILL.03, .06)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 2 | IPBILL.02, .06 |
| SIMPLIFY | 4 | IPBILL.01, .11, .16, .17 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 4 | IPBILL.12, .13, .14, .15 |
| QUESTION | 7 | IPBILL.03, .04, .05, .07, .08, .09, .10 |
| WAREHOUSE-ONLY | 0 | |

Total: 17 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Shared file | `VENDXREF` | Used only by IPBILL in BP; no writer found |
| Related file | `VNMST` attr 12 `APID` / `VNIDX` | The maintained PRO→AP link (written by IV2); not used here |
| Related program | `IV2` | VNMST maintenance; requires the APMST vendor to exist first and writes APID to VNMST(12) and both directions to VNIDX |
| Shared file | `IPBILL` | No other BP program reads or writes it |

**Sibling-series flag:** no series. Standalone; canonical.

## Appendix A — Wire format

- **Character encoding:** ASCII (UniVerse record), unknown downstream
- **Line terminator:** UniVerse attribute mark (@FM, CHAR(254)) between values. One "line" = one attribute of record `IPBILL DATA`. Converted to CRLF/LF by whatever exports the record (confirm)
- **Field delimiter:** none. Positional, one value per line
- **Field count per record:** variable. Header 9 positions + 4 per detail line + terminator
- **Field-by-field list (per invoice, positions relative to the invoice start):**

| Position | Name | Type | Example | Notes |
|---|---|---|---|---|
| 1 | Vendor | string | `<AP vendor no.>` | AP vendor from VENDXREF |
| 2 | Member | string(4) | `1234` | First 4 chars of IPBILL attr 2 |
| 3 | Invoice date | `MM/DD/YY` | `04/06/06` | Today, `OCONV(DATE(),'D2/')` |
| 4 | Invoice number | string | IPBILL key | First detail key of the group |
| 5 | (blank) | — | `` | Always empty |
| 6 | Constant | int | `7` | Meaning unknown |
| 7 | Due date | `MM/DD/YY` | `05/06/06` | Today + 30 |
| 8 | Invoice total | decimal 2dp | `125.00` | Running sum of detail amounts |
| 9 | (blank) | — | `` | Always empty |
| 10 + 4k | Quantity | int | `1` | Always 1 |
| 11 + 4k | Amount | decimal (raw) | `25.00` | IPBILL attr 6 unformatted |
| 12 + 4k | Description | string | | IPBILL attr 3 |
| 13 + 4k | Note | string | `DATE: x SHIPPED: y` | IPBILL attrs 4 and 5, raw |
| last | Terminator | literal | `ENDOFINVOICE` | Ends each invoice |

- **Escape rules:** none. Embedded attribute/value marks in source fields would corrupt the layout
- **Header lines:** none at file level. Each invoice starts directly after the previous `ENDOFINVOICE`
- **Trailer:** none at file level. The last invoice ends with `ENDOFINVOICE`
- **Intermediate record `TEMPREC`:** one attribute per invoice, values = positions above. Same content, used only to flatten
