# IV6 — Inventory ordering and receiving USING IVPO

**Source program:** `BP/IV6`
**Domain:** Inventory
**Integration mode:** Interactive
**Lines of code:** 312
**Last code change:** 01/16/2007 (header line 3; last changelog 01-16-07 SJL)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

IV6 is the 2007 predecessor of `IV.ORD.REC`, whose header reads "RENAMED from IV6". It has the same three-option menu: manual PO (hands off to `IV46`), automatic PO creation from the `ORDER` work file, and receiving against a PO. It also has the same receiving batch, yen conversion, landed-cost % and backorder trigger. It lacks the 2008–2012 changes: the letter-prefix PO format, the last-cost update, negative-stock revaluation, COGS restatement and wait-on-lock loops. Its rules are extracted so the CTO can confirm it is retired and so historical data created under these rules can be understood.

## 1.5. Integration footprint

N/A — interactive.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master: open POs (20–23), cost layers (24–26) | READ+WRITE |
| IVPO | Purchase order | READ+WRITE |
| ORDER | Work file of products to order (key product, attr 1 qty) | READ+WRITE (CLEARFILE) |
| RECLOG | Receipt log | WRITE |
| POADJ | Backorder cancellation log | WRITE |
| IVCAT | Catalog no. → product | READ |
| CONTROL | `YEN.CONV`, `ABO`, `BORUN`, `BATCH` | READ+WRITE |
| PGM.AUDIT | Usage audit, record `IV6` | READ+WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `EXECUTE 'RUN IVBP IV46'` | Option 1, manual PO (line 53) |
| `CALL IVPO.ON.ORD` | Open qty per line (174, 236) |
| `CHAIN 'RUN BP IV11.AUTO'` | Backorder run (88) |
| `CHAIN 'ABORT'` | Fatal exit (39, 41, 111) |
| `INCLUDE UTLBP I_GETWHO` | Sets `USER` |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| `130` Update receiving | 261–292 | 220, 231 |
| `140` Cancel backorder | 293–305 | 206 |
| `UPD.AUDIT` | 306–311 | 78, 87, 90, 94, 100 |

## 4. Business rules — extracted

Each rule that `IV.ORD.REC` carries unchanged is tagged OBSOLETE (superseded) and mapped to its canonical rule. The differences, which matter for interpreting historical data, are rules 16 and 17.

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.01 | The menu offers 1 = run IV46 and stop, 2 = auto-create, 3 = receive. Superseded by IV.ORD.REC.01. | 48–55, 158 | OBSOLETE |
| IV6.02 | PO number must be 5 digits or 5 digits + 1 letter. The `1A5N` letter-prefix form is not accepted (it was added in IV.ORD.REC, 05-30-08). | 118–120 | OBSOLETE |
| IV6.03 | Receiving requires an existing IVPO; auto-create starts a blank one. Same as IV.ORD.REC.03. | 121–126 | OBSOLETE |
| IV6.04 | Date is MM.DD.YY, defaults to today, must be valid and not in the future. Same as IV.ORD.REC.04. | 127–135 | OBSOLETE |
| IV6.05 | Catalog number is translated through IVCAT, falling back to the product code. Same as IV.ORD.REC.05. | 179 | OBSOLETE |
| IV6.06 | The product must exist, carry the PO, and be on the PO. If the IVMST record is locked, manual receiving rejects it at once with "RECORD LOCKED" and does not wait. | 180–195 | OBSOLETE |
| IV6.07 | Qty is a whole number; ≤0 skips; `C`/`-` + `YES` cancels the backorder; over-receipt needs re-entry to confirm. Same as IV.ORD.REC.07/08. | 197–221 | OBSOLETE |

### 4.2 Automatic PO creation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.08 | Every `ORDER` record becomes a line on the one PO entered. The header vendor is IVMST attr 5 of the first product and the PO date is the date entered. Line cost is IVMST 19 RAW, copied to IVMST 22 and IVPO 8. There is no duplicate or vendor check, and `ORDER` is cleared at the end. Same as IV.ORD.REC.09–15. | 240–260 | OBSOLETE |

### 4.3 Receiving — quantities and status

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.09 | Remaining due = IVMST 21 + 23. A full receipt removes the PO from the product; a partial one blanks 21 and puts the balance in 23. Same as IV.ORD.REC.16–17. | 197, 262–267 | OBSOLETE |
| IV6.10 | Each receipt appends subvalues to IVPO 9 (qty), 11 (date), 12 (landed extended cost). Same as IV.ORD.REC.18. | 290–291 | OBSOLETE |
| IV6.11 | Auto receive takes every line in full at the remaining due and skips lines no longer on the product. Same as IV.ORD.REC.19. | 222–239 | OBSOLETE |
| IV6.12 | IVPO 13 = 1 when the net open qty across lines = 0. Same as IV.ORD.REC.20. | 174–175, 236–237 | OBSOLETE |
| IV6.13 | Backorder cancellation: remove the PO from the product, write POADJ, set ordered = received, add a zero receipt subvalue. Same as IV.ORD.REC.21. | 293–305 | OBSOLETE |

### 4.4 Receiving — cost

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.14 | A `Y`-suffixed cost is yen: extended yen is converted with `INT(TCST/CONV×10000+.5)`, using a rate entered per PO and stored in CONTROL `YEN.CONV` with today's date. Same as IV.ORD.REC.22–26. | 137–148, 268–272 | OBSOLETE |
| IV6.15 | Landed uplift `TCST += INT(TCST×PCT/10000+.05)`, with PCT entered per PO ×100. Same as IV.ORD.REC.27. | 149–155, 273 | OBSOLETE |
| IV6.16 | **Differs from canonical.** If the first cost layer is ≤ 0, the receipt adds the **full** landed cost to that layer's value (`M(25)<1,1> += TCST`) and its qty (`+= Q`), and deletes the layer only if qty reaches exactly 0. The units already sold while negative are not removed from the value (IV.ORD.REC.30 fixed this in 2011–2012). | 274–280 | QUESTION |
| IV6.17 | **Differs from canonical.** Receiving updates only the open PO, the cost layers, IVPO and RECLOG. It does not update IVMST LAST.COST and does not restate COGS (both added to IV.ORD.REC in 2011). | 261–292 | OBSOLETE |

IV6.16: Cost layers created while IV6 was live (before 05-06-11) may carry overstated values on products that went negative. Finance should decide whether opening inventory values for PIV2 come from these layers or are re-costed.

### 4.5 Session, logging, backorder trigger

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.18 | A RECLOG record per receipt, key receiptdate*time*user*seq: 1 product, 2 qty, 3 landed extended cost, 6 PO, 7 batch. Field 8 (last cost) is not written. | 285–288 | OBSOLETE |
| IV6.19 | One receiving session at a time (CONTROL `BATCH` attr 2 = `O`). The batch number is shown at the end and then incremented. Same as IV.ORD.REC.32–33. | 55–75, 104–115 | OBSOLETE |
| IV6.20 | On exit, if ABO = 1, receipts occurred and today > the BORUN date, chain IV11.AUTO (automatically if > 3 days, otherwise ask). Same as IV.ORD.REC.36. | 76–97 | OBSOLETE |
| IV6.21 | Usage is audited to PGM.AUDIT `IV6`. Same as IV.ORD.REC.35. | 306–311 | OBSOLETE |

### 4.6 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.22 | The CONTROL `BATCH` lock is retried every 5 s, 12 times, then the program quits. | 56–65 | OBSOLETE |
| IV6.23 | Auto receive (228) and auto create (249, 252) use `MATREADU` without a LOCKED clause, so they wait indefinitely with no on-screen message while another user holds the record. | 228, 249, 252 | OBSOLETE |

### 4.7 Variant status

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV6.24 | IV6 was superseded by IV.ORD.REC ("RENAMED from IV6"). Confirm it is no longer on any menu or VOC entry; if it is, users can still receive without last-cost or COGS updates. | 1–3; IV.ORD.REC line 1 | QUESTION |

IV6.24: Is IV6 still reachable from any menu?

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `'5N'`, `'5N1A'` | Other (format) | 118 | PO number format | QUESTION |
| CONTROL `YEN.CONV`, `ABO`, `BORUN`, `BATCH` | Other (control keys) | 41–43, 58–72 | As in IV.ORD.REC | QUESTION |
| 3 (days) | Threshold | 82 | Forced backorder run | QUESTION |
| 12 × 5 s | Threshold | 61–62 | Batch lock wait | QUESTION |
| 10000, 0.05 | Magic-number | 270–273 | Rate/pct scaling and rounding | QUESTION |
| `'IV6'` | Other | 307, 310 | PGM.AUDIT key | QUESTION |

No customer-specific or vendor-specific identifiers found.

## 6. Data shape — record layouts referenced

Identical to IV.ORD.REC §6 (IVMST 4, 5, 19, 20–26; IVPO 1, 2, 6–9, 11–13; ORDER; RECLOG 1–3, 6–7; POADJ 1, 2, 6; CONTROL records), except that IVMST 28 LAST.COST and RECLOG 8 are not touched. Money units: IVMST 19/22 and IVPO 8 are USD cents (MD2) or whole yen with a `Y` suffix. IVMST 25, IVPO 12 and RECLOG 3 are USD cents after conversion.

## 7. Bug suspects

- **Comment does not match code (changelog line 14 vs 279):** "02-01-05 Change receiving if M(24)<0 then use CST * Q not TCST", but line 279 adds `TCST`, the landed extended cost.
- **Dead/incorrect conversion (270):** `CST=INT(((CST/CONV)*10000)+.5)` divides the raw string (which may contain `Y`) and the result is never used. `X=` on line 273 is also unused.
- **Negative-layer value overstatement (274–280):** see IV6.16.
- **Net PO closure, missing transaction guard, auto-create IVPO-before-IVMST, duplicate lines, batch flag stuck on abnormal exit:** same as IV.ORD.REC §7 (lines 174–176, 236–238, 255–257, 71–72).
- **Silent waits (228, 249, 252):** MATREADU without LOCKED, so the operator gets no feedback. These are not silent-fallthrough: the ELSE clause there means not found only.

## 8. Schema-design notes for the CTO

- No new entities beyond IV.ORD.REC.
- Historical data note: cost-layer values (IVMST 25) and IVPO 12 written before the 2011–2012 IV.ORD.REC changes follow IV6 rules. Validate opening inventory values before cutover.
- Do not extract further. Retire after confirming IV6.24.

## 9. Questions for COO/CFO — consolidated

1. Should opening inventory values be re-costed, given that layers written under IV6 may be overstated for products that went negative? (IV6.16)
2. Is IV6 still on any menu? (IV6.24)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 0 | |
| SIMPLIFY | 0 | |
| OBSOLETE | 22 | 01–15, 17–23 |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 2 | 16, 24 |
| WAREHOUSE-ONLY | 0 | |

Total: 24 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Canonical | `IV.ORD.REC` | Successor |
| Sibling | `IV.ORD.REC.N`, `IV6.PO`, `IV.AUTO.ORDER` | Family |
| Program | `IV46`, `IV11.AUTO` | Chained |
| Subroutine | `IVPO.ON.ORD` | Open qty |
| Files | IVMST, IVPO, ORDER, RECLOG, POADJ, IVCAT, CONTROL, PGM.AUDIT | Shared with the whole family |

**Sibling-series flag:** Superseded predecessor of IV.ORD.REC (variant, not canonical). Candidate for OBSOLETE.
