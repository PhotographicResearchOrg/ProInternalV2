# IV.UPD.COGS — Update IVMST and ARMST profit based on QOH & SCANORD

**Source program:** `BP/IV.UPD.COGS`
**Domain:** Inventory
**Integration mode:** Subroutine
**Lines of code:** 101
**Last code change:** 1 MAR 2012 (header line 3, PWQ; changelog 03-01-12 SJL "Add display of update w/QOH ... test for QOH >= 0"). Original version 05-06-11 SJL
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

When goods are received for a product whose stock was negative (sold before it arrived), receiving calls this routine with the product, the negative quantity and the new landed unit cost. It walks back through the most recent billed invoices (SCANORD) for that product until it has covered the negative quantity, and reduces two profit figures by qty × the new cost: the product's monthly profit (IVMST `YPROF`) and the member's warehouse profit (ARMST `WH.PROFIT`). The effect is a late cost-of-goods charge on sales that were billed without stock. It does NOT change invoices, GL, stock layers or average cost, and keeps no log of what it restated.

## 1.5. Integration footprint

N/A — subroutine.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| SCANORD | Billed/scanned member invoices: products, shipped qty, billed date | READ (SSELECT) |
| IVMST | Product: monthly profit buckets (`YPROF`) | READ+WRITE |
| ARMST | Member: warehouse profit (`WH.PROFIT`) | READ+WRITE |
| CONTROL | `UPD` attr 2 = current month of the monthly update | READ |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `INCLUDE FILE.INCLUDES SCANORD.FIELDS / IVMST.FIELDS / ARMST.FIELDS` | EQUs `SCANORD.PROD`, `SCANORD.SHIP`, `SCANORD.BILLED`, `SCANORD.MEMBER`, `IVMST.YPROF`, `ARMST.WH.PROFIT`. Not in BP, so attribute numbers must be confirmed |
| `EXECUTE 'SSELECT SCANORD WITH BILLED AND WITH PROD = ... BY-DSND DATE.BILLED BY-DSND TIME.BILLED' CAPTURING` | Most recent invoices first (lines 26–28) |
| `CHAIN 'ABORT'` | Open / CONTROL failures (lines 22, 24) |
| Called from | `IV.ORD.REC` line 311, `IV.ORD.REC.N`; test harness `BP/X` |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| `UPDATE.IVMST` | 57–79 | 41 |
| `UPDATE.ARMST` | 81–99 | 42 |

## 4. Business rules — extracted

### 4.1 Inputs

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.UPD.COGS.01 | Inputs: product, negative quantity on hand before the receipt (QOH < 0), and the receipt's landed unit cost `AVG` in USD cents (IV.ORD.REC computes it as INT(extended landed cost / qty + .5), after yen conversion and the additional-charges %). | 1, 9; IV.ORD.REC 309–311 | KEEP |

### 4.2 Which sales are restated

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.UPD.COGS.02 | Billed SCANORD invoices containing the product are taken newest first (billed date, then time, descending). The units sold while stock was negative are assumed to be the most recent sales. | 26–28 | QUESTION |
| IV.UPD.COGS.03 | Each invoice line for the product contributes its shipped qty (SCANORD `SHIP`) until the negative quantity is used up. The last line is applied only partly, and processing then stops. | 33–46, 48–52 | KEEP |

IV.UPD.COGS.02: Is "most recent sales first" the right way to choose which sales carried no cost?

### 4.3 What is restated

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.UPD.COGS.04 | Product profit: IVMST `YPROF` at the invoice's month position −= applied qty × `AVG`. | 69–76 | QUESTION |
| IV.UPD.COGS.05 | Month position = CONTROL `UPD` month − billing month, where the billing month counts as the next month if billed after the 26th (except December). A result of 0 becomes 1, and a negative result has 13 added. | 24, 70–74 | QUESTION |
| IV.UPD.COGS.06 | Member profit: ARMST `WH.PROFIT` for the invoice's member −= applied qty × `AVG`. | 81–98 | QUESTION |
| IV.UPD.COGS.07 | The full cost is subtracted, which implies the original billing recorded **zero** cost of goods for units sold from negative stock. Inferred from the arithmetic, not stated in code. | 75, 95 | QUESTION |

IV.UPD.COGS.04 / .06: Finance must confirm that product and member profit statistics should be restated after the fact, and whether PIV2 should post a COGS adjustment to the GL instead.
IV.UPD.COGS.05: Is the 26th the monthly cutoff? The mapping is inconsistent across year end (§7).
IV.UPD.COGS.07: Confirm with the billing program how cost is set on a line billed from negative stock.

### 4.4 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.UPD.COGS.08 | IVMST and ARMST are read with `MATREADU ... LOCKED`. The routine waits 6 s per try (an extra 6 s every 20 tries) and shows the user holding the lock. A record that is not found is skipped silently. Locked and not-found are told apart correctly. | 59–68, 84–93 | SIMPLIFY |

### 4.5 Error handling and display

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.UPD.COGS.09 | Any file-open failure aborts with "CANNOT OPEN SCANORD" (whatever the file). A missing CONTROL `UPD` aborts. | 17–24 | SIMPLIFY |
| IV.UPD.COGS.10 | Each restated invoice line is displayed with a 1-second pause (debug display added 2012). | 40, 43 | OBSOLETE |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `26` (day) | Magic-date | 72 | Billing after the 26th counts as next month | QUESTION |
| `12` (December exception) | Magic-date | 72 | No roll-forward in December | QUESTION |
| `13` | Magic-number | 74 | Month-position wrap | QUESTION |
| `6` s / `20` | Threshold | 65–66, 90–91 | Lock retry cadence | QUESTION |
| CONTROL `UPD` | Other (control key) | 24 | Current month | QUESTION |
| Product `6507`, qty −1, cost 1492 | Product# | `BP/X` (test harness, not this program) | Manual test call | QUESTION |

No customer-specific or vendor-specific identifiers found in this program.

## 6. Data shape — record layouts referenced

### SCANORD (dynamic SCANREC). EQUs from FILE.INCLUDES, attribute numbers to confirm

| EQU | Dictionary (decoded) | Used as | Units | Notes |
|---|---|---|---|---|
| SCANORD.PROD | attr 1 PROD (MV) | Product per line | — | |
| SCANORD.SHIP | attr 3 SHIP (MV) | Qty shipped per line | units | |
| SCANORD.BILLED | attr 10 Billed (MV) | Billed date (value 1 used) | Pick date | |
| SCANORD.MEMBER | unknown | Member number | — | Confirm |

### IVMST (matrix M, DIM 55)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| ? (`IVMST.YPROF`) | YPROF | Monthly profit buckets (MV, position = months back) | USD cents | Probably attr 45 `PYTD` "Profit-YTD" (MD02); confirm |

### ARMST (matrix AR, DIM 45)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| ? (`ARMST.WH.PROFIT`) | WH.PROFIT | Member warehouse profit | USD cents | Attr number unknown; confirm |

### Arguments

| Arg | Used as | Units | Notes |
|---|---|---|---|
| PROD | Product | — | |
| QOH | Negative qty on hand before receipt | units | **Modified in place** (driven toward 0) |
| AVG | Landed unit cost | USD cents | |

## 7. Bug suspects

- **Same sales restated repeatedly:** every call starts from the newest invoice. If stock goes negative again later (or a partial receipt leaves it negative, see IV.ORD.REC.31 / its §7), the next call restates the same recent invoices again instead of the not-yet-costed ones. Nothing marks an invoice line as already costed.
- **Month position inconsistent (73–74):** a sale in the current month (difference 0) and in the previous month (difference 1) both land in position 1. Across a year end the previous month lands in position 2 (e.g. UPD = 1, billed in December: −11 + 13 = 2). Profit is posted to the wrong month in one of the two cases.
- **Wrong open-error message (18–22):** `OPEN.ERR = ' IVMST '` overwrites rather than appends, and the message always says SCANORD.
- **No transaction (76, 96):** IVMST is written before ARMST for each line. A failure in between restates product profit but not member profit.
- **No audit trail:** no record of which invoices, quantities or costs were restated.
- **1-second sleep per line (43):** receiving is slowed by one second per restated invoice line.
- **Only the first billed date is used (34):** a re-billed invoice with several billed dates uses value 1.
- **Caller's variable modified (38–39):** `QOH` is passed by reference and changed; harmless in IV.ORD.REC today, but fragile.
- **READU/MATREADU silent-fallthrough:** not present. Both loops use `LOCKED` and tell not-found apart.

## 8. Schema-design notes for the CTO

- Entities: COGS Adjustment (product, invoice line, qty, original cost, new cost, date, receipt link), Product Profit by Month, Member Profit.
- PIV2 should not store profit statistics on the product or member. Derive them from invoice lines with their cost, and record late-cost adjustments as rows linked to the receipt and the invoice lines.
- Decide the costing model first (IV.ORD.REC §8: layers vs average vs standard). Negative-stock sales then get a provisional cost (e.g. last cost) at billing, adjusted at receipt, instead of zero.
- Missing audit: which sales were restated, by which receipt.
- Extract before schema commit: the billing program that sets cost on SCANORD lines, the monthly update that rolls `YPROF`/CONTROL `UPD`, and `FILE.INCLUDES` (EQU attribute numbers).

## 9. Questions for COO/CFO — consolidated

1. Should newest sales be treated as the ones sold without stock? (relates to IV.UPD.COGS.02)
2. Should product and member profit be restated after the fact, or should the GL carry a COGS adjustment? (relates to IV.UPD.COGS.04, IV.UPD.COGS.06)
3. Is the 26th the monthly cutoff for profit months? (relates to IV.UPD.COGS.05)
4. What cost does billing record when stock is negative? (relates to IV.UPD.COGS.07)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 2 | IV.UPD.COGS.01, IV.UPD.COGS.03 |
| SIMPLIFY | 2 | IV.UPD.COGS.08, IV.UPD.COGS.09 |
| OBSOLETE | 1 | IV.UPD.COGS.10 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 5 | IV.UPD.COGS.02, .04, .05, .06, .07 |
| WAREHOUSE-ONLY | 0 | |

Total: 10 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Caller | `IV.ORD.REC` (line 311), `IV.ORD.REC.N` | Receiving onto negative stock (IV.ORD.REC.31) |
| Test | `BP/X` | Calls with product 6507, −1, 1492 |
| File | SCANORD | Billing/scan file; written by billing programs (not extracted) |
| File | CONTROL `UPD` | Also used by `DH1`, AR month-end programs |
| Include | `FILE.INCLUDES` (`SCANORD.FIELDS`, `IVMST.FIELDS`, `ARMST.FIELDS`) | Not in BP |

**Sibling-series flag:** none. Canonical.
