# AP.SEL.INVSPC — Select invoices to pay with additional discount

**Source program:** `BP/AP.SEL.INVSPC`
**Domain:** AP
**Integration mode:** Interactive
**Lines of code:** 126
**Last code change:** 02/04/2003 (header line 3, slove)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This program builds a check-run selection for **one AP vendor** and takes an extra "special" discount (default 2%) on every open invoice. The operator enters the AP vendor number, the payment date (today through today+14) and the discount percent. The program selects all of that vendor's unpaid invoices (except one hard-coded due date), nets credit memos against invoices so the check is never negative, and marks each selected invoice as paid. It folds the special discount into the invoice's discount field and writes a due-to-pay record (APDUE) for check printing. It does NOT look at the vendor's normal terms or discount days, print the cash requirements report (despite the closing message), or print checks. The screen title is "A/P INVOICE SELECTION ADJUSTMENT", and the error prefixes say `AP9`, which suggests it was cloned from the standard selection program AP9 (not in BP).

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| `APDIST` | AP invoice/distribution record. Key = `<AP vendor 4 chars>*<invoice no>[*<n>]` | READ+WRITE |
| `APHIST` | AP invoice payment history | READ+WRITE |
| `APDUE` | Invoices selected for the current check run (same key as APDIST) | WRITE |
| `APMST` | AP vendor master (validation, name) | READ |
| `CONTROL` | `'APCHK'` check-run control record | READ+WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `IDATE` | Validates and converts the payment date (PAST=0, FUTURE=14 → today..today+14) |
| `EXECUTE 'SSELECT APDIST ...'` | Selects the vendor's unpaid invoices |
| `CHAIN 'ABORT'` | Fatal open/read errors |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| `100` (evaluate/select one invoice) | 73–104 | 66 (per selected invoice) |
| `500` (flush held credits into the selection) | 105–125 | 94 |

## 4. Business rules — extracted

### Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| AP.SEL.INVSPC.01 | One run covers exactly one **AP vendor** (APMST key), which must exist in APMST. `E`/`END` cancels the selection. | 31–38 | KEEP |
| AP.SEL.INVSPC.02 | The payment (check) date defaults to today and must fall between today and today+14 days. | 40–45; IDATE 44–47 | KEEP |
| AP.SEL.INVSPC.03 | The additional discount percent defaults to **2**. A `%` sign is stripped. The accepted forms are `N`, `N.N` or `N.NN`, so 0.00–9.99. The error text says "between 1 and 9%", but 0 is accepted. | 47–57 | QUESTION |

AP.SEL.INVSPC.03: The business must confirm that 2% is still the standard special discount, and what range (and who is allowed) to override it.

### Authorization / hold / status checks

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| AP.SEL.INVSPC.04 | No new selection is allowed while CONTROL `'APCHK'` attr 3 (selected check count) > 0, meaning a selection already exists or checks were printed but not updated. | 18–26 | KEEP |

### Terms, pricing, discounts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| AP.SEL.INVSPC.05 | Selects **every** APDIST invoice for the vendor whose paid flag (STATUS char 2) is `0`, whatever its due date or invoice date. The vendor's terms (APMST PCT attr 9, DUE.DAYS attr 10) are not consulted. | 60–62 | QUESTION |
| AP.SEL.INVSPC.06 | Invoices with due date **02/15/03** are excluded from the selection (hard-coded). | 61 | QUESTION |
| AP.SEL.INVSPC.07 | Special discount = `INT(gross × pct / 100 + 0.5)`, i.e. rounded half-up, in cents. Net to pay = gross − existing invoice discount (APDIST attr 4) − special discount. | 84–85 | KEEP |
| AP.SEL.INVSPC.08 | Credit netting: a document whose net ≤ 0, or that would leave the running total ≤ 0, is held back. When a later invoice arrives and the running total is positive, all held documents are selected first, then the current invoice. Documents still held at the end are not selected, so a check is never written for a negative or zero total. | 86–91, 93–95, 105–125 | SIMPLIFY |
| AP.SEL.INVSPC.09 | The special discount is also computed on credit memos (negative gross → negative special discount), which reduces the credit taken. | 84 (unconditional) | QUESTION |
| AP.SEL.INVSPC.10 | The special discount is added permanently into the invoice's discount field (APDIST attr 4 `DISC`). Only the APDUE record (attr 5 `ADD.DISC`) keeps it separate. | 97, 114 | QUESTION |

AP.SEL.INVSPC.05: The business must say whether a special-discount payment should pay every open invoice or only invoices within some due-date window.
AP.SEL.INVSPC.06: The business must say whether the 02/15/03 exclusion was a one-time workaround (likely obsolete) or a standing rule.
AP.SEL.INVSPC.09: The business must say whether the extra discount should apply to credit memos.
AP.SEL.INVSPC.10: The business must say whether the special discount must stay identifiable on the invoice after payment (for vendor disputes and reporting).

### Persistence — what gets written where

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| AP.SEL.INVSPC.11 | Selecting an invoice sets APDIST STATUS char 2 to `1`, sets APHIST attr 3 `NET` = net to pay, and writes APDUE (same key): attr 1 = payment date (internal), attr 2 = net (cents), attr 5 = special discount (cents). | 96–102, 113–119 | KEEP |
| AP.SEL.INVSPC.12 | At the end, CONTROL `'APCHK'` attr 2 = payment date and attr 3 = check count (1 if the total > 0, else 0). | 68–70 | KEEP |

### Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| AP.SEL.INVSPC.13 | CONTROL `'APCHK'` is read with `READU` (no LOCKED clause, so it waits) and held for the whole run. That serializes check-run selection programs. | 18, 70 | KEEP |
| AP.SEL.INVSPC.14 | APDIST and APHIST are read with `MATREADU` and no LOCKED clause (wait). A missing record shows "Please record error", waits for Enter, and skips the invoice. | 74–83 | SIMPLIFY |

### Error handling / call-Computyme prompts

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| AP.SEL.INVSPC.15 | A file that cannot be opened, or a missing `APCHK`, chains to ABORT. The messages are labelled `AP9`. | 8–13, 18–20 | SIMPLIFY |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `02/15/03` | Magic-date | 61 | Invoices due 2/15/2003 excluded from selection | QUESTION |
| `2` (%) | Threshold | 29, 49 | Default special discount | QUESTION |
| `14` days | Threshold | 43 | Maximum payment-date lead | QUESTION |
| `0.00–9.99` (pattern) | Threshold | 52–56 | Allowed discount range | QUESTION |
| `'APCHK'` | Other (CONTROL key) | 18, 70 | Check-run control | QUESTION |

No customer-specific or vendor-specific identifiers found (no hard-coded vendor numbers).

## 6. Data shape — record layouts referenced

### APDIST (read into matrix DIST / LDIST, DIM 20)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 0 | key | `<vendor>*<invoice>[*<n>]` | — | Vendor = `@ID[1,4]`. The dictionary has `SP = FIELD(@ID,'*',3)` |
| 1 | STATUS | 3-char status: char1 STAT.TYPE, char2 STAT.PAID (0/1), char3 (`L`?) | — | **Overloaded** (three flags in one string). Char 3 meaning: confirm |
| 3 | GROSS | Invoice gross | cents (MD2) | |
| 4 | DISC | Invoice discount, **plus** any special discount | cents (MD2) | Overloaded after this program runs |
| 6 | DUE | Due date | internal date | Used in the selection filter |

### APHIST (read into matrix HIST / LHIST, DIM 15)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 3 | NET | Net to pay | cents (MD2) | Overwritten with the selected net |

### APDUE (matrix DUEREC, DIM 5)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 1 | DATE | Check/payment date | internal date | |
| 2 | AMOUNT | Net to pay | cents (MD2) | |
| 3 | CHECK | Check number | — | Not written here |
| 4 | VOID | Void flag | — | Not written here |
| 5 | ADD.DISC | Special discount taken | cents (MD2) | Used by AP10 to reverse |

### CONTROL `'APCHK'`

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| 2 | — | Payment date of current run | internal date | |
| 3 | — | Selected check count | integer | > 0 blocks a new selection |
| 4 | — | Checks-printed marker | — | Read by AP10 |

All money in this program is **cents** (APDIST/APHIST/APDUE are MD2). The discount percent is entered in whole percent with up to 2 decimals.

## 7. Bug suspects

- **Hard-coded date (line 61):** `WITH DUE # "02/15/03"` looks like a one-off 2003 workaround left in production code.
- **Message does not match the test (line 56):** it says "between 1 and 9%", but the patterns accept 0 and 9.99.
- **Misleading completion message (line 71):** "Now printing cash requirements report" is printed, then the program STOPs. No report is produced.
- **Inconsistent APHIST key (lines 79 vs 111):** the main path reads APHIST with the full APDIST key, while the held-credit path uses `FIELD(OLDID,'*',1,2)`. If APDIST keys have a third part (the dictionary defines `SP`), the two paths update different APHIST records.
- **Lock leak (lines 79–82):** if APHIST is missing, only the APHIST lock is released. The APDIST record stays locked until the program ends.
- **Silently dropped credits (lines 110–123):** a held credit whose APDIST/APHIST read fails is skipped, but its NET was already added to TOTAL (line 87), so the check count can be wrong.
- **No transactional guard (lines 98–102, 115–119):** APDIST, APHIST and APDUE are written separately, so an abort leaves a partially selected invoice.
- **Special discount folded into DISC (line 97):** the original invoice discount can only be recovered while APDUE exists (AP10 subtracts it back).
- READU/MATREADU silent-fallthrough: not present. No LOCKED clauses, so the reads wait. The ELSE branches are not-found only.

## 8. Schema-design notes for the CTO

- Entities: **VendorInvoice** (APDIST), **InvoicePaymentHistory** (APHIST), **PaymentSelection / CheckRunLine** (APDUE), **CheckRun** (CONTROL APCHK).
- Overloaded: APDIST attr 1 STATUS (type / paid / third flag in one string) → separate fields. APDIST attr 4 DISC (terms discount + special discount) → separate `termsDiscount` and `additionalDiscount`.
- Missing audit: who ran the selection, the percent used, and why.
- Vendor identity: AP payments key on the AP vendor only (`@ID[1,4]`, so a 4-character AP vendor number). PRO vendor / VNMST is not involved.
- The vendor's discount percent and due days live on APMST (attrs 9, 10, 20 FG.PCT). This program ignores them, so the "special discount" is a separate negotiated concession. Decide whether the Vendor Desk models it as a per-vendor default.
- Sibling AP programs (AP1–AP9 selection, check print and update) are **not in BP**. Their absence blocks a complete AP schema.

## 9. Questions for COO/CFO — consolidated

1. Is 2% still the default special discount, what range is allowed, and who may change it? (relates to AP.SEL.INVSPC.03)
2. Should a special-discount payment pay all open invoices or only those due within a window? (relates to AP.SEL.INVSPC.05)
3. Is the 02/15/03 due-date exclusion obsolete? (relates to AP.SEL.INVSPC.06)
4. Should the extra discount apply to credit memos? (relates to AP.SEL.INVSPC.09)
5. Must the special discount stay separately visible on the invoice after payment? (relates to AP.SEL.INVSPC.10)
6. Which vendors get the special discount, and is it a per-vendor agreement the Vendor Desk should store? (relates to AP.SEL.INVSPC.01, .07)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 7 | AP.SEL.INVSPC.01, .02, .04, .07, .11, .12, .13 |
| SIMPLIFY | 3 | AP.SEL.INVSPC.08, .14, .15 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 5 | AP.SEL.INVSPC.03, .05, .06, .09, .10 |
| WAREHOUSE-ONLY | 0 | |

Total: 15 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling program | `AP10` | Cancels the entire selection; reverses the special discount using APDUE attr 5 |
| Sibling program | `AP9` (not in BP) | Error prefixes indicate this program was cloned from AP9 (standard selection) |
| Subroutine | `IDATE` | Date validation |
| Shared file | `APDIST`, `APHIST`, `APDUE`, `CONTROL 'APCHK'` | Shared with AP10 and (presumably) the AP check print/update programs |
| Shared file | `APMST` | AP vendor master (also VNMST.APID target and IVMST A.VENDOR target) |

**Sibling-series flag:** looks like a special-purpose variant of AP9 (standard invoice selection). AP9 is not in BP, so this cannot be checked against the canonical version. Confirm whether AP9 exists on the live system.
