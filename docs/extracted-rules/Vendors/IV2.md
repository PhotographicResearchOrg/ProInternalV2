# IV2 — New vendor (input or correct a PRO vendor)

**Source program:** `BP/IV2`
**Domain:** Vendors
**Integration mode:** Interactive
**Lines of code:** 191
**Last code change:** 11/26/2001 (header line 2; last change-log entry "11-26-01 - SJL Re Dim T frm 15 to 20")
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

The operator creates a new **PRO vendor** (VNMST, the buying-group "vendor" that products point to via IVMST attr 5) or corrects an existing one. A new PRO vendor must be attached to an existing **AP vendor** (APMST). Its name, address and phone are copied from APMST, and a two-way cross-reference (VNIDX) is written so each PRO vendor maps to exactly one AP vendor and vice versa. The operator also sets the vendor's surcharge %, how the surcharge is collected (rebated by the vendor or added to the vendor invoice), and whether the vendor guarantees member billing. It does **not** maintain AP data, vendor terms, YTD sales/surcharge totals or anything on products.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| VNMST | PRO vendor master | READ+WRITE |
| APMST | AP vendor master; must exist before a PRO vendor; source of name/address/phone | READ |
| VNIDX | Two-way cross-reference. Key = PRO vendor id → attr 1 = AP vendor id; key = AP vendor id → attr 1 = PRO vendor id. One shared key space | READ+WRITE |
| CONTROL | Record `VEND` attr 1 = next PRO vendor number | READ+WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `CHAIN 'ABORT'` (13–16, 32) | Fatal exit when a file or the CONTROL record cannot be opened/read |

No CALLs or EXECUTEs. The program uses numbered GOTO labels rather than GOSUB subroutines.

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| 5 (display current vendor) | 45–63 | 70 (new), 185 (redisplay) |
| 90 (change menu) | 181–187 | after each field when TYPE = 2 |
| 85 (save) | 172–180 | 187 (Enter on the change menu), new-vendor confirmation at 171 |

## 4. Business rules — extracted

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV2.01 | The operator chooses 1 = new vendor or 2 = change (Enter defaults to change); "E" exits. | 28–31 | SIMPLIFY |
| IV2.02 | A new PRO vendor's number is taken from CONTROL `VEND` attr 1. After the save the counter is set to that number **+3**, so PRO vendor numbers step by 3. | 32, 177 | QUESTION |
| IV2.04 | If the new number already exists in VNMST (name non-blank), the program shows "CONTROL ERROR <id> IN USE" and **stops** instead of skipping to the next number. | 37–38 | SIMPLIFY |
| IV2.05 | To change a vendor, the vendor number must exist (name non-blank); otherwise "NOT ON FILE" and re-prompt. Enter reuses the last vendor number worked on. | 34–43 | KEEP |
| IV2.10 | Name is required, 1–25 characters. | 72–78 | KEEP |
| IV2.11 | Name-2 is optional, at most 25 characters; "-" clears it. | 79–88 | KEEP |
| IV2.12 | Street (1–25 chars) and city/state (1–22 chars, one free-text field) are required. The "-" erase the screen promises cannot work, because the blank then fails the length check. | 89–106 | SIMPLIFY |
| IV2.13 | ZIP must be exactly 5 digits (no ZIP+4, no non-US postal codes). | 107–116 | QUESTION |
| IV2.14 | Phone must be in the form NNN-NNN-NNNN (no international numbers). | 117–126 | QUESTION |

QUESTION IV2.02: Why do vendor numbers step by 3, and must PIV2 keep the 3-digit VNMST numbering? Several programs assume a 3-character vendor id (VNIDX length test; VNORD key = vendor id + 7 chars in CHANGE.VNORD).
QUESTION IV2.13 / IV2.14: PRO has many international vendors. Their addresses and phones cannot be entered correctly here, so how are they recorded today?

### 4.2 Vendor ↔ AP vendor link

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV2.06 | A new PRO vendor can only be created against an AP vendor that already exists in APMST: "VENDOR MUST BE SETUP IN APMST FIRST". | 65–67 | KEEP |
| IV2.07 | An AP vendor may be linked to only one PRO vendor. If VNIDX already holds the AP id, it is rejected as "used by another APMST vendor". | 70–71 | KEEP |
| IV2.08 | On creation, the PRO vendor's name, name-2, street, city/state, ZIP and phone are copied from APMST attrs 1, 3, 4, 5, 6, 7. The program then jumps straight to the surcharge fields, so the copied address is not reviewed unless the operator backs up with "-". | 53, 68–70 | KEEP |
| IV2.09 | The AP link is set only at creation; IV2 has no way to change it. On every save of a change, VNMST attr 12 (APID) is rewritten from VNIDX. | 44, 172, 187 | QUESTION |

QUESTION IV2.09: When a vendor changes its AP entity (new remit-to company, acquisition), how is the PRO vendor relinked today, and should PIV2 allow relinking with history?

### 4.3 Terms, pricing, discounts (surcharge and billing)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV2.15 | Vendor surcharge % is entered as an integer in **tenths of a percent** (60 = 6.0%). The operator must confirm "Verify PCT = <value/10>". Decimal entry is rejected. | 127–138 | SIMPLIFY |
| IV2.16 | If the surcharge % is not 0, a surcharge type is required: 1 = surcharge is rebated by the vendor; 2 = surcharge is added to the vendor invoice. Any value other than 1 is displayed as "added to vendor invoice". | 54–58, 139–151 | KEEP |
| IV2.17 | Billing-guarantee flag: 0 = no guarantee, 1 = vendor guarantees member billing (the comment calls it CR.STAT). Blank or below 1 displays as "NO GUARANTEE". | 59–62, 153–165 | QUESTION |

QUESTION IV2.16: Confirm the two surcharge collection methods still apply and how each flows to member invoices and vendor payments. The vendor surcharge (VNMST attr 8) and the product surcharge (IVMST attr 12) are kept separately: which wins?
QUESTION IV2.17: What does "vendor guarantees member billing" change downstream (credit hold bypass, AR risk, direct-bill handling)?

### 4.4 Vendor-specific exceptions (hard-coded vendor numbers)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV2.03 | When the next vendor number is 272, 713, 839, 902 or 965, 3 is added once (the result is not re-checked) and that number is used instead. | 12, 33 | QUESTION |

QUESTION IV2.03: Why are 272, 713, 839, 902 and 965 forbidden as PRO vendor numbers (reserved for special accounts? collide with other files?), and must they stay reserved in PIV2?

### 4.5 Persistence

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV2.18 | A new vendor is saved only after the final "Press RETURN to UPDATE or C to CANCEL" confirmation. | 167–171 | KEEP |
| IV2.19 | On save, the full VNMST record is written with attr 12 = AP id. For a new vendor, VNIDX is also written both ways (PRO id → AP id and AP id → PRO id) and the CONTROL counter is advanced. | 172–178 | KEEP |
| IV2.20 | Change mode: the operator picks line 1–9 to edit, "R" to redisplay, Enter (or 0) to save; "E"/"Q" abandons with "ALL ADDITIONS OR CHANGES IGNORED". | 181–190 | SIMPLIFY |
| IV2.24 | IV2 maintains only VNMST attrs 1–6, 8, 11, 12 and 13. Attrs 7 (YTD sales), 9 (surcharges), 10 (prior year), 14 (SPCDED), 15 (ADMDAYS/PRO terms), 16 (SPC.PCT), 17 (FTR), 18 (VND.TERMS) and 19 (APADJ) are carried through unchanged; some other program maintains them. | 17, 37, 173 | QUESTION |

QUESTION IV2.24: Which program and which people maintain vendor terms, admin days, special %, FTR and AP adjustments? These are core Vendor Desk fields.

### 4.6 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV2.21 | The vendor record is read with an exclusive lock (MATREADU) with **no LOCKED clause** (a second user waits). A missing record is silently treated as empty. The lock is released on abandon (189) and by the MATWRITE on save, but **not** when the operator types "-" at Name (74) or when "NOT ON FILE" re-prompts are skipped. | 37, 41, 74, 173, 189 | QUESTION |
| IV2.22 | The vendor-number counter (CONTROL VEND) is read without a lock and written back only after the vendor record is saved. | 32, 177 | SIMPLIFY |

QUESTION IV2.21: Expected behaviour when two people edit the same vendor?

### 4.7 Authorization

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV2.23 | There is no authorization check: anyone who can run IV2 can create PRO vendors and change their surcharge %, surcharge method and billing guarantee. | 12–31 (no check present) | QUESTION |

QUESTION IV2.23: Who may create vendors and change surcharge terms? These directly change what members are charged.

Customer-specific exceptions (hard-coded member numbers): N/A — none.
Product-group rules: N/A — none.
Wire format / parsing: N/A — interactive.
Error handling / call-Computyme prompts: covered by IV2.04 (CONTROL ERROR stop) and IV2.06; files that cannot be opened abort (13–16).

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `272`, `713`, `839`, `902`, `965` | Vendor# | 12, 33 | PRO vendor numbers never to be assigned | QUESTION |
| `3` | Magic-number | 33, 177 | Step between PRO vendor numbers / bad-number skip | QUESTION |
| `118` | Vendor# | comment only, line 9 ("RESET VENDOR NUMBER TO 118") | Historical counter reset; not in code | QUESTION |
| `'VEND'` (CONTROL key) | Other | 32, 177 | Next vendor number | QUESTION |
| `25` / `22` | Threshold | 76, 80, 96, 105 | Max lengths of name/name2/street and city-state | QUESTION |
| `'5N'` | Threshold | 114 | US-only ZIP format | QUESTION |
| `'3N-3N-4N'` | Threshold | 124 | US-only phone format | QUESTION |
| `/10` | Magic-number | 135 | Surcharge stored in tenths of a percent | QUESTION |
| `1` / `2` | Other | 150 | Surcharge type codes (rebated / added to invoice) | QUESTION |
| `0` / `1` | Other | 164 | Billing-guarantee flag | QUESTION |

## 6. Data shape — record layouts referenced

### VNMST (read into matrix T, DIM 20) — PRO vendor

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 0 | — | PRO vendor number | n/a | 3 digits in practice (D_VNMST 3R); step 3 |
| 1 | (T(1)) NAME | Name; non-blank = "record exists" | n/a | ≤25. **Overloaded** as the existence test |
| 2 | NAME2 | Name line 2 | n/a | ≤25 |
| 3 | STREET | Street | n/a | ≤25 |
| 4 | CITY.STATE | City + state in one field | n/a | ≤22. Should be split |
| 5 | ZIP | ZIP | n/a | 5 digits only |
| 6 | CODE ("TP") | Surcharge type: 1 = rebated by vendor, 2 = added to vendor invoice | n/a | Dictionary name "CODE" does not reveal its meaning |
| 7 | YTD.SALES | Not maintained here | **cents** (MD02Z) | Carried through |
| 8 | PCT | Vendor surcharge % | **tenths of a percent** (MD1) | Keyed directly in tenths (IV.MNT.PROD keys the product surcharge as whole % ×10). **Entry-unit inconsistency** |
| 9 | SURCHARGES | Not maintained here | **cents** (MD2Z) | Carried through |
| 10 | PREV.YR | Not maintained here | unknown — confirm (D_VNMST MD0Z: whole dollars?) | Carried through. **Unit differs from attr 7** |
| 11 | PHONE | Phone NNN-NNN-NNNN | n/a | |
| 12 | APID | Linked AP vendor (→ APMST) | n/a | Rewritten from VNIDX on every save |
| 13 | F13 | Billing guarantee 0/1 | n/a | Unnamed in the dictionary |
| 14–19 | SPCDED, ADMDAYS/PRO.TERMS (MV), SPC.PCT, FTR, VND.TERMS, APADJ | Not maintained here | unknown — confirm | Carried through |

### APMST (READ into APVEND) — AP vendor

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 1 | NAME | Copied to VNMST 1 | n/a | ≤30 in APMST vs ≤25 in VNMST: may be longer than VNMST allows (not truncated on copy) |
| 3 | NAME2 | Copied to VNMST 2 | n/a | |
| 4 | STREET | Copied to VNMST 3 | n/a | |
| 5 | CITY.ST | Copied to VNMST 4 | n/a | |
| 6 | ZIP | Copied to VNMST 5 | n/a | |
| 7 | PHONE | Copied to VNMST 11 | n/a | |

### VNIDX — PRO vendor ↔ AP vendor cross-reference

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 0 | — | **Either** a PRO vendor id **or** an AP vendor id | n/a | **Overloaded key space.** D_VNIDX tells them apart by length only (3 chars = VNMST, >3 = APMST) |
| 1 | CROSSREF | The other side's id | n/a | |

### CONTROL `VEND`

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 1 | — | Next PRO vendor number | n/a | Incremented by 3 |

## 7. Bug suspects

1. **Silent fallthrough / lock wait (line 37):** `MATREADU T FROM VNMST, ID ELSE MAT T=''` has no LOCKED clause, so the session blocks if another user holds the vendor. "Not found" becomes an empty record, and existence is then inferred only from a non-blank name (lines 38, 40).
2. **AP link wiped on change (lines 44, 172):** in change mode APID is read from VNIDX (`ELSE APID=''`) and written to VNMST attr 12 on save. If the VNIDX entry is missing, saving any correction **blanks the PRO vendor's AP link**.
3. **Lock leaked on "-" at Name (line 74):** "-" jumps to the mode prompt (label 2) without RELEASE; the vendor stays locked for the session. In change mode "-" also abandons the edit instead of erasing, contrary to on-screen note 1 (line 23).
4. **Shared VNIDX key space (lines 70, 175–176):** PRO and AP ids live in one key space, separated only by id length. An AP id that equals an existing PRO vendor id is rejected as "used by another APMST vendor" (and the message prints a PRO id). If PRO vendor numbers reach 4 digits, the two id sets collide.
5. **Bad-number list semantics (line 33):** `ID MATCHES BADNUMBS` uses bare numbers as MATCHES patterns. Confirm UniVerse treats `272` as a literal rather than a pattern code. The +3 result is not re-checked against the list or VNMST.
6. **Counter not advanced on collision (line 38):** "CONTROL ERROR … IN USE" stops the program without moving CONTROL VEND, so every later "new vendor" hits the same error until someone edits CONTROL by hand.
7. **Erase impossible (lines 91–96, 100–105, 109–114):** "-" clears street/city/ZIP, and the field then fails its length/pattern check. ZIP fails with no error message (line 114 has no CRT), so the prompt just repeats.
8. **Stale surcharge type (line 139):** setting the surcharge to 0 skips the type question but keeps the old type, which is still displayed (lines 55–58).
9. **Blank surcharge accepted (line 134):** `NUM('')` is true, so a blank passes, and the verify prompt shows "PCT=0".
10. **No transactional guard (lines 173–177):** VNMST write, two VNIDX writes and the CONTROL write are separate. A failure midway leaves a PRO vendor without a cross-reference, or an AP id pointing nowhere, and the counter unadvanced (next run → bug 6).
11. **Unlocked counter (lines 32, 177):** two people creating vendors at once read the same number. The second blocks on the record lock and then hits bug 6.
12. **Name length mismatch on copy (line 68):** an APMST name up to 30 characters is copied into a 25-character VNMST name without truncation or validation (validation applies only if the operator edits the name).

## 8. Schema-design notes for the CTO

- **Entities:** PRO vendor (VNMST), AP vendor (APMST, read), PRO↔AP cross-reference (VNIDX + VNMST attr 12, stored twice), vendor-number counter (CONTROL VEND).
- **Vendor model for the Vendor Desk:** today there are two vendor identities. The **AP vendor** (payee / legal entity, APMST, 4-digit ids) comes first; the **PRO vendor** (buying-group vendor that products, surcharges and vendor orders hang off, VNMST, 3-digit ids) is attached 1:1. Products carry *both* (IVMST attr 5 = PRO vendor, validated; attr 37 = AP vendor, unvalidated; see IV.MNT.PROD.12), so the product-level AP vendor can contradict this 1:1 link. Decide in PIV2 whether the AP vendor is derived (product → PRO vendor → AP vendor) or stored per product.
- **Redundant link storage:** VNMST attr 12 and VNIDX hold the same relationship in three places. Keep one foreign key (PRO vendor → AP vendor) with a uniqueness constraint.
- **Overloaded / to split:** VNIDX key space (two id types); VNMST attr 1 used as the existence flag; attr 4 city + state in one field; attr 6 unnamed surcharge type; attr 13 unnamed billing guarantee.
- **Units:** surcharge % in tenths (attr 8). YTD sales and surcharges are in cents (MD2), but prior-year is MD0 (apparently whole dollars): **unit inconsistency inside VNMST**. Normalise percent and money before schema commit.
- **International:** US-only ZIP and phone formats, 25-character address lines and a combined city/state field cannot hold PRO's international vendors. The Vendor Desk needs country, region, postal code and E.164 phone.
- **Missing audit:** no record of who created or changed a vendor, surcharge % or billing guarantee. Surcharge changes affect member charges, so PIV2 must audit them with effective dates.
- **Missing authorization:** none; needs role-based create/edit rights, with surcharge/billing-guarantee changes restricted.
- **Sibling programs to extract before the Vendor Desk / vendor-contract schema commit:** the AP vendor maintenance program(s) that write APMST (terms PCT/DUE.DAYS, payment address, rep contacts, emails); the program(s) maintaining VNMST attrs 14–19 (terms, admin days, special %, FTR, APADJ); whatever posts YTD sales/surcharges (attrs 7, 9, 10); CHANGE.VNORD and VNORD/NUMBER programs (3-char vendor-id key assumption); any program that reads VNMST attr 6/13 (surcharge invoicing and billing guarantee); and the VENDXREF file (PRO vendor → AP vendor cross reference) listed in the decoded dictionary, which may be a second, competing copy of the VNIDX link.

## 9. Questions for COO/CFO — consolidated

1. Must PRO vendor numbers keep stepping by 3, as 3-digit ids? (IV2.02)
2. Why are vendor numbers 272, 713, 839, 902 and 965 reserved? (IV2.03)
3. How are international vendor addresses and phones recorded today? (IV2.13, IV2.14)
4. How is a PRO vendor relinked when its AP entity changes, and should PIV2 support that with history? (IV2.09)
5. Do both surcharge methods ("rebated by vendor" vs "added to vendor invoice") still apply? Which surcharge wins, vendor (VNMST) or product (IVMST)? (IV2.16)
6. What does "vendor guarantees member billing" change downstream? (IV2.17)
7. Who maintains vendor terms, admin days, special %, FTR and AP adjustments, and where? (IV2.24)
8. Expected behaviour when two people edit the same vendor? (IV2.21)
9. Who may create vendors and change surcharge/billing terms? (IV2.23)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 9 | IV2.05, IV2.06, IV2.07, IV2.08, IV2.10, IV2.11, IV2.16, IV2.18, IV2.19 |
| SIMPLIFY | 6 | IV2.01, IV2.04, IV2.12, IV2.15, IV2.20, IV2.22 |
| OBSOLETE | 0 | — |
| OBSOLETE-INTEGRATION | 0 | — |
| QUESTION | 9 | IV2.02, IV2.03, IV2.09, IV2.13, IV2.14, IV2.17, IV2.21, IV2.23, IV2.24 |
| WAREHOUSE-ONLY | 0 | — |

Total: 24 rules (9 + 6 + 9 = 24).

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Consumer | IV.MNT.PROD / .N / .O | Validate IVMST attr 5 against VNMST and show VNMST names |
| Consumer | CHANGE.VNORD | Builds VNORD keys as 3-char PRO vendor id + suffix |
| Shared file | VNMST | Products (IVMST attr 5), vendor orders (VNORD), surcharge reporting (IVEND/BVEND per decoded dictionary) |
| Shared file | APMST | AP subsystem; IVMST attr 37; IV.MNT.PROD.N numbering avoids APMST ids |
| Shared file | VNIDX | Only writer found so far is IV2 |
| Related file | VENDXREF | "PRO vendor to AP vendor cross reference" (decoded dictionary): possible duplicate of the VNIDX link; extract its writer |
| Shared file | CONTROL (VEND) | |
| Domain crossover | AP, Products, Orders (vendor orders), Member billing (surcharge, billing guarantee) | |

**Sibling-series flag:** IV2 sits in the numbered IV series (IV2, IV8, IV45 …). The numbers are unrelated programs, not variants. No IV2.* variants found; this appears to be the canonical (only) PRO-vendor maintenance program.
