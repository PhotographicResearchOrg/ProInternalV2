# IV.ORD.REC — Inventory ordering and receiving USING IVPO (RENAMED from IV6)

**Source program:** `BP/IV.ORD.REC`
**Domain:** Inventory
**Integration mode:** Interactive
**Lines of code:** 360
**Last code change:** 17 Feb 2012 (header line 3; last changelog entry 02-17-12 SJL)
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

## 1. Purpose — what this program does

This is the operator screen for vendor purchase orders. It has three options. Option 1 hands off to `IV46` (manual PO entry and change). Option 2 builds a PO from the `ORDER` work file. Option 3 receives goods against an existing PO, either the whole PO at once or product by product. Receiving updates the product's open-PO multivalues, its inventory cost layers and its last cost. It also appends receipt history to the PO, writes a receipt log, can cancel a backorder balance, and optionally chains to the automatic member-backorder run (`IV11.AUTO`). It does NOT calculate suggested order quantities (those arrive pre-computed in the `ORDER` file), assign PO numbers, set vendor due dates (`ORDDUE`), apply vendor discounts, or handle the 9999 vendor.

Canonical status: the header says it was renamed from `IV6`. Of the three IV6-family programs it carries the most changes, apart from `IV.ORD.REC.N` (24 May 2012), which adds a customs Entry-No. Which of the two is the cataloged, live program must be confirmed (see IV.ORD.REC.N).

## 1.5. Integration footprint

N/A — interactive. The `ORDER` file it consumes is an internal Computyme work file keyed by product number (written by `IV21` / `DH1`), not a filename-keyed external staging record.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master. Holds open-PO multivalues (attr 20–23), inventory cost layers (24–26) and last cost (28) | READ+WRITE |
| IVPO | Purchase order header and lines, one record per PO number | READ+WRITE |
| ORDER | Work file of products to order: key = product, attr 1 = quantity. Cleared after auto-creation | READ+WRITE (CLEARFILE) |
| RECLOG | Receipt log, one record per receipt line | WRITE |
| POADJ | PO quantity-cancellation log | WRITE |
| IVCAT | Vendor catalog number → product number cross-reference (attr 1 = product) | READ |
| CONTROL | System parameters: `YEN.CONV`, `ABO`, `BORUN`, `BATCH` | READ+WRITE |
| PGM.AUDIT | Program usage audit (record `IV6`) | READ+WRITE |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `EXECUTE 'RUN IVBP IV46'` | Option 1: manual PO entry and change (line 65). Not extracted here |
| `CALL IVPO.ON.ORD(ANS,QO,QR)` | Returns open quantity per PO line = ordered − SUM(received subvalues) (lines 187, 247) |
| `CALL IV.UPD.COGS(PROD,NEG.QOH,AVG)` | Restates profit (IVMST YPROF) on member sales billed while stock was negative (line 311) |
| `CHAIN 'RUN BP IV11.AUTO'` | Automatic member-backorder processing after receiving (line 100) |
| `CHAIN 'ABORT'` | Fatal error exit (lines 51, 53, 123) |
| `INCLUDE UTLBP I_GETWHO` | Sets `USER` (used in log keys). Not in BP — confirm |
| `INCLUDE FILE.INCLUDES IVMST.FIELDS` | EQUs for IVMST attribute names (e.g. `IVMST.LAST.COST`). Not in BP — confirm |

**Internal labeled sections (subroutine-like):**

| Internal label | Approximate lines | Called from |
|---|---|---|
| `130` Update receiving | 277–313 | 230 (manual), 242 (auto) |
| `140` Cancel backorder | 314–326 | 216 |
| `READU.IVMST` | 334–345 | 193, 238, 258 |
| `READU.IVPO` | 347–358 | 133, 262 |
| `UPD.AUDIT` | 327–332 | 90, 99, 102, 106, 112 |

## 4. Business rules — extracted

### 4.1 Identification & input validation

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.01 | The main menu has three options. 1 runs `IV46` (manual PO entry and change) and the program stops; 2 creates PO lines automatically; 3 receives goods. | 60–66, 171 | SIMPLIFY |
| IV.ORD.REC.02 | The operator types the PO number; this program never generates one. Allowed formats are 5 digits, 1 letter + 5 digits, or 5 digits + 1 letter (e.g. `12345`, `A12345`, `12345B`). | 130–132 | QUESTION |
| IV.ORD.REC.03 | Receiving requires the PO to already exist in IVPO ("Not a valid purchase order"). Auto-creation starts a new IVPO record when the number does not exist. | 133–139 | KEEP |
| IV.ORD.REC.04 | The order or receipt date is entered as MM.DD.YY and defaults to today. It must be a valid date and must not be in the future. There is no lower limit, so receipts can be back-dated any number of days. | 140–148 | QUESTION |
| IV.ORD.REC.05 | When receiving, the operator can enter a vendor catalog number. It is translated to a product through IVCAT attr 1, and anything not found there is treated as a product number. | 192 | KEEP |
| IV.ORD.REC.06 | A product can be received against a PO only if it exists in IVMST, the PO number is in the product's open-PO list (IVMST attr 20), and the product is a line on the PO (IVPO attr 6). Otherwise it is rejected with a specific message. | 193–205 | KEEP |
| IV.ORD.REC.07 | Receipt quantity must be a whole number. 0 or blank skips the product. `C` or `-` cancels the remaining backorder, after the operator types `YES` to confirm. | 209–224 | KEEP |
| IV.ORD.REC.08 | Over-receipt is allowed. If the quantity exceeds the remaining due (open + BO), the operator must re-key the same number to confirm, and there is no upper limit. | 225–229 | QUESTION |

IV.ORD.REC.02: The business must confirm the PO-number scheme for PIV2. Is the operator-typed 5-digit (+ optional letter) format still required, what does the letter prefix or suffix mean, and who assigns numbers today (IV46?).
IV.ORD.REC.04: Should back-dated receipts be limited, for example to the current open accounting period?
IV.ORD.REC.08: Should over-receipt still be accepted without limit, or should it require a tolerance or a supervisor?

### 4.2 Automatic PO creation (option 2)

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.09 | Auto-creation reads every record in the `ORDER` work file (key = product, attr 1 = quantity) and appends each product as a new line on the single PO number the operator entered. Products are not filtered by vendor, so the whole file goes onto one PO. | 253–268 | QUESTION |
| IV.ORD.REC.10 | A new PO header gets vendor = IVMST attr 5 (`VEND`, the PRO vendor group) of the first product processed, and PO date (IVPO attr 2) = the date entered. Later products never change the header. | 262–265 | QUESTION |
| IV.ORD.REC.11 | The line cost on a new PO is a snapshot of the product's current raw cost, IVMST attr 19 (`RAW`). It is copied to the product side (IVMST attr 22) and the PO side (IVPO attr 8) and is not recalculated later. | 261, 266 | KEEP |
| IV.ORD.REC.12 | The ordered quantity is taken unchanged from `ORDER` attr 1. This program does not check that it is numeric or positive and does not round it to case (IVMST 27), carton (33) or MOQ (16). The suggested quantity is calculated before this point (IV21/DH1, not extracted). | 257, 260, 266 | QUESTION |
| IV.ORD.REC.13 | Duplicates are not checked. If the product is already on the PO, a second line is appended to IVPO and the PO number appears twice in IVMST attr 20. | 260, 266 | QUESTION |
| IV.ORD.REC.14 | When the loop finishes, the whole `ORDER` file is cleared (`CLEARFILE`). Rows whose product was missing from IVMST are discarded with the rest. | 273 | QUESTION |
| IV.ORD.REC.15 | Every PO line is written twice: on the product (IVMST attr 20 PO no., 21 open qty, 22 unit cost, all multivalued) and on the PO (IVPO attr 6 product, 7 qty ordered, 8 cost). The two copies are maintained independently. | 260–268 | SIMPLIFY |

IV.ORD.REC.09: Should one PO always be for a single vendor? Today nothing stops mixed-vendor POs.
IV.ORD.REC.10: Should the PO vendor be the PRO vendor group (IVMST 5) or the actual AP vendor (IVMST 37 `A.VENDOR`)? The IVPO `VNAME` dictionary item translates attr 1 through APMST first and then VNMST, so the intended key is ambiguous.
IV.ORD.REC.12: The business must state the order-quantity rounding rule (case, carton, MOQ) for PIV2. It is not enforced here.
IV.ORD.REC.13: Should a product appear at most once per PO?
IV.ORD.REC.14: Is it acceptable that one shared `ORDER` file is wiped after each auto-creation, even when two buyers use it?

### 4.3 Receiving — quantities and PO status

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.16 | The quantity still due on a PO line is the product's open qty (IVMST attr 21) plus its BO qty (IVMST attr 23), both at that PO's position in attr 20. | 207, 241 | KEEP |
| IV.ORD.REC.17 | If receipt qty ≥ remaining due, the PO is removed from the product completely (attr 20–23 values at that position deleted). On a partial receipt, open qty (21) is blanked and BO qty (23) = remaining − received, so after the first partial receipt the whole balance is held as backorder. | 278–283 | KEEP |
| IV.ORD.REC.18 | Each receipt is appended to the PO line as a new subvalue: IVPO attr 9 = qty received, attr 11 = receipt date (the date entered), attr 12 = extended landed cost in USD cents. Partial receipts therefore build a history. | 307–308 | KEEP |
| IV.ORD.REC.19 | Automatic receiving walks every IVPO line and receives the full remaining due shown on the product. A line is skipped without notice if the product is missing or no longer has the PO in IVMST attr 20 (already received or cancelled). | 232–250 | KEEP |
| IV.ORD.REC.20 | The PO is marked closed (IVPO attr 13 = 1) when the sum of open quantities across all lines (ordered − SUM(received), via `IVPO.ON.ORD`) is exactly 0. This is checked when manual entry ends and after auto-receive. The flag is never set back to blank. | 186–188, 247–248 | QUESTION |
| IV.ORD.REC.21 | Cancelling the backorder removes the PO from the product (IVMST 20–23). It writes a POADJ record (attr 1 product, 2 qty cancelled = ordered − received, 6 PO), sets IVPO ordered qty (attr 7) = total received, and appends a zero receipt subvalue (qty 0, date, cost 0) to the line. | 314–326 | KEEP |

IV.ORD.REC.20: Closure is tested on the net total of all lines, so over-receipt on one line can hide a shortage on another. Should closure be decided line by line?

### 4.4 Receiving — cost source, currency, landed cost

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.22 | A cost value ending in `Y` is in whole yen per unit. With no `Y` it is USD cents per unit (MD2). The suffix is the only currency marker, and it travels with the cost from IVMST 19 to IVMST 22 and IVPO 8. | 284 (`INDEX(CST,'Y',1)`, `FIELD(CST,'Y',1)`) | QUESTION |
| IV.ORD.REC.23 | Receiving values goods at the product-side PO cost, IVMST attr 22, at that PO's position. The PO-side cost (IVPO attr 8) is not used, so a cost edited on only one side has no effect on valuation. | 207, 241 | QUESTION |
| IV.ORD.REC.24 | Extended receipt cost = unit cost (numeric part) × qty received. | 284 | KEEP |
| IV.ORD.REC.25 | Yen costs are converted to USD cents at receipt time, not at PO creation: `TCST = INT(TCST_yen / CONV × 10000 + 0.5)`, where CONV = yen per US dollar × 100 (e.g. 110.00 ¥/$ entered as 11000). | 285–287 | QUESTION |
| IV.ORD.REC.26 | For each PO received, the screen shows the last yen rate and its date (CONTROL `YEN.CONV` attr 1 date, attr 2 rate×100). The operator enters a new whole-number rate or presses Enter to keep the last one. A new rate overwrites CONTROL `YEN.CONV` with today's date. The prompt appears even when the PO has no yen items. | 150–161 | SIMPLIFY |
| IV.ORD.REC.27 | Landed-cost uplift: for each PO receiving session the operator enters "Pct of Additional Charges to Raw Cost" as a whole number ×100 (1200 = 12%). Every line received in the session gets `TCST += INT(TCST × PCT / 10000 + 0.05)`. | 162–168, 288 | QUESTION |
| IV.ORD.REC.28 | Last cost (IVMST `LAST.COST`, attr 28 per dictionary) is replaced on every receipt with the landed unit cost of that receipt, `INT(TCST / Q + 0.5)`, in USD cents. | 289 | KEEP |

IV.ORD.REC.22: Are any vendors still invoiced in yen? Are other currencies needed (CURRENCIES file exists but is not used here)?
IV.ORD.REC.23: Which copy of the PO cost is authoritative, the product-side or the PO-side?
IV.ORD.REC.25: Should the FX rate be locked at PO creation, at receipt (today's behaviour) or at vendor invoice?
IV.ORD.REC.27: How is the "additional charges" % (freight/duty/brokerage) decided? Should it stay a per-session operator entry, and is the `+0.05` rounding (effectively truncation) intended?

### 4.5 Inventory cost layers and cost of goods

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.29 | Inventory is held as cost layers on the product (IVMST attr 24 qty, attr 25 total value in USD cents, attr 26 date received). If the first layer's qty is > 0, each receipt appends a new layer (qty, landed extended cost, receipt date). | 298–299 | KEEP |
| IV.ORD.REC.30 | If the first layer's qty is ≤ 0 or empty (negative or no stock), the receipt merges into layer 1. Qty becomes neg + Q and the date becomes the receipt date. If the result is 0, layer 1 is deleted. Otherwise its value becomes `TCST − |negQOH| × LAST.COST`, which removes the units already sold from the received value. | 290–297 | KEEP |
| IV.ORD.REC.31 | When stock was negative before the receipt, `IV.UPD.COGS` is called with the negative qty and the new unit cost. It restates profit on member sales billed while stock was short, using the actual receipt cost. | 309–312 | QUESTION |

IV.ORD.REC.31: Finance must confirm that sales made while stock was negative should have their cost of goods restated at the later receipt cost, and how that should work in the new GL.

### 4.6 Receiving session, batch and logging

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.32 | Only one receiving session can run company-wide. Option 3 sets CONTROL `BATCH` attr 2 = `O`, and any other user who chooses option 3 while it is set gets "Someone else is receiving now". | 67–86 | SIMPLIFY |
| IV.ORD.REC.33 | Receipts are grouped by a batch number (CONTROL `BATCH` attr 1, starting at 1 if missing). When the session ends the operator is shown the batch number and told to record it. The number is then incremented and the open flag cleared. | 78, 85, 116–127 | QUESTION |
| IV.ORD.REC.34 | Each receipt line writes a RECLOG record. Key = receipt date*time*user*sequence. Fields: 1 product, 2 qty, 3 extended landed cost (USD cents), 4–5 empty, 6 PO, 7 batch, 8 last cost (cents). | 302–305 | KEEP |
| IV.ORD.REC.35 | Every program start and exit path appends date, time, port and message to PGM.AUDIT record `IV6`. | 327–332 and callers | SIMPLIFY |

IV.ORD.REC.33: What is the receiving batch number used for after the session (a paper reconciliation, AP matching)? Does PIV2 need it?

### 4.7 Backorder trigger after receiving

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.36 | On exit from the menu, if CONTROL `ABO` attr 1 ≠ 1 the program simply stops. If ABO = 1, something was received this session and today > the last backorder run date (CONTROL `BORUN` attr 1), then: if more than 3 days have passed since the last run, `IV11.AUTO` is chained automatically. Otherwise the operator is asked "Is this PROBABLY the last receiving for today" and Y chains `IV11.AUTO`. | 88–109 | QUESTION |

IV.ORD.REC.36: Should member backorders be released immediately on each receipt (event-driven) instead of as a daily batch? Is the 3-day forced-run threshold still wanted?

### 4.8 Concurrency / locking

| ID | Rule (plain English) | Source (line numbers) | Suggested tag |
|---|---|---|---|
| IV.ORD.REC.37 | The CONTROL `BATCH` lock is retried every 5 seconds up to 12 times (about 60 s), after which the program gives up with "try again later". | 68–77 | SIMPLIFY |
| IV.ORD.REC.38 | IVMST product reads wait for a lock indefinitely, retrying every 6 s (and an extra 6 s every 20 tries) and showing the user holding the lock. Locked and not-found are told apart correctly. | 334–345 | SIMPLIFY |
| IV.ORD.REC.39 | The IVPO record is locked the same way and stays locked for the whole interactive session on that PO, until the next PO prompt (`RELEASE` at line 115). | 347–358, 115 | SIMPLIFY |
| IV.ORD.REC.40 | Log records (RECLOG, POADJ) are locked on their new key before writing, to avoid a same-second key collision. | 304, 321 | SIMPLIFY |

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| `'5N'`, `'1A5N'`, `'5N1A'` | Other (format) | 130 | PO number format | QUESTION |
| CONTROL `YEN.CONV` | Other (control key) | 53, 150–160 | Last yen rate: attr 1 date, attr 2 rate ×100 | QUESTION |
| CONTROL `ABO` | Other (control key) | 54, 89 | Auto-backorder enabled flag (1 = on) | QUESTION |
| CONTROL `BORUN` | Other (control key) | 55, 93–94 | Date of last backorder run | QUESTION |
| CONTROL `BATCH` | Other (control key) | 70–85, 121–126 | Receiving batch number and in-use flag `O` | QUESTION |
| 3 (days) | Threshold | 94 | Force backorder run if last run > 3 days ago | QUESTION |
| 12 × 5 s | Threshold | 73–74 | Batch lock wait limit | QUESTION |
| 6 s / 20 | Threshold | 341–342, 354–355 | Lock retry cadence | QUESTION |
| 10000 | Magic-number | 286, 288 | Scale factor for rate ×100 and pct ×100 to cents | QUESTION |
| 0.05 | Magic-number | 288 | Rounding addend for landed % (should probably be 0.5) | QUESTION |
| `'IV6'` | Other | 328, 331 | PGM.AUDIT key (inherited from IV6) | QUESTION |
| `IV46`, `IV11.AUTO` | Other (program) | 65, 100 | Chained programs | QUESTION |

No customer-specific or vendor-specific identifiers found (no member, vendor or product numbers).

## 6. Data shape — record layouts referenced

### IVMST (read into matrix M, DIM 30; attributes > 30 are packed into M(30))

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 4 | DESC | Display description | — | |
| 5 | VEND / PVEND | Vendor copied to new PO header | — | PRO vendor group (VNMST). Not A.VENDOR (37) |
| 19 | RAW | Raw cost copied as PO cost | USD cents (MD2) **or** whole yen with `Y` suffix | Overloaded currency |
| 20 | PO.NO | Open PO numbers (MV) | — | Parallel MV with 21–23 |
| 21 | PO.QTY | Open qty not yet partially received (MV) | units | Blanked after first partial receipt |
| 22 | PO.CST | Unit cost for this PO (MV) | USD cents or whole yen + `Y` | **Valuation source at receipt** |
| 23 | BO | Remaining backorder qty after partial receipt (MV) | units | **Overloaded historically:** held the PO date in the IV6.PO era (see BLD.IVPO.03) |
| 24 | QTY.REC | Cost-layer qty on hand (MV) | units | First layer can be negative |
| 25 | AMT.REC | Cost-layer total value (MV) | USD cents | Always converted to USD |
| 26 | DATE.REC | Cost-layer date (MV) | Pick date | |
| 28 | LAST.COST (`IVMST.LAST.COST` EQU) | Last landed unit cost | USD cents | EQU from FILE.INCLUDES IVMST.FIELDS — attr number assumed from dictionary, confirm |

### IVPO (matrix PO, DIM 30)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 1 | VEND | PO vendor | — | Set once from first product |
| 2 | DATE | PO date | Pick date | Dictionary `DATE` (PO-Date, D2/) |
| 6 | PROD | Line product (MV) | — | |
| 7 | QTY.ORD | Line ordered qty (MV) | units | Reduced to qty received on BO cancel |
| 8 | COST | Line unit cost (MV) | USD cents or whole yen + `Y` | Not used for valuation |
| 9 | QTY.REC | Qty received (MV, SV per receipt) | units | |
| 11 | DT.RECD | Receipt date (MV, SV per receipt) | Pick date | |
| 12 | COST.REC | Extended landed cost per receipt (MV, SV) | USD cents | **Overloaded:** BLD.IVPO and IV6.PO write a single PO total here, possibly yen-suffixed |
| 13 | RECD | Closed flag | 1 / blank | |

### ORDER (work file)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| @ID | — | Product number | — | |
| 1 | — | Qty to order | units | Producer: IV21 / DH1 |

### RECLOG (written)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| @ID | — | receiptdate*time*user*seq | — | Date is the operator-entered receipt date |
| 1 | PROD | Product | — | |
| 2 | QUAN | Qty received | units | |
| 3 | AMOUNT | Extended landed cost | USD cents | |
| 6 | PO | PO number | — | |
| 7 | BATCH | Receiving batch | — | |
| 8 | LAST.COST | Landed unit cost | USD cents | |

### POADJ (written)

| Attr # | EQU name | Used as | Units | Notes |
|---|---|---|---|---|
| @ID | — | date*time*user*seq | — | |
| 1 | PROD | Product | — | |
| 2 | QUAN | Qty cancelled | units | |
| 6 | PO | PO number | — | |

### CONTROL records

| Record | Attr | Used as | Units | Notes |
|---|---|---|---|---|
| YEN.CONV | 1 | Date rate entered | Pick date | |
| YEN.CONV | 2 | Yen per USD ×100 | integer | 11000 = 110.00 ¥/$ |
| ABO | 1 | Auto-backorder flag | 1 = on | |
| BORUN | 1 | Last BO run date | Pick date | Written by IV11.AUTO (assumed) |
| BATCH | 1 / 2 | Batch number / `O` = in use | — | |

## 7. Bug suspects

- **PO closure nets across lines (186–188, 247–248):** `SUM(ANS)=0` adds up the open quantities of all lines. A PO with one line over-received by 2 and another short by 2 is marked closed, and a PO with any over-receipt and nothing else open never closes, because the sum goes negative.
- **No transactional guard on receipt (277–313, 186–189):** IVMST (stock, layers, last cost) and RECLOG are written per product immediately, but in manual receiving the IVPO record (attr 9/11/12/13) is written only when the operator ends product entry. A dropped session leaves stock received with no PO receipt history.
- **Auto-create writes IVPO before IVMST (267–268):** a failure between the two writes leaves the line on IVPO with no matching IVMST on-order.
- **Duplicate PO lines (260, 266):** auto-create does not check whether the product is already on the PO. `LOCATE` at 198/202 then always finds the first occurrence, so the duplicate line can never be received manually.
- **COGS over-correction on partial cover (290–297, 309–312):** if the receipt does not fully cover the negative stock (e.g. −10 on hand, 3 received), `IV.UPD.COGS` is still called with the full −10. The next receipt calls it again with −7, so profit is restated for 17 units against 10 sold.
- **Possible divide-by-zero (289, 311):** in auto-receive, `Q=QTY`. If IVMST 21+23 is 0 or blank while attr 20 still holds the PO, `TCST/Q` divides by zero.
- **Landed % rounding (288):** `INT(x + .05)` is effectively truncation, not rounding to the nearest cent. The `X=` assignment on the same line is unused (dead code).
- **Yen rate prompted even with no yen items (150–161):** pressing Enter is safe, but any typed value overwrites the company-wide rate.
- **Batch flag never cleared on abnormal exit (83–84, 121–126):** CONTROL `BATCH` attr 2 = `O` is cleared only on the normal END path from the PO prompt. A disconnect or `CHAIN 'ABORT'` (line 123) blocks all receiving until someone edits CONTROL by hand.
- **Exit via the option prompt without END at PO prompt (88–109):** if the operator ends at the option prompt during a type-3 session without first ending at the PO prompt, the batch is not incremented or released.
- **`ABO`/`BORUN` read failures only print (54–55):** the program continues with unassigned variables.
- **PGM.AUDIT record `IV6` grows without bound (327–332):** values are appended forever to one record.
- **`SEQ` is never initialised (302, 319):** UniVerse treats it as 0 with a warning. Harmless, but flag it.
- **READU/MATREADU silent-fallthrough:** not present in this program. Both lock loops use `LOCKED` clauses and tell locked apart from not-found correctly.

## 8. Schema-design notes for the CTO

- Entities: Purchase Order (header), PO Line, PO Receipt (per partial receipt), PO Line Cancellation, Inventory Cost Layer, Product Last Cost, FX Rate, Receiving Batch, Backorder-run trigger.
- The PO line is stored twice (IVMST 20–23 and IVPO 6–8). PIV2 should keep one PO line table, with product on-order derived from it (`SUM(ordered − received − cancelled)` on open lines).
- IVMST 21 vs 23 (open vs BO) is a state machine squeezed into two columns. Model it as line qty ordered / received / cancelled plus a status.
- Currency is a `Y` suffix inside a cost string. Split it into amount + currency code, and record the FX rate used on each receipt (today only the latest rate is kept in CONTROL, so history is lost).
- The landed-cost % is not stored anywhere. Only the uplifted total in IVPO 12 / RECLOG 3 survives, so the raw vendor cost cannot be rebuilt. Store vendor cost, landed charges and rate separately per receipt.
- No average cost is maintained. Receiving does not touch IVMST 8 (`COST`/`NET.1`) or 19 (`RAW`). Valuation is by layers (24–26) plus last cost (28). Finance must choose layer/FIFO, weighted average or standard for PIV2.
- Missing audit: who received (only in the RECLOG key), the FX rate and % used, the reason for over-receipt, who cancelled a backorder (POADJ has only the key user), and the vendor packing slip / invoice number.
- IVPO 12 is overloaded (PO total in BLD.IVPO/IV6.PO vs per-receipt subvalues here). Reconcile the data before migration.
- Extract these before any PO schema commit: `IV46` (manual PO entry/change, numbering, vendor), `IV46.9999` (9999 vendor info, IVPO 17), `IV21` and `DH1` (suggested order quantity → ORDER file), `IV11.AUTO` (backorder release), `IV.UPD.COGS`, `ORDUP1` / `WHSE.DUE` (ORDDUE due dates), `UPD.IVMST.QREC`.

## 9. Questions for COO/CFO — consolidated

1. What is the PO-number scheme going forward, and what do the letter prefix and suffix mean? (IV.ORD.REC.02)
2. Should back-dated receipts be limited? (IV.ORD.REC.04)
3. Is unlimited over-receipt acceptable? Should it need a tolerance or approval? (IV.ORD.REC.08)
4. Must a PO be limited to a single vendor? (IV.ORD.REC.09)
5. Is the PO vendor the PRO vendor group or the AP (actual) vendor? (IV.ORD.REC.10)
6. What rounding (case, carton, MOQ) applies to order quantities? (IV.ORD.REC.12)
7. May a product appear more than once on a PO? (IV.ORD.REC.13)
8. Can the shared ORDER work list be replaced by per-buyer or per-vendor drafts? (IV.ORD.REC.14)
9. Should PO closure be decided line by line? (IV.ORD.REC.20)
10. Are yen (or other foreign-currency) vendors still active? (IV.ORD.REC.22)
11. Which PO cost is authoritative, product-side or PO-side? (IV.ORD.REC.23)
12. At what point is the FX rate fixed: PO, receipt or invoice? (IV.ORD.REC.25)
13. How are additional landed charges decided and allocated, and is truncation acceptable? (IV.ORD.REC.27)
14. Should COGS still be restated for sales made while stock was negative? (IV.ORD.REC.31)
15. What is the receiving batch number used for? (IV.ORD.REC.33)
16. Should backorder release run per receipt instead of as a daily batch? Keep the 3-day rule? (IV.ORD.REC.36)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 15 | 03, 05, 06, 07, 11, 16, 17, 18, 19, 21, 24, 28, 29, 30, 34 |
| SIMPLIFY | 9 | 01, 15, 26, 32, 35, 37, 38, 39, 40 |
| OBSOLETE | 0 | |
| OBSOLETE-INTEGRATION | 0 | |
| QUESTION | 16 | 02, 04, 08, 09, 10, 12, 13, 14, 20, 22, 23, 25, 27, 31, 33, 36 |
| WAREHOUSE-ONLY | 0 | |

Total: 40 rules.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling | `IV6` | Predecessor (2007); this program is "RENAMED from IV6" |
| Sibling | `IV.ORD.REC.N` | Later variant (24 May 2012): adds customs Entry-No and a screen UI |
| Sibling | `IV6.PO` | Older 2002 variant, non-functional (see its extraction) |
| Sibling | `IV.AUTO.ORDER` | Stand-alone copy of option 2 |
| Program | `IV46`, `IV46.9999` | Option 1: manual PO entry; 9999 vendor info |
| Program | `IV21`, `DH1` | Write the `ORDER` work file (suggested quantities) |
| Program | `IV11.AUTO` | Backorder release chained after receiving |
| Subroutine | `IVPO.ON.ORD` | Also used by IVPO dict items `ON.ORD`, `OPEN.QUAN` |
| Subroutine | `IV.UPD.COGS` | Updates IVMST YPROF and ARMST profit from SCANORD |
| File | IVPO | Shared with BLD.IVPO, FIX.IVPO, FIX.PO.CST, FIX.TPOCST, PO.DISC, IV7 |
| File | IVMST 20–26 | Shared with IV7 (adjustments), PO.DISC (reconcile), FIX.PO.CST |
| File | RECLOG | Read by FIX.IVPO |
| File | POADJ | Also written by IV6 |
| Domain crossover | AR / Members | Backorder release (IV11.AUTO) and COGS restatement on member invoices (SCANORD/ARMST) |

**Sibling-series flag:** part of the IV6 family (`IV6` → `IV.ORD.REC` → `IV.ORD.REC.N`, plus `IV6.PO` and `IV.AUTO.ORDER`). This appears to be the canonical receiving logic. `IV.ORD.REC.N` is newer and may be the cataloged version, so confirm which one VOC points to.
