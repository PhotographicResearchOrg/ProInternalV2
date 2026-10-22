# ORDUP1 — Update ORDDUE prior to entering new due dates

**Source program:** `BP/ORDUP1`
**Domain:** Inventory
**Integration mode:** Utility/maintenance
**Lines of code:** 22
**Last code change:** 11/14/97 (header line 2, `pro`). No changelog
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This housekeeping step runs before buyers key in expected stock dates. It deletes product due dates (ORDDUE) that no longer apply, either because the product is back in stock or because the date has arrived or passed. It then prints a worklist of out-of-stock products that have no due date, which the buyer fills in with `WHSE.DUE`. ORDDUE is the "expected in stock" date shown to members (e.g. via the IVMST `DDATE` dictionary item). It does NOT read POs to calculate a date, or tie a date to a specific PO.

## 1.5. Integration footprint

N/A — utility/maintenance with a printed report.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| ORDDUE | Expected stock date per product: key = product, attr 1 = due date | READ+WRITE (DELETE) |
| IVMST | Product master, read through dictionary items `INSTK`, `DDATE`, `F14`, `NET.AVAIL`, `PO.NUM`, `PO.QUAN`, `PO.DATE`, `GRP`, `DESC` | READ (via SELECT/SORT) |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `EXECUTE 'SELECT IVMST WITH INSTK = "YES" AND WITH DDATE'` | Products in stock that still have a due date (line 9) |
| `EXECUTE 'SELECT ORDDUE WITH DUE LE TODAY'` | Due dates today or earlier (line 13) |
| `EXECUTE 'SORT IVMST ... HEADING "PRODUCT DUE DATE REPORT"'` | Worklist report (line 19) |
| `EXECUTE 'TERM ,60'` / `'TERM ,24'` | Page length for the printout (lines 17, 21) |
| `CHAIN 'ABORT'` | ORDDUE open failure (line 6) |

**Internal labeled sections (subroutine-like):** none.

## 4. Business rules — extracted

### 4.1 Date and quantity rules

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| ORDUP1.01 | A product's due date is deleted when the product is in stock. `INSTK` is a dictionary item. Decoded I-descriptor (confirm it is the one named INSTK): "YES" when on hand (SUM IVMST 24) − REQ (IVMST 3) > 0 and HOLD (IVMST 46) ≠ 1. | 8–11 | KEEP |
| ORDUP1.02 | A due date that is today or earlier is deleted. A late shipment loses its date rather than being flagged overdue. | 12–15 | QUESTION |

ORDUP1.02: When the expected date passes without stock, should the date be kept and flagged late (and the buyer prompted) instead of disappearing?

### 4.2 Reporting

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| ORDUP1.03 | The "PRODUCT DUE DATE REPORT" lists products with group ≥ "1" (string compare), not in stock (`INSTK = "NO"`), no due date, and `F14` ≠ "N", sorted by group and description. It shows in-stock flag, net available, open PO numbers, PO quantities and PO dates. This is the buyer's worklist for WHSE.DUE. | 16–19 | SIMPLIFY |
| ORDUP1.04 | The report goes to the terminal's attached (slave) printer (ESC `3` on, ESC `4` off) at 60 lines per page; the page length is then reset to 24. | 17–18, 20–21 | OBSOLETE |

ORDUP1.03: Confirm what dictionary item `F14` means (a decoded IVMST I-descriptor returns "N" when STATUS > 0 and AVAIL < 1, i.e. inactive with no stock).

### 4.3 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| ORDUP1.05 | Deletes are unconditional and unlocked; a due date being entered in WHSE.DUE at the same moment can be deleted. | 11, 15 | SIMPLIFY |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `GRP GE "1"` | Product-group | 19 | Exclude group 0 / blank | QUESTION |
| `F14 = "N"` | Other | 19 | Exclusion flag (meaning unclear) | QUESTION |
| `60` / `24` | Magic-number | 17, 21 | Page lengths | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

### ORDDUE

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| @ID | — | Product | — | |
| 1 | DUE / DATE | Expected in-stock date | Pick date | |
| 2 | UPD.DATE | (dictionary only) | Pick date | **Not written by any program in BP** |
| 3 | PO / VIA-PO | (dictionary only) | — | **Not written by any program in BP** |

### IVMST (via dictionary items)

| Item | Definition (decoded, confirm) | Notes |
|---|---|---|
| INSTK | (SUM QTY.REC − REQ) > 0 and HOLD ≠ 1 → YES | |
| DDATE | TRANS(ORDDUE, PROD, DUE) | |
| PO.QUAN | IVMST 21 | Excludes backorder balance (23) |
| PO.DATE | TRANS(IVPO, PO.NO, DATE) | |

No money fields.

## 7. Bug suspects

- **Overdue information lost (13–15):** deleting dates that have passed hides late vendors; members see no date rather than a late date.
- **Worklist understates on order (19):** `PO.QUAN` is IVMST 21 only. After a partial receipt the remaining qty is in attr 23 and does not show.
- **String compare on group (19):** `GRP GE "1"` is a string test, so groups are filtered by text order; confirm the intent was to exclude group 0/blank.
- **Unused dictionary fields:** ORDDUE attrs 2 (update date) and 3 (via PO) exist but nothing in BP writes them.
- **READU/MATREADU silent-fallthrough:** not present.

## 8. Schema-design notes for the CTO

- Entity: Product Expected Availability Date. In PIV2 this should be derived from open PO lines (vendor promised/ETA date per PO line) with an optional manual override, not a separate per-product date with no PO link.
- Keep history: expected date, who set it, when, and which PO it relies on (ORDDUE 2 and 3 were designed for this but never filled).
- "In stock" must have one definition (on hand − member demand > 0, not on hold) shared with backorder release and the member site.
- Sibling: `WHSE.DUE` (entry), member-facing programs that display `DDATE`.

## 9. Questions for COO/CFO — consolidated

1. Should passed due dates be kept and flagged late? (relates to ORDUP1.02)
2. What does `F14` exclude, and which products need a due date? (relates to ORDUP1.03)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 1 | ORDUP1.01 |
| SIMPLIFY | 2 | ORDUP1.03, ORDUP1.05 |
| OBSOLETE | 1 | ORDUP1.04 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 1 | ORDUP1.02 |
| WAREHOUSE-ONLY | 0 | |

Total: 5 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling | `WHSE.DUE` | Enters the dates this program clears |
| File | ORDDUE | Only ORDUP1 and WHSE.DUE touch it in BP; read by IVMST dictionary items (DDATE, due-date columns) |
| Dictionary | IVMST `INSTK`, `DDATE`, `F14`, `NET.AVAIL`, `PO.*` | |

**Sibling-series flag:** `ORDUP1` suggests a numbered series, but no `ORDUP2`… exists in BP. Canonical.
