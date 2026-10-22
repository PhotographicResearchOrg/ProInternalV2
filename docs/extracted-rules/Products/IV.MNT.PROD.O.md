# IV.MNT.PROD.O — Product maintenance (variant ".O": snapshot of .N without duty/entry number)

**Source program:** `BP/IV.MNT.PROD.O`
**Domain:** Products
**Integration mode:** Test-variant
**Lines of code:** 1088
**Last code change:** 2 June 2011 (header line 2; same header as IV.MNT.PROD.N)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

> **Scope of this extraction:** only behaviour that differs from `IV.MNT.PROD`. A `diff` against `IV.MNT.PROD.N` shows this file is **identical to .N except**: (1) it reads the canonical SCREENS records `IV.MNT.PROD` / `IV.MNT.PROD.PRMTS` instead of the `.N` ones (lines 52–53); (2) it has no DUTY or ENTRY.NO field (no display, input or dispatch code); (3) clear-screen column offsets differ (lines 94–96). Every other rule is the IV.MNT.PROD.N rule with lines shifted. Rules below therefore state the .N equivalent and give **this file's** line numbers; read the full reasoning, bug analysis and questions in `Products/IV.MNT.PROD.N.md`.
>
> **Mode caveat:** this is most likely the version from just before DUTY/ENTRY.NO were added to .N (≈2011–2012). Because it reads the *canonical* SCREENS keys, it could equally be the source that was compiled as `IV.MNT.PROD`. Confirm via the VOC/catalog. If it is not the cataloged object, the whole program is a candidate for OBSOLETE without further work.

## 1. Purpose — what this program does

Same as IV.MNT.PROD.N: product lookup and maintenance with an authority-code gate, IVMST.LOG change logging, discontinued-number protection, "R"epeat, and the extended fields (brand, delete status, warehouse rebate/IPI, discard, do-not-ship, weight, dimensions, country of origin, HS code). It does **not** maintain duty or customs entry number.

## 1.5. Integration footprint

N/A — interactive (test-variant).

## 2. Files (tables) read or written

Identical to IV.MNT.PROD.N (IVMST, IVMST.DISC, IVMST.LOG, APMST, VNMST, IGROUPS, EGROUPS, IVCAT, CONTROL, SCREENS), except SCREENS keys `IV.MNT.PROD` and `IV.MNT.PROD.PRMTS` are read. Those are the same records the canonical IV.MNT.PROD reads, so the canonical and .O programs **share one screen/field-layout definition**.

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| SCREENS | Keys `IV.MNT.PROD`, `IV.MNT.PROD.PRMTS` (shared with canonical) | READ |
| (all others) | As IV.MNT.PROD.N Section 2 | as .N |

## 3. External subroutines / chained programs called

Identical to IV.MNT.PROD.N (EDIT.LINE, MONEY, DSP.REPORT, RUN IV8, RUN CHANGE.VNORD, SORT-LABEL, TERM, CHAIN 'ABORT').

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| (authorization block) | 70–89 | program start |
| GET.NEXT.PROD | 977–1008 | INP.OPT (209), CALC.UPC |
| COMPARE.FLDS | 1010–1071 | INP.OPT (252) |

## 4. Business rules — extracted (differences from IV.MNT.PROD only)

### 4.1 Variant identity

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.O.01 | This variant uses the canonical screen definition (SCREENS `IV.MNT.PROD`, `IV.MNT.PROD.PRMTS`) and has no duty or customs-entry-number maintenance. | 52–53, 352, 425–463 | QUESTION |

QUESTION O.01: Which of IV.MNT.PROD / .N / .O is cataloged and run by staff today? If the canonical SCREENS PRMTS record lists fields this program handles (e.g. BRAND, ORIGIN), the canonical 2004 source cannot be the one in use with it.

### 4.2 Authorization / hold / status checks

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.O.02 | = N.01: user must be in CONTROL `IV.MNT.PROD` attr 1, and the entered code must pattern-match attr 2 at the same position; otherwise abort. | 71–89 | QUESTION |
| IV.MNT.PROD.O.03 | = N.02: authorization is all-or-nothing, with no field-level restriction on cost/price/vendor/UPC. | 71–89, 425–463 | QUESTION |
| IV.MNT.PROD.O.04 | = N.03: product numbers in IVMST.DISC cannot be reused. | 157–165 | KEEP |
| IV.MNT.PROD.O.05 | = N.04: delete status blank/0/1/2/3. | 328, 839–855 | QUESTION |
| IV.MNT.PROD.O.06 | = N.05: do-not-ship 1/blank. | 341–343, 875–891 | KEEP |
| IV.MNT.PROD.O.07 | = N.06: discard 1/blank (Y → 1, N/0 → blank). | 338–340, 857–873 | QUESTION |

### 4.3 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.O.08 | = N.07: a locked product shows the locking user and returns (no wait). | 151–155 | KEEP |
| IV.MNT.PROD.O.09 | = N.08: "A"/"N" starts a blank product with a full field walk. | 123–126 | KEEP |
| IV.MNT.PROD.O.10 | = N.09: "R" copies the last product and clears the history/stock/PO/location/UPC list. | 127–146 | SIMPLIFY |
| IV.MNT.PROD.O.11 | = N.10: the keyed-number add copies the prior product minus UPC/catalog only. | 174–175 | QUESTION |
| IV.MNT.PROD.O.12 | = N.11: a blank UPC at Update prompts "C" to generate a PRO UPC. | 212–222 | SIMPLIFY |
| IV.MNT.PROD.O.13 | = N.12: brand is free text. | 310, 494–500 | QUESTION |
| IV.MNT.PROD.O.14 | = N.13: a negative sub-group warns but is stored. | 526–538 | QUESTION |
| IV.MNT.PROD.O.15 | = N.14: month's supply must be a whole number or blank. | 790–799 | KEEP |

### 4.4 Terms, pricing, rebates

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.O.16 | = N.15: warehouse-rebate flag "N"/blank. | 336, 817–826 | QUESTION |
| IV.MNT.PROD.O.17 | = N.16: warehouse-IPI flag "Y"/blank. | 337, 828–837 | QUESTION |
| IV.MNT.PROD.O.18 | = N.17: a Price-1 change stamps DATE-CHG value 2; a Price-2/3 change stamps value 1; a new product sets the whole attribute. | 224–229 | QUESTION |

### 4.5 Logistics, customs and origin

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.O.19 | = N.18: weight in pounds, normalised to `n.nn` text. | 344–345, 893–916 | SIMPLIFY |
| IV.MNT.PROD.O.20 | = N.19: dimensions normalised to `LxWxH`. | 346, 918–952 | SIMPLIFY |
| IV.MNT.PROD.O.21 | = N.20: origin must be a code in CONTROL `COO`. | 66–69, 347–351, 954–964 | KEEP |
| IV.MNT.PROD.O.22 | = N.21: HS code blank or `####.##.####`, replacing the whole attribute. | 352, 966–975 | QUESTION |

### 4.6 New product numbering

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.O.23 | = N.24: PID read with a lock, retrying every 3 seconds. | 977–988 | SIMPLIFY |
| IV.MNT.PROD.O.24 | = N.25: skip numbers that exist in IVMST/IVCAT/IVMST.DISC/APMST; step 7; wrap above 9989 to 1005. | 989–1002 | QUESTION |

### 4.7 Persistence — change log

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.O.25 | = N.26: IVMST.LOG record of changed screen fields (user, product, name/attr/old/new) keyed date*time. | 181, 252, 1010–1071 | KEEP |
| IV.MNT.PROD.O.26 | = N.27: type codes D/I/V/R/M/N. | 1057–1064 | QUESTION |
| IV.MNT.PROD.O.27 | = N.28: product creation is not logged. | 209 | QUESTION |

### 4.8 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.MNT.PROD.O.28 | = N.29: the product lock is released each cycle. | 108 | KEEP |
| IV.MNT.PROD.O.29 | = N.30: IVCAT keys are READVU-locked before write/delete. | 235–250 | KEEP |
| IV.MNT.PROD.O.30 | = N.31: the IVMST.LOG key is locked before the write (no LOCKED clause). | 1068–1069 | SIMPLIFY |

The questions for every rule except O.01 are stated once, under the matching .N rule in `IV.MNT.PROD.N.md`.

Customer-specific exceptions (hard-coded member numbers): N/A — none.
Vendor-specific exceptions (hard-coded vendor numbers): N/A — none.
Product-group rules: N/A — none.
Wire format / parsing: N/A — interactive.

## 5. Hard-coded business identifiers found

Same set as IV.MNT.PROD.N Section 5 (`0291440`, step 7, `9989`, `1005`, `'4N'`, `PID`, `IV.MNT.PROD` CONTROL key, `ENCODE`, `COO`, origin `U`, delete-status 0–3, HS-code format, log type letters, x10 surcharge, rebate cap 99, `GROUPS`), **minus** the customs entry-number format. Line numbers: 1000 (9989/1005), 1075 (`0291440`), 75 (`ENCODE`), 77 (CONTROL key), 66 (`COO`), 962 (origin `U`), 971 (HS format), 1058–1063 (type letters).

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

As IV.MNT.PROD.N Section 6, without attrs 54 (DUTY) and 55 (ENTRY.NO). All money fields are **cents** (MD2); surcharge is **tenths of a percent**; rebate % is **whole percent**; weight is **literal decimal pounds**. The same unconfirmed attribute mappings apply (PO.QTY, REBATE.PCT, DEL.STATUS, DISCARD, WHSREB, WHSIPI).

## 7. Bug suspects

All IV.MNT.PROD.N bug suspects apply here at shifted lines, except that bug 2 (DUTY/ENTRY.NO stale-value logging) arises only if the shared SCREENS `IV.MNT.PROD.PRMTS` record lists a field name missing from COMPARE.FLDS. Key locations in this file:

1. Missing `;` in `CASE IP[1,1]='E' OR EXIT IP='E'`: line 203.
2. Log key collision (date*time): line 1011.
3. HS-code multi-value erasure: line 973.
4. Price-2/3 change overwrites the creation-date position: lines 226–227.
5. Keyed-number add copies inventory/history: lines 174–175.
6. Surcharge x10 compounding: INP.SCH.PCT at 716–727.
7. Wrap to 1005 vs header "1001": line 1000.
8. Negative sub-group stored after the warning: lines 530–536.
9. Authority-code weaknesses (pattern match, `ENCODE` prefill, echo): lines 75–82.
10. **Shared SCREENS record with canonical (lines 52–53):** if the PRMTS record lists a field this program has no INP/DSP case for (or vice versa), the field is silently skipped in display/input. The two programs cannot both match one layout record unless their field lists are identical; they are not (canonical lacks BRAND, DEL.STATUS, WHSREB, WHSIPI, DISCARD, DONOTSHIP, WEIGHT, DIMENSIONS, ORIGIN, HS.CODE).

## 8. Schema-design notes for the CTO

- Nothing in this variant is absent from IV.MNT.PROD.N. Every entity, overloaded attribute, audit gap and unit conflict is covered in `IV.MNT.PROD.N.md` Section 8.
- Its only schema-relevant signal: duty and customs entry number were added later (2012) and are the least-established fields, so they are prime candidates for redesign (move the entry number to goods receipt).
- No sibling extraction beyond those listed for .N is required.

## 9. Questions for COO/CFO — consolidated

1. Which product-maintenance program (IV.MNT.PROD, .N or .O) do staff actually run today? (IV.MNT.PROD.O.01)
2. All other questions: see IV.MNT.PROD.N.md Section 9. They map one-to-one to O.02–O.30 via the "= N.xx" references above.

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 9 | O.04, O.06, O.08, O.09, O.15, O.21, O.25, O.28, O.29 |
| SIMPLIFY | 6 | O.10, O.12, O.19, O.20, O.23, O.30 |
| OBSOLETE | 0 | — |
| OBSOLETE-INTEGRATION | 0 | — |
| QUESTION | 15 | O.01, O.02, O.03, O.05, O.07, O.11, O.13, O.14, O.16, O.17, O.18, O.22, O.24, O.26, O.27 |
| WAREHOUSE-ONLY | 0 | — |

Total: 30 rules (9 + 6 + 15 = 30). (IDs abbreviated: "O.04" = IV.MNT.PROD.O.04.) If O.01 confirms this variant is not cataloged, the CTO can reclassify all 30 as OBSOLETE in one decision, because the logic is fully covered by IV.MNT.PROD.N.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Canonical | IV.MNT.PROD | Shares SCREENS `IV.MNT.PROD` / `.PRMTS` with this variant |
| Sibling (variant) | IV.MNT.PROD.N | Superset of this file (adds DUTY, ENTRY.NO; own SCREENS keys) |
| Display | IV.DSP.PROD | Displays the same extended fields |
| Called program | IV8, CHANGE.VNORD | As canonical |
| Shared files | IVMST, IVMST.DISC, IVMST.LOG, IVCAT, VNMST, APMST, IGROUPS, EGROUPS, CONTROL, SCREENS | |

**Sibling-series flag:** variant (`.O`, likely "old"). It is a near-exact earlier copy of IV.MNT.PROD.N and adds no rule of its own beyond its screen-record choice. It is a candidate for OBSOLETE without further extraction once the cataloged version is confirmed.
