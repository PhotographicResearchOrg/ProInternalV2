# D_IVMST — Pricing formulas in the product-master dictionary (I-descriptors)

**Source program:** `BP/D_IVMST` (UniVerse dictionary of IVMST). Also scanned: `D_IVPO`, `D_MAP.PRICE`, `D_PRICE.CHA000` (the PRICE.CHANGES dictionary; there is no file named `D_PRICE.CHANGES`), `D_VNMST`, `D_APMST`, `D_CURRENCIES`, `D_CONTROL`, `D_PMCSELL`, `D_TERMSDATA`, `D_IVMST.SALE`, `D_TEMP`, `D_SCANORD`, `D_ORDHIST`, `D_IVORD`, `D_NUMBER`, `D_RECLOG`, `D_VENDRA`, `D_VENDRET`, `D_ORDER`, and the variant dictionaries `ORIGINAL-D_IVMST`, `D_IVMST_BU`, `D_IVMSTLD`, `D_IVMST.DISC`, `D_IVMST.AUX`. Supporting BASIC read for meaning: `MONEY.CONV`, `INP.YEN.CONV`, `IV6`, `IV.ORD.REC(.N)`, `IV8`.
**Domain:** Products
**Integration mode:** Report/print (dictionary I-descriptors evaluated by LIST/SORT reports and any query tool). No BASIC program in the dump calls these pricing items by name, so they are used by saved reports or by people at TCL.
**Lines of code:** N/A (dictionary). D_IVMST holds 625 item records: 589 distinct item names, 454 I-type items (after removing identical duplicates), 138 D-type items, 16 PH phrases.
**Last code change:** Not recorded in a dictionary. The only dated hint is the item description on `AUS.COST`/`AUSCOST`: "* CHANGED TRANS(F1 TO F2 for Geoff".
**Extraction author:** Claude (assisted) · Mark (commit owner)
**Extraction date:** 2026-10-22
**Status:** ⏳ Awaiting CTO classification

> **How the file was read.** `D_IVMST` is a binary UniVerse hashed file, not plain text. Each item is a record: a 12-byte header, the item ID, then attributes separated by `xFE` (value marks `xFD`). For I-types: attr 1 = `I` + optional description, attr 2 = formula, attr 3 = output conversion, attr 4 = column heading, attr 5 = format, attr 6 = S/M. Compiled object code follows, and it was ignored. **35 item IDs appear twice in the hashed file** (old copies not yet reclaimed). Where the two copies differ in a way that affects pricing (`AUSCOST`, `AVG.REC`), both are given. Which copy is live cannot be told from the bytes. Confirm with `LIST DICT IVMST AUSCOST AVG.REC` on the live system.
>
> **Rule IDs.** Rules from D_IVMST are `D_IVMST.NN`. Rules found in other dictionaries use that dictionary's name (`D_SCANORD.NN`, and so on). The "Source" column gives dictionary item names instead of line numbers.

## 1. Purpose — what this program does

D_IVMST defines named calculated columns over the product master. People use them in ad-hoc reports to show member cost including the surcharge, quantity-break and customer-list prices, MAP-based sell prices, margins, inventory and open-PO valuations, and USD/AUD landed cost for products bought in yen or RMB. Nothing is stored: every value is recalculated each time from IVMST fields, CONTROL records (exchange rates) and lookups into other files. Billing does **not** use these items. The order programs work the price out again themselves (for example, IV8 rounds the surcharged price with `INT((1+PCT/1000)*NET.1+.5)`). The dictionary is still the most complete written statement of how PRO turns raw cost into sell prices.

## 1.5. Integration footprint

N/A — dictionary items, no staging records. The only staging-like items are `TEMP.*` (rule D_IVMST.58) and `D_TEMP` (D_TEMP.01). They read price loads from a scratch `TEMP` file.

## 2. Files (tables) read or written

| File | Role (best guess; confirm) | Access (READ / WRITE / READ+WRITE) |
|---|---|---|
| IVMST | Product master; base fields for every formula | READ |
| CONTROL | Exchange rates (`YEN`, `RMB`, `YEN.CONV`, `AUS.YEN`, `AUS.RMB`, `AUS.YEN.CONV`, `AUS.RMB.CONV`), current month (`UPD`), customer-list surcharge (`CL.SURCHG`, from D_ORDHIST) | READ (via TRANS) |
| APMST | AP ("actual") vendor: name, `MISC` = "IMPORT" flag | READ (via TRANS) |
| BRANDS | Brand name, used to recognise house brand PROMASTER | READ (via TRANS) |
| PMCSELL | Manual sell-price override per product (`SELL`, attr 1, cents) | READ (via TRANS) |
| TERMSDATA | Per-product terms/discount data (`PERC`, `FTR`, `CSPK`, `OPCT1–15`, …) | READ (via TRANS) |
| PHYSLOG | Physical count quantities (valuation of counted stock) | READ (via TRANS) |
| IVMST.BU | Backup copy of IVMST (MAP before a change) | READ (via TRANS) |
| TEMP | Scratch file used for price loads (F1 raw, F2 net-1, F3 MAP) | READ (via TRANS) |
| VNORD | Vendor-order buckets keyed `<vendor-group><order>` (from D_IVORD) | READ (via TRANS) |
| ARMST | Member type `TP` (type 7 gets the customer-list price, from D_SCANORD) | READ (via TRANS) |
| CURRENCIES | Currency table (`CONVERSION` attr 4, `PRIOR.CONV` attr 8) | **Not referenced** by any I-descriptor or BASIC program in the dump. Purpose unclear from this dictionary — confirm. |

## 3. External subroutines / chained programs called

| Subroutine or program | Used for |
|---|---|
| `SUBR('-DIVS' / '!MULS' / '!ADDS' / '-ADDS' / '-FIELDS' / '-NES' …)` | UniVerse built-in multi-value arithmetic (per-value divide, multiply, add, field-split, not-empty). Not PRO code. |
| `SUBR('*pro*VNORD.AQUAN', PROD)`, `SUBR('*pro*IVM.OPEN.ORD', PROD)`, `SUBR('*pro*IVM.YTD.SOLD', PROD)` | Quantity look-ups (not pricing). Listed only for completeness. |
| `MONEY.CONV` (BASIC, not called by the dictionary) | Program-side currency conversion. Shown for comparison: it uses `YEN.CONV` attr 2 for suffix `Y` and `RBI.CONV` attr 2 for suffix `R`. |

**Internal labeled sections:** N/A — dictionary items, no labels.

## 4. Business rules — extracted

Formulas, plain-English translations and SQL for every item are in **Appendix F**, keyed by rule ID. The tables below are the rule register.

### 4.1 Raw cost and currency

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.01 | RAW (attr 19) is one string that carries both the amount and the currency. Digits only = **US cents**. A `Y` anywhere = **foreign currency**. Formulas detect it with `COUNT(RAW,'Y')` or `INDEX(RAW,'Y',1)` and read the amount either with `OCONV(RAW,'MCN')` (keeps every digit and drops a decimal point) or with `FIELD(RAW,'Y',1)` (keeps the text before the Y). | YRAW, USACOST, AUS.COST, OPEN.VALUE, VEND.VALUE, REPRICE, VNDAVG, ORD.VALUE | SIMPLIFY |
| D_IVMST.02 | Which foreign currency a `Y` means is decided in two incompatible ways. (a) **Always yen:** YRAW, AVG, AVG.REC, AVG.ERR, OPEN.VALUE, VEND.VALUE, REPRICE. (b) **Country of origin (attr 52):** COO `J` = yen, COO `C` = RMB. Used by USACOST, OPEN.VALUE.2, AUS.COST, AUSCOST, TEST.YEN. The BASIC subroutine `MONEY.CONV` uses a third convention: suffix `R` = RMB. | as listed | QUESTION |
| D_IVMST.03 | **Raw cost in US cents** (YRAW): a yen RAW is converted with `digits × 10000 / CONTROL YEN.CONV attr 2`. Attr 2 is yen per US$ with 2 implied decimals (15000 = ¥150.00/$; confirmed by IV6 lines 137–146). A USD RAW passes through unchanged. | YRAW | KEEP |
| D_IVMST.04 | **Product group 19 exception:** for GRP = 19 the yen conversion multiplies by 1000 instead of 10000, so the result is one-tenth. Probably group-19 yen costs are keyed with one decimal (MCN drops the point). | YRAW | QUESTION |
| D_IVMST.05 | **US landed cost** (USACOST): yen RAW (COO J) × CONTROL `YEN` F1 × 100, or RMB RAW (COO C) × CONTROL `RMB` F1 × 100, then **÷ 0.82**. USD RAW is also ÷ 0.82. So landed cost = converted cost × 1.2195 for every product. | USACOST | QUESTION |
| D_IVMST.06 | **Australian cost** (AUS.COST / AUSCOST): RMB or yen RAW is converted with CONTROL `AUS.RMB.CONV` / `AUS.YEN.CONV` **attr 3**, then ÷ 0.82. Two live-looking copies of AUSCOST disagree: one **divides** by the rate, the other **multiplies**. AUS.COST divides. A USD RAW is only ÷ 0.82 and is **never converted to AUD**. The description says "changed F1 to F2", but both formulas read F3. | AUS.COST, AUSCOST (×2) | QUESTION |
| D_IVMST.07 | Test and scratch conversions that should not be rebuilt: TEST.YEN (AUS rates F1, ÷1), AUS.YEN.S1 (raw digits × 100), AUS.YEN.S2 (× CONTROL `AUS.YEN` F1). | TEST.YEN, AUS.YEN.S1, AUS.YEN.S2 | OBSOLETE |
| D_IVMST.08 | Exchange-rate display items. Each one shows a CONTROL rate: `YEN` F1, `RMB` F1, `AUS.YEN.CONV` F2 and F3, `AUS.RMB.CONV` F2 and F3. The item named **YEN.CONV actually reads CONTROL `AUS.YEN` F1**, not the `YEN.CONV` record. | YEN, RMB, AUS.YEN, AUS.RMB, RMB.AUS, RMB.CONV, YEN.CONV | SIMPLIFY |
| D_IVMST.09 | **Yen reprice at a fixed rate** (REPRICE): yen amount × 100 / **155** × **1.3455** → cents. The description says "15% plus 17%" (1.15 × 1.17 = 1.3455). REPRICE1 then rounds **up** to the next 5¢ (`((INT((x−1)/5))+1)*5`). For non-yen products REPRICE returns 0 and REPRICE1 returns 5¢. | REPRICE, REPRICE1 | QUESTION |
| D_IVMST.10 | **Sale price from raw** (SALE1): RAW × **1.45**, rounded to a 5¢ step: add 3¢, truncate, then floor to a multiple of 5. | SALE1 | QUESTION |
| D_IVMST.11 | Hard-coded **7.0687** conversion (looks like an RMB/US$ rate). SJL multiplies by it and YEN.TEST divides by it, so they disagree. Test items. | SJL, YEN.TEST | OBSOLETE |

QUESTION D_IVMST.02: For PIV2, what defines a product's cost currency: an explicit currency code, the country of origin, or the `Y`/`R` suffix? Today all three are used.
QUESTION D_IVMST.04: Why does product group 19 use 1000 instead of 10000? Are group-19 yen costs keyed with one decimal?
QUESTION D_IVMST.05: What is the 0.82 divisor (≈ +21.95%)? Duty + freight landed-cost factor, a margin target, or something else? Should it differ by country or vendor?
QUESTION D_IVMST.06: Is AUD landed cost still produced? If yes, which AUSCOST copy is live (÷ or ×), which CONTROL attribute is current (F2 or F3), and should USD-cost products be converted to AUD?
QUESTION D_IVMST.09: Is the ¥155 / ×1.3455 reprice still used to set prices for yen products? What are the 15% and 17% components?
QUESTION D_IVMST.10: Is "raw × 1.45 rounded to 5¢" a current price rule (e.g. a sale or web price)?

### 4.2 Member price ladder and surcharge

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.12 | **Member cost including surcharge = Price-1 × (1 + PCT/1000)**. NET.1 (attr 8, cents) is the member price before surcharge. PCT (attr 12) is the product surcharge in **tenths of a percent** (60 = 6.0%). The dictionary keeps full precision; MD2 output rounds to cents. IV8 (billing re-price) rounds half-up: `INT((1+PCT/1000)*NET.1+.5)`. | COST.1, N1WSC, WCOST | KEEP |
| D_IVMST.13 | The same surcharge applies to Price-2 and Price-3: NET.2 × (1+PCT/1000) and NET.3 × (1+PCT/1000). | COST.2, N2WSC, COST.3, N3WSC | KEEP |
| D_IVMST.14 | **Price-3 takes precedence:** SCOST = surcharged NET.3 when NET.3 ≥ 1 cent, otherwise surcharged NET.1. | SCOST | QUESTION |
| D_IVMST.15 | Display formatting: surcharged and unsurcharged Price-1 above $999.99 are shown as whole dollars with commas (rounded). Below that, they are shown with cents. | DHCOST, DHNET | SIMPLIFY |
| D_IVMST.16 | **Customer-list price = Price-1 × 1.05** (CL.NET unrounded; CL.NET.1 rounded half-up to the cent). In order files this applies to member type 7 (D_SCANORD.02). D_ORDHIST uses a CONTROL rate instead of 5% (D_ORDHIST.01). | CL.NET, CL.NET.1 | QUESTION |
| D_IVMST.17 | **Quantity-price saving:** SAVE = NET.1 − NET.2 (cents). PCT.SAVE = saving ÷ NET.1 in tenths of a percent. (When NET.2 applies: D_SCANORD.01.) | SAVE, PCT.SAVE | KEEP |
| D_IVMST.18 | **Drop-ship charge as a percent of Price-1:** DS.CHG (attr 59, cents) × 1000 ÷ NET.1, in tenths of a percent. | DS.DIFF | KEEP |
| D_IVMST.19 | **Suggested new prices from average cost:** new member cost = average receipt cost × **1.07**. New Price-1 = average cost × 107 / **101**, which is the new member cost backed out of an assumed 1.0% surcharge. No zero-stock guard. | MCOST.1, MNET.1 | QUESTION |

QUESTION D_IVMST.14: What is Price-3 for (promo, web, special customer)? Does it always override Price-1 when set?
QUESTION D_IVMST.16: Is the customer-list uplift a fixed 5% or the CONTROL `CL.SURCHG` value? Is it limited to member type 7?
QUESTION D_IVMST.19: Is "average cost + 7%" still the pricing target, and does the 1.01 assume every product carries a 1.0% surcharge?

### 4.3 Vendor-group terms (formulas with hard-coded vendor groups)

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.20 | **Net/net cost:** surcharged Price-1 × **0.92** for vendor groups 479 and 497. × **0.99** for every other vendor. | NETNET | QUESTION |
| D_IVMST.21 | **"6% net/net":** surcharged Price-1 × **0.88** for 479/497, × **0.99** otherwise. | DNETNET | QUESTION |
| D_IVMST.22 | **RAL net/net:** surcharged Price-1 × **0.90** for 479/497, × **0.97** otherwise. | RALNET | QUESTION |
| D_IVMST.23 | **Dating terms:** products of vendor groups 479 and 497 have "dating" (DATING = `Y`; QTR = `YES`/`NO` with the heading DATING). | DATING, QTR | QUESTION |
| D_IVMST.24 | **Terms % (TERMS2):** 0 for vendor groups 700, 992, 999, 900. **6** for all others. The older copy in D_IVMSTLD lacks 900, so 900 was added later. | TERMS2 | QUESTION |
| D_IVMST.25 | **Prompt-pay terms (PTERMS):** "0" for vendor groups 700, 992, 900. **"2"** for all others. Vendor 999 is **not** excluded here, unlike TERMS2. | PTERMS | QUESTION |

QUESTION D_IVMST.20–22: What do NETNET / DNETNET / RALNET mean to the business? Who uses them? Are 0.92/0.88/0.90 and 0.99/0.97 still right? For 479/497, 0.92 equals TERMS2 6% + PTERMS 2% exactly, but that does not explain 0.99 for other vendors.
QUESTION D_IVMST.23: Which dating terms (days, seasons) apply to groups 479/497, and are they stored anywhere besides this hard-code?
QUESTION D_IVMST.24/25: Confirm terms % per vendor group, and whether 999 should be in PTERMS's exclusion list.

### 4.4 Vendor-specific exceptions (hard-coded vendor numbers)

IVMST attr 5 (`VEND`/`VENDOR`/`PVEND`) is the **PRO vendor group** (VNMST key). The groups below are buckets, not single suppliers. The real supplier is attr 37 `A.VENDOR`/`AVEND` (APMST). Labels come from the `V.TYPE` items in D_NUMBER, D_PL.XLS, D_SCANORD, D_VNORD, D_RECV.LOG and D_P65LABELS.

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.26 | **Vendor group 479** ("BAG-TRPD" / "BT", bags and tripods). Gets net/net 92% (NETNET), 88% (DNETNET), 90% (RALNET), dating = Y, terms 6, prompt-pay 2. It is also a VNORD order bucket (D_IVORD.01). | NETNET, DNETNET, RALNET, DATING, QTR; V.TYPE (6 dicts); D_IVORD TEST | QUESTION |
| D_IVMST.27 | **Vendor group 497** ("MISC-MDS" / "MM", miscellaneous merchandise). Same treatment as 479 in every formula. Also a VNORD bucket. | same as .26 | QUESTION |
| D_IVMST.28 | **Vendor group 700** ("PRO-FILM" / "PF"). Terms 0 (TERMS2) and prompt-pay 0 (PTERMS). Net/net 99%/99%/97% like ordinary vendors. Also a VNORD bucket. | TERMS2, PTERMS; V.TYPE; D_IVORD TEST | QUESTION |
| D_IVMST.29 | **Vendor group 900** ("LTL-MDS" / "LT" in D_NUMBER, D_PL.XLS and D_SCANORD; **"DR"** in D_VNORD, D_RECV.LOG and D_P65LABELS). Terms 0, prompt-pay 0. Added to TERMS2 after the D_IVMSTLD copy. Also a VNORD bucket. | TERMS2, PTERMS; V.TYPE; D_IVORD TEST | QUESTION |
| D_IVMST.30 | **Vendor group 992** ("CAM-MEM" / "CM", camera memory). Terms 0, prompt-pay 0. Also a VNORD bucket. | TERMS2, PTERMS; V.TYPE; D_IVORD TEST | QUESTION |
| D_IVMST.31 | **Vendor group 999**: terms 0 in TERMS2 **only**. It gets prompt-pay 2 (PTERMS), has no V.TYPE label and is not a VNORD bucket. | TERMS2 | QUESTION |
| D_IVMST.32 | **AP vendor 2869:** any product whose brand name is `PROMASTER` reports AP vendor **2869**, whatever is stored in A.VENDOR. | VBRAND | QUESTION |

QUESTION D_IVMST.26–31: For each group, confirm what it represents today and which terms it carries. In PIV2 these should be attributes of the vendor (group), not code.
QUESTION D_IVMST.29: Is 900 LTL merchandise or drop/drone-ship ("DR")? CONTROL has a DRONE-SHIP surcharge (D_CONTROL attr 8 `DRNSHP`).
QUESTION D_IVMST.31: What is vendor group 999, and why is it in TERMS2 but not PTERMS?
QUESTION D_IVMST.32: Is 2869 the AP vendor for all ProMaster-brand goods? Should PIV2 enforce A.VENDOR = 2869 for brand PROMASTER instead of overriding it in a report?

### 4.5 Product-group rules (hard-coded group numbers)

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.33 | **Product group 19** uses a yen scale factor of 1000 instead of 10000 when RAW is converted to US cents. See D_IVMST.04 for the formula rule. | YRAW | QUESTION |

QUESTION D_IVMST.33: What is product group 19, and does it still have yen-cost products?

### 4.6 MAP and retail-based sell price

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.34 | **Calculated sell price (PMCCALC) = MAP × 1.10, capped at Retail × 0.95.** If MAP is blank or zero (MAP × 1.10 < 1¢), or MAP × 1.10 ≥ Retail × 0.95, the price is Retail × 0.95. | PMCCALC | QUESTION |
| D_IVMST.35 | **Manual override wins:** the sell price is PMCSELL.SELL (cents) when a PMCSELL record exists, otherwise PMCCALC. | PMCSELL | KEEP |
| D_IVMST.36 | Older version of PMCCALC: MAP × 1.10 when MAP ≥ 1¢, else Retail × 0.95, with no cap. D_IVMSTLD has MAP × **1.15**. | PMCCALC.OLD | OBSOLETE |
| D_IVMST.37 | **MAP margin** = (MAP − Price-1) ÷ MAP in tenths of a percent. Blank when MAP ≤ Price-1. `COST` here is IVMST attr 8 = NET.1, not surcharged cost. D_MAP.PRICE has the same formula (D_MAP.PRICE.01). | MAP.MARGIN | KEEP |
| D_IVMST.38 | **Retail value of stock** = (MAP if set, else Retail) × units on hand. MAP is the preferred retail figure. | T.RETAIL | KEEP |
| D_IVMST.39 | Display and backup helpers: WMAP shows blanks for an empty MAP. MAP.BU reads MAP from the IVMST.BU backup file. | WMAP, MAP.BU | OBSOLETE |

QUESTION D_IVMST.34: What is "PMC" (a channel, customer or price list)? Are 110% of MAP and 95% of Retail current policy, and who maintains the PMCSELL overrides?

### 4.7 Margin and profit

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.40 | **Base profit** = Price-1 − RAW (cents). This is wrong for yen/RMB products: a RAW containing `Y` is non-numeric, which UniVerse treats as 0. | BASE.PROFIT | KEEP |
| D_IVMST.41 | **Markup over last cost** = (Price-1 − LAST.COST) ÷ LAST.COST in tenths of a percent. LAST.COST is attr 28, which is also FILM.PK (overloaded). | PERC | KEEP |
| D_IVMST.42 | **Margin** = (surcharged Price-1 − average receipt cost) ÷ surcharged Price-1, in tenths of a percent. 0 when there is no Price-1. Blank when there is no stock. | MARGIN | KEEP |
| D_IVMST.43 | **Raw margin** = (surcharged Price-1 − RAW) ÷ surcharged Price-1 × 100, shown with MD2. A 25% margin therefore displays as **0.25**. Yen RAW counts as 0 (shows 100%). | RMARGIN | QUESTION |
| D_IVMST.44 | **Unit profit** = Price-1 − average receipt cost. Shows "None" when there are no receipts. CASE.PROFIT multiplies it by the case pack (attr 27). | PROFIT, CASE.PROFIT | KEEP |

QUESTION D_IVMST.43: Should raw margin be a percent (25.00) or a fraction (0.25)? The current output is a percent shown with the wrong scale.

### 4.8 Cost basis and inventory / order valuation

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.45 | **Average cost = total received amount ÷ total received quantity** (AMT.REC attr 25 cents ÷ QTY.REC attr 24, across all receipt lots). Fallbacks differ by item: 0 (AVG.COST, AVG.CST, AVG), blank (EA), RAW (UNIT.VALUE), or division by zero (EACH). The current AVG works out the yen-converted RAW and then discards it. EA.REC / AVG.RECD give the per-lot unit cost. | AVG.COST, AVG.CST, AVG, EACH, EA, UNIT.VALUE, EA.REC, AVG.RECD | SIMPLIFY |
| D_IVMST.46 | **Per-lot received cost** (AVG.REC, multivalued) = AMT.REC ÷ QTY.REC per lot. The two copies differ for an empty lot: one returns 0, the other returns raw cost converted to US cents. | AVG.REC (×2) | QUESTION |
| D_IVMST.47 | **Average-cost exception flag:** "YES" when the rounded average cost is above 110% of raw cost (converted from yen). The intended "below 80%" test is broken (see Bug suspects). The older copies used 80%–120%. | AVG.ERR | QUESTION |
| D_IVMST.48 | **Cost variances:** COST.DIFF = received amount − RAW × received quantity. DIFF.COST = LAST.COST − RAW. AVG.DIFF = LAST.COST − AVG. | COST.DIFF, DIFF.COST, AVG.DIFF | KEEP |
| D_IVMST.49 | **Inventory valuations.** At cost: SUM(AMT.REC) (GROSS, VALUE, IVAL, S.VALUE, TIVAL, VALUE1). At last cost: STOCK × LAST.COST (REVALUE). At Price-1: WHOLESALE, YTD.SALES, TOT.SALE and EVAL44288.4 (COST = NET.1). At surcharged Price-1: OVAL (net available units), VALUE.DIFF. Counted stock: A.VALUE (avg cost, or RAW, × PHYSLOG count). RAW × QUAN: EVAL41708.1. | listed | KEEP |
| D_IVMST.50 | **"RAW.VALUE" is Price-1 × stock ÷ 2**, i.e. half of Price-1. The name says raw cost, but no raw cost is used. | RAW.VALUE | QUESTION |
| D_IVMST.51 | **Open PO / on-order value in USD.** Yen RAW × CONTROL `YEN` F1 × 100 × (PO qty + back-order qty) per PO line (OPEN.VALUE). OPEN.VALUE.2 uses `YEN` for COO J and `RMB` for COO C. VEND.VALUE does the same for the total ordered. This scale (F1 = US$ per ¥1) does not match the `YEN.CONV` scale (¥ per US$ × 100) used in D_IVMST.03. | OPEN.VALUE, OPEN.VALUE.2, VEND.VALUE | QUESTION |
| D_IVMST.52 | **Member-request value** = REQ × RAW, except yen products use REQ × **Price-1**, a sell price. The two are summed on the same report. | ORD.VALUE | QUESTION |
| D_IVMST.53 | **PO cost:** extended PO cost = (PO qty + BO qty) × PO.CST per line. The vendor weighted-average PO cost and total PO cost take the text before a `Y` in PO.CST. For yen products they round to whole units (VNDCST shows yen with no decimals). | EXT.PO.COST, VNDAVG, VNDCST | KEEP |

QUESTION D_IVMST.46: For a receipt lot with zero quantity, should unit cost be 0 or raw cost?
QUESTION D_IVMST.47: Confirm the tolerance band for average cost against raw cost (80–110% now, 80–120% before).
QUESTION D_IVMST.50: What is RAW.VALUE for? Is "half of Price-1" a deliberate estimate of raw cost?
QUESTION D_IVMST.51: What scale does CONTROL `YEN` F1 hold today? INP.YEN.CONV only accepts `##.##`, which cannot hold a per-yen USD rate like 0.0067.
QUESTION D_IVMST.52: Should member-request value use cost for every product (converted yen raw) instead of Price-1 for yen products?

### 4.9 Vendor / import attributes used in pricing

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.54 | **Import product flag:** "Y" when the product's AP vendor (attr 37) has APMST `MISC` (attr 24) = `IMPORT`. | IMPORT | SIMPLIFY |

### 4.10 Price-change dates

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.55 | **DATES (attr 11) is a positional list of price-change dates** (Pick day numbers): value 1 = created, 2 = Price-1 changed, 3 = Price-2 changed, 4 = Price-3 changed, 5 = RAW changed, 6 = MAP changed. | DT.CREATED, NET.1.DATE, PRICE.CHG, PRICE.1.CHG, NET.2.DATE, PRICE.2.CHG, DC.3, PRICE.3.CHG, RAW.CHG, RAW.DATE, MAP.CHG | SIMPLIFY |
| D_IVMST.56 | Web "recent change" date: show DATE only if it is within 45 days of today. | WEBDT | QUESTION |

QUESTION D_IVMST.56: Is 45 days the web "new price" window? (See Bug suspects: as written it is probably always blank.)

### 4.11 Terms-data lookups

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.57 | Per-product terms come from TERMSDATA keyed by product. Missing values become 0: PERC "DISC" (TERMS), CSPK, OPCT1–OPCT15. FTR (FBILL), EXPD, OST, OQA, OQQ and OAQ are returned as stored. TDOPCT13's heading says OPCT15 (copy error). | TERMS, CSPK, FBILL, TDOPCT1–TDOPCT15, TDED, TDOST, TDOQA, TDOQQ, TDOAQ | QUESTION |

QUESTION D_IVMST.57: What do PERC, FTR, OST/OQA/OQQ/OAQ and OPCT1–15 hold (vendor offer tiers?), and do any of them feed member prices?

### 4.12 Price-load staging

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_IVMST.58 | Price loads are staged in the `TEMP` file keyed by product: F1 = new raw, F2 = new Price-1, F3 = new MAP. These items show the staged values next to the live ones. | TEMP.RAW, TEMP.NET.1, TEMP.MAP | OBSOLETE-INTEGRATION |

### 4.13 Pricing rules found in other dictionaries

| ID | Rule (plain English) | Source (dictionary items) | Suggested tag |
|---|---|---|---|
| D_SCANORD.01 | **Quantity-break price:** on an order line the unit cost is **Price-2** when NET.2 > 0 **and** the line quantity ≥ IVMST `QUAN` (attr 7, "SP-QTY"). Otherwise it is the line's own COST. This answers IV.MNT.PROD.18 (how SP-QTY links to Price-2). | D_SCANORD ACOST, EXT.COST, S.EXT.COST | KEEP |
| D_SCANORD.02 | **Member type 7 pays Price-1 × 1.05** (ARMST `TP` attr 23 = 7). All other members pay Price-1. Hard-coded member type. | D_SCANORD CL.NET, SJL2 | QUESTION |
| D_ORDHIST.01 | **Customer-list price** = Price-1 (CL.PRICE) or Price-2 (CL.SPQ.PRICE, CLS.SPQ.PRICE) × (100 + CONTROL `CL.SURCHG` attr 2) ÷ 100. This is the CONTROL-driven form of the 5% in D_IVMST.16. | D_ORDHIST CL.PRICE, CL.SPQ.PRICE, CLS.SPQ.PRICE | QUESTION |
| D_ORDHIST.02 | Price-exception check: flags order-history lines whose cost is above 110% of current Price-1. | D_ORDHIST TEST.NET1 | QUESTION |
| D_ORDHIST.03 | The vendor's special percent (VNMST `SPC.PCT` attr 16) is reached through the product's PRO vendor group. | D_ORDHIST SPC.PCT | QUESTION |
| D_IVPO.01 | **PO line cost in USD:** if PO COST contains `Y`, cost = yen × CONTROL `YEN` F1 × 10000 ÷ 100 (= yen × F1 × 100); otherwise COST unchanged. Same scale question as D_IVMST.51. | D_IVPO COST.$ | QUESTION |
| D_IVPO.02 | **Free goods:** free quantity = ordered or received quantity × FG.PCT/100 when FG.PCT (IVPO attr 14, whole %) > 0. Both items are coded wrongly (see Bug suspects). | D_IVPO FG.QO, FG.QR | QUESTION |
| D_MAP.PRICE.01 | **MAP margin** on the MAP price list = (MAP − Price-1) × 1000 ÷ MAP, in tenths of a percent. MAP.PRICE holds its own RETAIL (attr 1) and MAP (attr 2) apart from IVMST. | D_MAP.PRICE MARGIN, COST | KEEP |
| D_IVMST.SALE.01 | Sale prices 1–5 in IVMST.SALE are keyed in **dollars** and multiplied by 100 to give cents when numeric. Non-numeric text passes through. | D_IVMST.SALE SALE.1–SALE.5 | SIMPLIFY |
| D_TEMP.01 | The TEMP price-load file holds **dollars**: NET.1 = F2 × 100, RETAIL = F3 × 100, MAP = F4 × 100 (cents). The column numbers differ from D_IVMST.58 (F2/F3 there). | D_TEMP NET.1, RETAIL, MAP | OBSOLETE-INTEGRATION |
| D_RECLOG.01 | **Receiving rebates:** for AP vendors 3114 and 3555, Fuji rebate = IVMST FUJI.REB % × amount, and DM amount = (DMAMT − 2)% × amount. | D_RECLOG FUJI, DMAMT.AMT | QUESTION |
| D_RECLOG.02 | **AP vendor 3114** is hard-coded as a Fuji rebate vendor. | D_RECLOG FUJI, DMAMT.AMT | QUESTION |
| D_RECLOG.03 | **AP vendor 3555** is hard-coded as a Fuji rebate vendor. | D_RECLOG FUJI, DMAMT.AMT | QUESTION |
| D_RECLOG.04 | **Free-goods value on receipt** = PO FG.PCT × received amount ÷ 100. | D_RECLOG FG.AMT | KEEP |
| D_NUMBER.01 | **Vendor group 950** = "HAZDROUS" (hazardous). It appears only in D_NUMBER's V.TYPE and has no pricing effect in D_IVMST. | D_NUMBER V.TYPE | QUESTION |
| D_IVORD.01 | **Vendor-order buckets:** a member order is "FND" (found) when VNORD has a record keyed `700`, `900`, `497`, `479` or `992` followed by the order number. These five groups are consolidated vendor orders. | D_IVORD TEST | QUESTION |
| D_VENDRA.01 | **Vendor-return value** = qty × RAW. If RAW is yen: qty × yen × CONTROL `YEN` F1. Raw comes from IVMST, or IVMST.DISC if the product is discontinued. D_VENDRET uses IVMST **LAST.COST** for active products but **RAW** for discontinued ones, and no ×100 (scale differs from D_IVMST.51). | D_VENDRA VALUE, VALUE.XL; D_VENDRET VALUE, VALUE.XL | QUESTION |
| D_ORDER.01 | Order value = QUAN × RAW. Yen products show the literal text `YEN` instead of a value. | D_ORDER VALUE | OBSOLETE |

QUESTION D_SCANORD.01: Confirm that Price-2 is a quantity-break price triggered at SP-QTY. Is "≥" right, and does it apply per line or per order?
QUESTION D_SCANORD.02 / D_ORDHIST.01: What is member type 7? Is the uplift 5% or CONTROL `CL.SURCHG`, and should it apply to Price-2 as well?
QUESTION D_ORDHIST.02: Is 110% of Price-1 the review threshold for order prices?
QUESTION D_ORDHIST.03: What is VNMST SPC.PCT and does it affect member prices?
QUESTION D_IVPO.01: Same as D_IVMST.51: what scale does CONTROL `YEN` F1 hold?
QUESTION D_IVPO.02: Is free goods (FG.PCT) still negotiated per PO, and how should free units be costed?
QUESTION D_RECLOG.01–03: Are 3114/3555 still the Fuji AP vendors? What is the "−2" in DMAMT − 2? Move to vendor rebate terms in PIV2.
QUESTION D_NUMBER.01: Is vendor group 950 (hazardous) still used, and does it need its own freight or pricing treatment?
QUESTION D_IVORD.01: Why is 999 not a bucket? Are the five buckets the full list?
QUESTION D_VENDRA.01: Should vendor returns be valued at raw cost, last cost or average cost, and in which currency?

## 5. Hard-coded business identifiers found

| Identifier | Type | Where used | Apparent purpose | Default tag |
|---|---|---|---|---|
| 479 | Vendor# (group) | NETNET, DNETNET, RALNET, DATING, QTR; V.TYPE; D_IVORD TEST | Bags/tripods bucket; better net/net, dating | QUESTION |
| 497 | Vendor# (group) | as 479 | Misc merchandise bucket; same as 479 | QUESTION |
| 700 | Vendor# (group) | TERMS2, PTERMS; V.TYPE; D_IVORD TEST | PRO film; no terms | QUESTION |
| 900 | Vendor# (group) | TERMS2, PTERMS; V.TYPE; D_IVORD TEST | LTL merchandise or "DR"; no terms | QUESTION |
| 992 | Vendor# (group) | TERMS2, PTERMS; V.TYPE; D_IVORD TEST | Camera memory; no terms | QUESTION |
| 999 | Vendor# (group) | TERMS2 | Unknown; no terms % | QUESTION |
| 950 | Vendor# (group) | D_NUMBER V.TYPE | Hazardous | QUESTION |
| 2869 | Vendor# (AP) | VBRAND | AP vendor for brand PROMASTER | QUESTION |
| 3114, 3555 | Vendor# (AP) | D_RECLOG FUJI, DMAMT.AMT | Fuji rebate vendors | QUESTION |
| 19 | Product-group | YRAW | Yen scale 1000 instead of 10000 | QUESTION |
| TP = 7 | Other (member type) | D_SCANORD CL.NET, SJL2 | Customer-list +5% | QUESTION |
| `PROMASTER` | Other (brand name) | VBRAND | House brand | QUESTION |
| `IMPORT` | Other (APMST MISC text) | IMPORT | Import vendor flag | QUESTION |
| 1000 (PCT base) | Magic-number | COST.1/2/3, N?WSC, WCOST, SCOST, DHCOST | Surcharge stored in tenths of a percent | QUESTION |
| 0.92 / 0.88 / 0.90 / 0.99 / 0.97 | Threshold | NETNET, DNETNET, RALNET | Net/net factors | QUESTION |
| 6, 2 | Threshold | TERMS2, PTERMS | Terms % and prompt-pay % | QUESTION |
| 1.05 (105/100) | Magic-number | CL.NET, CL.NET.1, D_SCANORD CL.NET/SJL2 | Customer-list uplift | QUESTION |
| 1.10, 0.95 | Threshold | PMCCALC (1.15 in D_IVMSTLD PMCCALC.OLD) | MAP +10% capped at Retail −5% | QUESTION |
| 1.07, 101 | Magic-number | MCOST.1, MNET.1 | Cost +7%, assumed 1% surcharge | QUESTION |
| 0.82 | Magic-number | USACOST, AUS.COST, AUSCOST (0.85 in ORIGINAL-D_IVMST) | Landed-cost divisor | QUESTION |
| 155, 1.3455 | Magic-number | REPRICE, REPRICE1 | Fixed ¥/$ rate; 1.15 × 1.17 markup | QUESTION |
| 5 (¢ step) | Magic-number | REPRICE1, SALE1 | Round price to 5¢ | QUESTION |
| 1.45, +3 | Magic-number | SALE1 (D_IVMST_BU/LD `SALE` = INT(RAW×1.45+.5)) | Raw × 1.45 sale price | QUESTION |
| 7.0687 | Magic-number | SJL, YEN.TEST, D_RECLOG YEN.TEST | Fixed currency rate (test) | QUESTION |
| 6, 80 | Magic-number | ORIGINAL-D_IVMST ACOST/AUSCOST, RAL.COST (RAW/80) | Old fixed RMB/AUD and ¥/AUD rates | QUESTION |
| 10000 / 1000 | Magic-number | YRAW, AVG, AVG.REC, AVG.ERR, D_IVPO COST.$ | Currency scale factors | QUESTION |
| 0.80, 1.10 | Threshold | AVG.ERR (1.20 in older copies) | Average-cost tolerance band | QUESTION |
| 1.10 | Threshold | D_ORDHIST TEST.NET1 | Price-exception threshold | QUESTION |
| −2 | Magic-number | D_RECLOG DMAMT.AMT | DM rebate less 2 points | QUESTION |
| ÷2 | Magic-number | RAW.VALUE | Half of Price-1 | QUESTION |
| 99999 | Threshold | DHCOST, DHNET | Switch to whole-dollar display | QUESTION |
| 45 | Threshold (days) | WEBDT | Recent-change window | QUESTION |

## 6. Data shape — record layouts referenced

### IVMST (fields used by pricing formulas)

| Attr # | EQU name | Used as | Units (for numeric fields) | Notes |
|---|---|---|---|---|
| 5 | VEND / VENDOR / PVEND | PRO vendor group (VNMST key) | integer id | Groups 479/497/700/900/992/999 are buckets |
| 6 | GRP / GP / GRP.NO | Product group | integer id | Group 19 special in YRAW |
| 7 | QUAN ("SP-QTY") | Special-price (Price-2) quantity threshold | units | Used by D_SCANORD.01 |
| 8 | NET.1 / **COST** | Price-1, member price before surcharge | **cents** (MD2) | `COST` is a synonym of NET.1, **not** surcharged cost; `T.COST = SUM(COST)` |
| 9 | NET.2 | Price-2 (quantity price) | **cents** (MD2) | |
| 10 | NET.3 | Price-3 | **cents** (MD2) | Overrides Price-1 in SCOST |
| 11 | DATES / DATE (MV) | Positional change dates | Pick day numbers | 1 created, 2 P1, 3 P2, 4 P3, 5 RAW, 6 MAP; overloaded |
| 12 | PCT | Product surcharge | **tenths of a percent** (MD1) | 60 = 6.0% |
| 19 | RAW / RAW.COST | Raw vendor cost | **cents** if all digits; **foreign whole units** (yen/RMB) when it contains `Y` | Overloaded: amount + currency in one string |
| 21 | PO.QTY (MV) | Open PO quantity per PO | units | |
| 22 | PO.CST (MV) | PO cost per PO | cents, or foreign + `Y` | Same overload as RAW |
| 23 | BO.QTY / PO.BO (MV) | Back-ordered quantity per PO | units | |
| 24 | QTY.REC (MV) | Received quantity per lot | units | STOCK = SUM |
| 25 | AMT.REC / AMT.RECD (MV) | Received extended cost per lot | **cents** (MD2) | Already converted to USD at receiving (IV.ORD.REC.N line 385 rounds `INT(yen/YEN.CONV*10000+.5)`) |
| 27 | CASE | Case pack | units | |
| 28 | LAST.COST / LCOST / **FILM.PK** | Last cost, and also film pack count | **cents** (MD2) / count | **Overloaded**: ROLLS uses FILM.PK, while PERC and REVALUE use LAST.COST |
| 31 | RETAIL | Retail price | **cents** (MD2) | |
| 32 | MAP | Minimum advertised price | **cents** (MD2) | |
| 37 | A.VENDOR / AVEND | AP (actual) vendor | APMST id | Overridden to 2869 for brand PROMASTER (VBRAND) |
| 43 | IPI / FUJI.REB / WIPI | Rebate % / IPI flag | whole % (FUJI.REB) | Overloaded (see IV.MNT.PROD.N) |
| 52 | COO | Country of origin | code (`J`, `C`, …) | Picks the currency for `Y` raw costs |
| 59 | DS.CHG / DS.SCHG | Drop-ship charge | **cents** (MD2) | |

### CONTROL (exchange-rate records used through TRANS)

| Key | Attr used | Meaning (inferred; confirm) | Used by | Maintained by |
|---|---|---|---|---|
| `YEN.CONV` | 1 date, **2 rate** | **Yen per US$ × 100** (MD2; 15000 = ¥150.00) | YRAW, AVG, AVG.REC, AVG.ERR | IV6, IV.ORD.REC(.N) at PO receipt; MONEY.CONV |
| `YEN` | F1 | US$ per ¥1 if the ×100 in the formulas is right, but INP.YEN.CONV only accepts `##.##` | OPEN.VALUE, OPEN.VALUE.2, VEND.VALUE, USACOST, D_IVPO COST.$, D_VENDRA/VENDRET, D_RETURNS | INP.YEN.CONV |
| `RMB` | F1 | US$ per RMB 1 (same pattern as `YEN`) | OPEN.VALUE.2, USACOST | **No BASIC program in the dump writes it** |
| `AUS.YEN.CONV`, `AUS.RMB.CONV` | F2, **F3** | Two rates each (old/new?). F3 is used to convert to AUD | AUS.COST, AUSCOST, AUS.YEN, RMB.AUS, RMB.CONV | **Not written by any BASIC program** |
| `AUS.YEN`, `AUS.RMB` | F1 | Single rates | TEST.YEN, AUS.YEN.S2, YEN.CONV (item) | **Not written by any BASIC program** |
| `RBI.CONV` | 2 | RMB per US$ × 100 (MONEY.CONV suffix `R`) | MONEY.CONV only | not found |
| `CL.SURCHG` | F2 | Customer-list surcharge % (whole %) | D_ORDHIST CL.PRICE | not found |
| `UPD` | MONTH | Current processing month | CURYTD, MTD, TREND (non-pricing) | month-end |

## 7. Bug suspects

1. **AVG.ERR lower-bound test is broken.** `IF @3 < @2*.80 > @3 OR …` parses as `((@3 < @2*.80) > @3)`, which compares a true/false result with the average cost. The "below 80% of raw" case almost never fires, so only "above 110%" works.
2. **Two different AUSCOST copies** exist in the hashed file. One divides by the AUD rate and the other multiplies, so they differ by a factor of rate². The description says "changed F1 to F2", but the formulas read **F3**.
3. **AUS cost of USD-cost products is not converted to AUD** (`ELSE RAW/.82` in AUS.COST/AUSCOST).
4. **Arithmetic on a `Y` RAW silently uses 0.** UniVerse treats non-numeric strings as 0 (with a warning). Affected: BASE.PROFIT (profit = full Price-1), RMARGIN (100%), COST.DIFF, DIFF.COST, SALE1, EVAL41708.1, UNIT.VALUE/A.VALUE fallbacks, EXT.PO.COST (PO.CST may also carry `Y`).
5. **`OCONV(RAW,'MCN')` drops a decimal point.** "150.5Y" becomes 1505. Only YRAW's group-19 factor compensates. REPRICE uses `FIELD(RAW,'Y',1)`, which keeps the point, so the two parsers disagree.
6. **Two yen rates with incompatible scales.** `YEN.CONV` attr 2 = ¥ per $ × 100, divided into yen × 10000. `YEN` F1 is multiplied into yen × 100, so it must be about 0.0067 US$ per ¥. But INP.YEN.CONV enforces `2N.2N` (e.g. `00.68`), which would overstate values 100×. One of the two pipelines is wrong today, or INP.YEN.CONV is no longer used.
7. **RMARGIN scale:** `×100` with MD2 output shows 25% as `0.25`. The older MARGIN had the same mistake (`×100` with MD1 in D_IVMST_BU), which was fixed to `×1000`.
8. **DIFF.COST conversion is `M2`**, not `MD2`. This looks like a typo; the output is not scaled as money.
9. **EACH, MCOST.1 and MNET.1 divide by STOCK without a zero check** (UniVerse returns 0 with a warning). EA tests `AMT.REC > 0` on a multivalued field.
10. **AVG computes the yen-converted RAW and never uses it** (`IF @2 = 0 THEN 0`). Older copies returned it as the fallback.
11. **ORD.VALUE mixes bases:** cost (RAW) for USD products and sell price (NET.1) for yen products in one total.
12. **VNDAVG shows yen averages with MD2Z**, so ¥1500 displays as 15.00. VNDCST correctly switches to MD0 for yen.
13. **Item `YEN.CONV` reads CONTROL `AUS.YEN`**, not CONTROL `YEN.CONV`. The name is misleading.
14. **TERMS2 and PTERMS disagree on vendor 999** (0% terms but 2% prompt-pay).
15. **IVMST attr 28 is both LAST.COST (cents) and FILM.PK (count).**
16. **D_IVPO RAW.COST double-converts.** It returns `OCONV(@1,'MD2')` (already "12.34") and then applies output conversion MD2 again, so it shows 0.12.
17. **D_IVPO FG.QO** rounds the percentage before multiplying (`INT(FG.PCT/100+.5)`), so any FG.PCT < 50 gives 0 free units. **FG.QR** contains `QTY.INT(REC * …)`, which does not compile as intended.
18. **D_PRICE.CHA000 (PRICE.CHANGES) synonyms are crossed.** Attr 4 is named NET.2, NEW.MAP **and** RETAIL; attr 5 is named MAP **and** NEW.RETAIL. Any report using these names may label MAP as retail. Its IVM.RAW / IVM.PO.COST / IVM.NET1 read **IVMST.PC**, not IVMST. IVM.NET1 has a missing quote (`'X)`).
19. **WEBDT** subtracts the multivalued DATE (attr 11) from today. That arithmetic on a multivalued string probably gives 0, so the item is always blank.
20. **D_TEMP vs D_IVMST.58:** D_TEMP maps NET.1 = F2, RETAIL = F3, MAP = F4 (dollars). D_IVMST reads TEMP F1 = raw, F2 = net, **F3 = MAP**. At least one of them labels the columns wrongly.
21. **D_VENDRET VALUE** values active products at LAST.COST but discontinued ones at RAW, and applies the yen rate without ×100, unlike D_IVMST.51.
22. **REPRICE1 returns 5¢ for every non-yen product.** The base is 0, and `((INT((0−1)/5))+1)*5` = 5.
23. **D_SCANORD SJL2** has the heading "Prof" but returns the (type-7-adjusted) Price-1. The cost it works out is never subtracted.

The template's READU/locking checks do not apply: dictionaries do not lock or write.

## 8. Schema-design notes for the CTO

- **Entities touched:** Product price ladder (Price-1/2/3, Retail, MAP, surcharge %), product cost (raw, PO, last, average, landed), vendor group terms, exchange rates, price-change history, manual sell-price override (PMCSELL), MAP price list (MAP.PRICE).
- **Split RAW and PO.CST** into `amount decimal` + `currency_code` (USD/JPY/CNY). Drop the `Y` suffix and the COO inference. Under the Product Desk currency decision (0% uplift, accepted manual rate pulls), JPY/CNY are cost currencies here, not market currencies. Keep a separate cost-currency rate set, or confirm they can be dropped once no yen/RMB vendors remain.
- **One exchange-rate table** replaces CONTROL `YEN`, `YEN.CONV`, `RMB`, `RBI.CONV`, `AUS.*` (two incompatible yen scales today). Store the rate in one direction with an explicit unit, effective date and who accepted it. The orphaned `CURRENCIES` file (CONVERSION/PRIOR.CONV) is the natural shape to keep.
- **Vendor-group terms become data:** net/net factors, terms %, prompt-pay %, dating flag and V.TYPE label belong on the vendor group (VNMST), not on hard-coded 479/497/700/900/992/999 in reports. One "vendor group" row per bucket.
- **Surcharge % as a decimal percent.** Today it is tenths (MD1) on both IVMST attr 12 and VNMST attr 8, with different entry units (see IV.MNT.PROD.16, IV2.15). Decide one rounding rule for surcharged cost: IV8's half-up to the cent is the only one that reaches an invoice.
- **Derived prices are views, not columns:** surcharged prices, SCOST precedence, PMCCALC/PMCSELL, customer-list uplift, quantity-break (SP-QTY → Price-2). Implement them once in SQL (view or computed column) and in the API, so reports and billing cannot drift as they do now.
- **Overloaded attributes to split:** RAW (amount + currency), attr 11 DATES (→ price-history rows per price type with old/new value, user, timestamp), attr 28 (LAST.COST vs FILM.PK), attr 43 (IPI/FUJI.REB).
- **Missing audit:** the dictionary cannot show who changed a rate or price. PIV2 needs audit rows for rate acceptance, PMCSELL overrides and every price-ladder change.
- **Units to settle before schema commit:** all money is integer cents (MD2) except D_IVMST.SALE / D_TEMP (dollars ×100), FG.PCT (whole %), PCT (tenths), margins (tenths, except RMARGIN), yen amounts (whole yen, except group 19).
- **Siblings to extract before a pricing schema commit:** IV8 (billing re-price), whatever writes PMCSELL, MAP.PRICE, PRICE.CHANGES and the TEMP price loads, the CONTROL records listed in §6 (actual values), MONEY.CONV callers, and the member-order pricing programs (UPD.WEBORDERS, UPD.MEMEDI, IV3) to confirm whether Price-2/SP-QTY and the type-7 uplift happen at order time.

## 9. Questions for COO/CFO — consolidated

1. What defines a product's cost currency (explicit code, country of origin, or `Y`/`R` suffix)? (D_IVMST.02)
2. Why does product group 19 use a 1000 scale for yen costs, and what is group 19? (D_IVMST.04, D_IVMST.33)
3. What is the 0.82 landed-cost divisor, and should it vary by country or vendor? (D_IVMST.05)
4. Is AUD landed cost still needed? If so, which formula and rate are current? (D_IVMST.06)
5. Is the ¥155 × 1.3455 reprice still used for yen products? (D_IVMST.09)
6. Is raw × 1.45 rounded to 5¢ a current price rule? (D_IVMST.10)
7. What is Price-3 for, and does it always override Price-1? (D_IVMST.14)
8. Customer-list price: fixed 5% or CONTROL CL.SURCHG, for member type 7 only, Price-1 and Price-2? (D_IVMST.16, D_SCANORD.02, D_ORDHIST.01)
9. Is "average cost + 7%" (Price-1 backed out of a 1% surcharge) still the pricing target? (D_IVMST.19)
10. What do NETNET / DNETNET / RALNET mean, and are their factors current? (D_IVMST.20–22)
11. Which dating terms apply to vendor groups 479/497? (D_IVMST.23)
12. Confirm terms % and prompt-pay % per vendor group, including 999. (D_IVMST.24, .25, .31)
13. Confirm what each vendor group 479, 497, 700, 900, 992, 999, 950 represents today. (D_IVMST.26–31, D_NUMBER.01)
14. Is AP vendor 2869 the vendor for all ProMaster-brand products? (D_IVMST.32)
15. What is "PMC"? Are MAP × 110% capped at Retail × 95% and the PMCSELL overrides current policy? (D_IVMST.34)
16. Raw margin: percent or fraction? (D_IVMST.43)
17. Unit cost of a zero-quantity receipt lot: 0 or raw cost? (D_IVMST.46)
18. Average-cost tolerance band against raw cost: 80–110% or 80–120%? (D_IVMST.47)
19. What is RAW.VALUE (half of Price-1) used for? (D_IVMST.50)
20. What scale does CONTROL YEN F1 hold, and should open-PO, PO and return values use the receiving rate (YEN.CONV) instead? (D_IVMST.51, D_IVPO.01, D_VENDRA.01)
21. Should member-request value use cost for every product? (D_IVMST.52)
22. Is 45 days the web "recent price change" window? (D_IVMST.56)
23. What are TERMSDATA PERC, FTR, OST/OQA/OQQ/OAQ, OPCT1–15? (D_IVMST.57)
24. Is Price-2 a quantity break at SP-QTY ("≥", per line)? (D_SCANORD.01)
25. Is 110% of Price-1 the order-price review threshold? (D_ORDHIST.02)
26. What is VNMST SPC.PCT, and does it change member prices? (D_ORDHIST.03)
27. Is free goods % still negotiated per PO, and how should free units be costed? (D_IVPO.02)
28. Are 3114/3555 still the Fuji rebate vendors, and what is DMAMT − 2? (D_RECLOG.01–03)
29. Are 700/900/497/479/992 the complete list of vendor-order buckets? (D_IVORD.01)
30. Should vendor returns be valued at raw, last or average cost? (D_VENDRA.01)

## 10. Proposed classification summary

| Tag | Count | Rule IDs |
|---|---|---|
| KEEP | 18 | D_IVMST.03, .12, .13, .17, .18, .35, .37, .38, .40, .41, .42, .44, .48, .49, .53; D_SCANORD.01; D_MAP.PRICE.01; D_RECLOG.04 |
| SIMPLIFY | 7 | D_IVMST.01, .08, .15, .45, .54, .55; D_IVMST.SALE.01 |
| OBSOLETE | 5 | D_IVMST.07, .11, .36, .39; D_ORDER.01 |
| OBSOLETE-INTEGRATION | 2 | D_IVMST.58; D_TEMP.01 |
| QUESTION | 44 | D_IVMST.02, .04, .05, .06, .09, .10, .14, .16, .19, .20, .21, .22, .23, .24, .25, .26, .27, .28, .29, .30, .31, .32, .33, .34, .43, .46, .47, .50, .51, .52, .56, .57; D_SCANORD.02; D_ORDHIST.01, .02, .03; D_IVPO.01, .02; D_RECLOG.01, .02, .03; D_NUMBER.01; D_IVORD.01; D_VENDRA.01 |
| WAREHOUSE-ONLY | 0 | — |

Total: 76 rules (58 D_IVMST + 18 from other dictionaries) = 18 + 7 + 5 + 2 + 44 + 0.

## 11. Cross-references

| Type | Reference | Notes |
|---|---|---|
| Sibling extraction | `Products/IV.MNT.PROD.md` (§8), `.N`, `.O`, `IV.DSP.PROD` | Maintain the stored fields these formulas read. IV.MNT.PROD.18 (SP-QTY link) is answered by D_SCANORD.01 |
| Sibling extraction | `Vendors/IV2.md` | VNMST surcharge PCT (attr 8) vs product PCT (attr 12) |
| Program | IV8 | Billing re-price: `INT((1+PCT/1000)*NET.1+.5)`. Not yet extracted |
| Program | MONEY.CONV, INP.YEN.CONV, IV6, IV.ORD.REC, IV.ORD.REC.N, IV.UPD.SCANORD | Currency conversion in BASIC (YEN.CONV, RBI.CONV, YEN) |
| Variant dictionary | `ORIGINAL-D_IVMST` | Earlier D_IVMST. Fixed rates: AUSCOST/ACOST use RMB ÷ 6, yen ÷ 80, ÷ 0.85 instead of CONTROL rates and 0.82. Has `MPROJP` = (RAW+.5)×1.10 and `MREQP` = (AVG.CST+.5)×1.10, `PMCSELL` = MAP×1.10, `SALE` = INT(RAW×1.45+.5), I-type `COST` = INT(surcharged NET.1+.5) |
| Variant dictionary | `D_IVMST_BU` | Same history as ORIGINAL. PERC as NET.1×100/RAW, MARGIN ×100 bug, AVG.ERR 80–120%, `RAL.COST` = RAW/80 for COO J |
| Variant dictionary | `D_IVMSTLD` | PMCCALC.OLD MAP×**1.15**; TERMS2 **without 900**; PERC = NET.1×100/AVG.CST |
| Variant dictionary | `D_IVMST.DISC`, `D_IVMST.AUX` | Discontinued-product dictionary (`F0` = surcharged NET.3) and an auxiliary file (`COST` = surcharged NET.1 via TRANS). Not canonical |
| Other dictionary | D_SCANORD, D_ORDHIST, D_IVPO, D_MAP.PRICE, D_IVMST.SALE, D_TEMP, D_RECLOG, D_NUMBER, D_IVORD, D_VENDRA, D_VENDRET, D_ORDER, D_PMCSELL, D_TERMSDATA | Rules in §4.13 |
| Out of scope (pointer) | D_ARMST / D_ARMST2 | Member surcharge rebate: CALC.PCT = PRO.SALES × 2%, NEW.SC = PRO.SALES × 3% (ARMST) vs 2.5% (ARMST2) + SUR.CHG. Belongs to the Rebate/Member extraction |
| Out of scope (pointer) | D_IVEND (+00/01) | Vendor rebate `REBATE` = AMOUNT × 2%; `MARGIN` = APMST PCT × AMOUNT/100 |
| Out of scope (pointer) | D_ARSHIP | GST 5% on product lines with PROD > 999; product 999 = shipping line, 990 = GST line; `COR.PCT` = PERC + 3 |
| Out of scope (pointer) | D_STOCK / D_STOCK2 | Patronage allocation with fixed totals (1403034, 1889086, 6935000, 525612, 169751497) |
| Out of scope (pointer) | D_IVORD_WEB / D_ORDHIST | `ADJ` = INT(QUAN × .5835 + .5); `TEST` product 9513 qty × 1.5 |
| Unreferenced file | D_CURRENCIES | Currency table not used by any I-descriptor or BASIC program in the dump |
| Unreferenced items | D_VNMST, D_APMST | No pricing I-descriptors. Pricing-relevant stored fields only: VNMST PCT (attr 8, tenths), SPC.PCT (16), FTR (17), VND.TERMS (18); APMST PCT (9), FG.PCT (20), SRCH (30, MD1), MISC (24) |

**Sibling-series flag:** D_IVMST is the canonical dictionary. ORIGINAL-D_IVMST, D_IVMST_BU and D_IVMSTLD are older copies of it. Use them only as evidence of how a rule changed, and do not extract them as current rules.

---

## Appendix F — Formula catalogue (item → raw formula → plain English → SQL)

### SQL conventions used below

```sql
-- i    = IVMST row (one per product). Columns use the dictionary names with '.' -> '_'.
--        Money columns are INT cents (MD2) unless noted. i.RAW and i.PO_CST are VARCHAR (may contain 'Y').
-- s    = per-product receipt totals:
--        OUTER APPLY (SELECT SUM(QTY_REC) AS STOCK, SUM(AMT_REC) AS AMT_REC_SUM
--                     FROM IVMST_REC x WHERE x.PROD = i.PROD) s
-- r    = RAW decomposed:
--        CROSS APPLY (SELECT
--           CASE WHEN CHARINDEX('Y', i.RAW) > 0 THEN 1 ELSE 0 END                AS RAW_IS_FX,   -- COUNT(RAW,'Y') / INDEX(RAW,'Y',1)
--           dbo.fn_MCN(i.RAW)                                                     AS RAW_MCN,     -- OCONV(RAW,'MCN'): digits only, '.' dropped
--           TRY_CAST(LEFT(i.RAW, CHARINDEX('Y', i.RAW + 'Y') - 1) AS decimal(19,4)) AS RAW_PRE_Y,  -- FIELD(RAW,'Y',1)
--           ISNULL(TRY_CAST(i.RAW AS decimal(19,4)), 0)                           AS RAW_N        -- RAW used in arithmetic: non-numeric -> 0 (UniVerse behaviour)
--        ) r
-- ctl  = CONTROL values pivoted to one row (TRANS(CONTROL,key,Fn,'X') returns '' -> 0 when missing):
--        CROSS JOIN (SELECT
--           MAX(CASE WHEN ID='YEN'          THEN TRY_CAST(F1 AS decimal(19,8)) END) AS YEN_F1,
--           MAX(CASE WHEN ID='RMB'          THEN TRY_CAST(F1 AS decimal(19,8)) END) AS RMB_F1,
--           MAX(CASE WHEN ID='YEN.CONV'     THEN TRY_CAST(F2 AS decimal(19,8)) END) AS YEN_CONV_F2,
--           MAX(CASE WHEN ID='AUS.YEN'      THEN TRY_CAST(F1 AS decimal(19,8)) END) AS AUS_YEN_F1,
--           MAX(CASE WHEN ID='AUS.RMB'      THEN TRY_CAST(F1 AS decimal(19,8)) END) AS AUS_RMB_F1,
--           MAX(CASE WHEN ID='AUS.YEN.CONV' THEN TRY_CAST(F2 AS decimal(19,8)) END) AS AUS_YEN_CONV_F2,
--           MAX(CASE WHEN ID='AUS.YEN.CONV' THEN TRY_CAST(F3 AS decimal(19,8)) END) AS AUS_YEN_CONV_F3,
--           MAX(CASE WHEN ID='AUS.RMB.CONV' THEN TRY_CAST(F2 AS decimal(19,8)) END) AS AUS_RMB_CONV_F2,
--           MAX(CASE WHEN ID='AUS.RMB.CONV' THEN TRY_CAST(F3 AS decimal(19,8)) END) AS AUS_RMB_CONV_F3,
--           MAX(CASE WHEN ID='CL.SURCHG'    THEN TRY_CAST(F2 AS decimal(19,8)) END) AS CL_SURCHG_F2
--         FROM CONTROL) ctl
-- Arithmetic rules for exact reproduction:
--   * Use decimal, never INT division: (i.PCT + 1000) * i.NET_1 / 1000 truncates in T-SQL if all are INT.
--     Write 1.0 * ... or CAST(... AS decimal(19,6)).
--   * UniVerse divide-by-zero returns 0 (with a warning): use ISNULL(a / NULLIF(b, 0), 0).
--   * Empty / missing values are 0 in arithmetic: wrap nullable columns in ISNULL(col, 0).
--   * Results are kept at full precision. MD2 output rounds half-up to whole cents (ROUND(x, 0)),
--     MD1 to tenths, MD02 shows whole dollars (ROUND(x/100, 0)). Only round at the end of the formula chain.
-- dbo.fn_MCN (digits only, mirrors OCONV(x,'MCN')):
--   CREATE FUNCTION dbo.fn_MCN(@s varchar(50)) RETURNS bigint AS BEGIN
--     DECLARE @o varchar(50) = '', @k int = 1;
--     WHILE @k <= LEN(@s) BEGIN IF SUBSTRING(@s,@k,1) LIKE '[0-9]' SET @o += SUBSTRING(@s,@k,1); SET @k += 1; END
--     RETURN TRY_CAST(NULLIF(@o,'') AS bigint) END
-- Dates: Pick day n -> DATEADD(day, n, '1967-12-31').
```

Legend for the "Depends on" line: **CONTROL** = exchange-rate or setting record; **TRANS** = lookup into another file; **MV** = multivalued (one result per PO/receipt line).

---

#### D_IVMST.01 — RAW parsing (pattern, no single item)
- **Raw:** `COUNT(RAW,'Y')` · `INDEX(RAW,'Y',1)` · `OCONV(RAW,'MCN')` · `FIELD(RAW,'Y',1)`
- **English:** Is the raw cost foreign? What is the foreign amount, with or without its decimal point?
- **SQL:** `r.RAW_IS_FX`, `r.RAW_MCN`, `r.RAW_PRE_Y` (see conventions)

#### D_IVMST.03 / .04 / .33 — YRAW
- **Raw:** `IF GRP = 19 THEN 1000 ELSE 10000;IF COUNT(RAW,'Y') THEN OCONV(RAW,'MCN')*@1/TRANS(CONTROL,'YEN.CONV',F2,'X') ELSE RAW` · conv `MD2` · heading "YEN-CONV RAW-COST"
- **English:** Raw cost in US cents. Yen raw cost = yen digits × 10000 ÷ (yen per $ × 100). Product group 19 uses 1000.
- **SQL:** `CASE WHEN r.RAW_IS_FX = 1 THEN ISNULL(1.0 * r.RAW_MCN * CASE WHEN i.GRP = 19 THEN 1000 ELSE 10000 END / NULLIF(ctl.YEN_CONV_F2, 0), 0) ELSE r.RAW_N END`
- **Depends on:** CONTROL `YEN.CONV` attr 2.

#### D_IVMST.05 — USACOST
- **Raw:** `IF COUNT(RAW,'Y') AND COO = "C" THEN (((OCONV(RAW,'MCN')*100)*TRANS(CONTROL,'RMB',F1,'X'))/.82) ELSE IF COUNT(RAW,'Y') AND COO = "J" THEN (((OCONV(RAW,'MCN')*100)*TRANS(CONTROL,'YEN',F1,'X'))/.82) ELSE RAW/.82` · `MD2`
- **English:** US landed cost in cents. RMB (China) or yen (Japan) raw × the US$ rate × 100, then ÷ 0.82. US$ raw ÷ 0.82. A `Y` raw with any other COO falls through to `RAW/.82` = 0.
- **SQL:** `CASE WHEN r.RAW_IS_FX = 1 AND i.COO = 'C' THEN r.RAW_MCN * 100.0 * ISNULL(ctl.RMB_F1,0) / 0.82 WHEN r.RAW_IS_FX = 1 AND i.COO = 'J' THEN r.RAW_MCN * 100.0 * ISNULL(ctl.YEN_F1,0) / 0.82 ELSE r.RAW_N / 0.82 END`
- **Depends on:** CONTROL `RMB` F1, `YEN` F1.

#### D_IVMST.06 — AUS.COST
- **Raw:** `IF COUNT(RAW,'Y') AND COO = "C" THEN (((OCONV(RAW,'MCN')*100)/TRANS(CONTROL,'AUS.RMB.CONV',F3,'X'))/.82) ELSE IF COUNT(RAW,'Y') AND COO = "J" THEN (((OCONV(RAW,'MCN')*100)/TRANS(CONTROL,'AUS.YEN.CONV',F3,'X'))/.82) ELSE RAW/.82` · `MD2` · description "* CHANGED TRANS(F1 TO F2 for Geoff"
- **English:** Australian landed cost in AUD cents. Foreign raw × 100 ÷ (RMB or yen per AUD), then ÷ 0.82. US$ raw is only ÷ 0.82 (not converted).
- **SQL:** `CASE WHEN r.RAW_IS_FX = 1 AND i.COO = 'C' THEN ISNULL(r.RAW_MCN * 100.0 / NULLIF(ctl.AUS_RMB_CONV_F3,0), 0) / 0.82 WHEN r.RAW_IS_FX = 1 AND i.COO = 'J' THEN ISNULL(r.RAW_MCN * 100.0 / NULLIF(ctl.AUS_YEN_CONV_F3,0), 0) / 0.82 ELSE r.RAW_N / 0.82 END`
- **Depends on:** CONTROL `AUS.RMB.CONV` F3, `AUS.YEN.CONV` F3.

#### D_IVMST.06 — AUSCOST (copy A, divide; identical to AUS.COST)
- **Raw:** same as AUS.COST, heading " AUS-COST", format 9R.
- **SQL:** same as AUS.COST.

#### D_IVMST.06 — AUSCOST (copy B, multiply)
- **Raw:** `IF COUNT(RAW,'Y') AND COO = "C" THEN (((OCONV(RAW,'MCN')*100)*TRANS(CONTROL,'AUS.RMB.CONV',F3,'X'))/.82) ELSE IF COUNT(RAW,'Y') AND COO = "J" THEN (((OCONV(RAW,'MCN')*100)*TRANS(CONTROL,'AUS.YEN.CONV',F3,'X'))/.82) ELSE RAW/.82` · `MD2`
- **English:** As copy A, but multiplies by the rate (so the rate must be AUD per foreign unit).
- **SQL:** `CASE WHEN r.RAW_IS_FX = 1 AND i.COO = 'C' THEN r.RAW_MCN * 100.0 * ISNULL(ctl.AUS_RMB_CONV_F3,0) / 0.82 WHEN r.RAW_IS_FX = 1 AND i.COO = 'J' THEN r.RAW_MCN * 100.0 * ISNULL(ctl.AUS_YEN_CONV_F3,0) / 0.82 ELSE r.RAW_N / 0.82 END`
- **Depends on:** CONTROL `AUS.*.CONV` F3.

#### D_IVMST.07 — TEST.YEN
- **Raw:** `IF COUNT(RAW,'Y') AND COO = "C" THEN (((OCONV(RAW,'MCN')*100)*TRANS(CONTROL,'AUS.RMB',F1,'X'))/1) ELSE IF COUNT(RAW,'Y') AND COO = "J" THEN (((OCONV(RAW,'MCN')*100)*TRANS(CONTROL,'AUS.YEN',F1,'X'))/1) ELSE RAW/1` · `MD2`
- **English:** Test version of AUD cost with the single AUS rates and no 0.82.
- **SQL:** `CASE WHEN r.RAW_IS_FX = 1 AND i.COO = 'C' THEN r.RAW_MCN * 100.0 * ISNULL(ctl.AUS_RMB_F1,0) WHEN r.RAW_IS_FX = 1 AND i.COO = 'J' THEN r.RAW_MCN * 100.0 * ISNULL(ctl.AUS_YEN_F1,0) ELSE r.RAW_N END`
- **Depends on:** CONTROL `AUS.RMB` F1, `AUS.YEN` F1.

#### D_IVMST.07 — AUS.YEN.S1
- **Raw:** `(OCONV(RAW,'MCN')*100)` · `MD2`
- **English:** Raw digits × 100 (scratch step).
- **SQL:** `r.RAW_MCN * 100`

#### D_IVMST.07 — AUS.YEN.S2
- **Raw:** `(OCONV(RAW,'MCN')*100)*TRANS(CONTROL,'AUS.YEN',F1,'X')` · `MD2`
- **English:** Raw digits × 100 × AUS yen rate (scratch step).
- **SQL:** `r.RAW_MCN * 100.0 * ISNULL(ctl.AUS_YEN_F1, 0)`
- **Depends on:** CONTROL `AUS.YEN` F1.

#### D_IVMST.08 — Rate display items
| Item | Raw | English | SQL |
|---|---|---|---|
| YEN | `TRANS(CONTROL,'YEN',F1,'X')` (heading "YEN-USA") | Yen→US$ rate | `ctl.YEN_F1` |
| RMB | `TRANS(CONTROL,'RMB',F1,'X')` ("RMB-USA") | RMB→US$ rate | `ctl.RMB_F1` |
| AUS.YEN | `TRANS(CONTROL,'AUS.YEN.CONV',F2,'X'):@VM:TRANS(CONTROL,'AUS.YEN.CONV',F3,'X')` | Both AUS yen rates | `CONCAT(ctl.AUS_YEN_CONV_F2, ' / ', ctl.AUS_YEN_CONV_F3)` |
| AUS.RMB | `TRANS(CONTROL,'AUS.RMB.CONV',F3,'X')` | Current AUS RMB rate | `ctl.AUS_RMB_CONV_F3` |
| RMB.AUS | `TRANS(CONTROL,'AUS.RMB.CONV',F2,'X')` | Other AUS RMB rate | `ctl.AUS_RMB_CONV_F2` |
| RMB.CONV | `TRANS(CONTROL,'AUS.RMB.CONV',F2,'X'):@VM:TRANS(CONTROL,'AUS.RMB.CONV',F3,'X')` | Both AUS RMB rates | `CONCAT(ctl.AUS_RMB_CONV_F2, ' / ', ctl.AUS_RMB_CONV_F3)` |
| YEN.CONV | `TRANS(CONTROL,'AUS.YEN',F1,'X')` | **AUS** yen rate (misnamed) | `ctl.AUS_YEN_F1` |

**Depends on:** CONTROL (all).

#### D_IVMST.09 — REPRICE
- **Raw:** `INDEX(RAW,'Y',1); IF @1 THEN FIELD(RAW,'Y',1) ELSE 0; @2*100/155*1.3455` · `MD2Z`
- **English:** For yen products: yen ÷ 155 (fixed ¥/$) × 100 → cents, × 1.3455 markup. Non-yen = 0.
- **SQL:** `CASE WHEN r.RAW_IS_FX = 1 THEN r.RAW_PRE_Y * 100.0 / 155 * 1.3455 ELSE 0 END`

#### D_IVMST.09 — REPRICE1
- **Raw:** `INDEX(RAW,'Y',1); IF @1 THEN FIELD(RAW,'Y',1) ELSE 0; ((INT((@2*100/155*1.3455-1)/5))+1)*5` · `MD2Z` · description "reprice Yen with rounding to 5 cents and 15% plus 17%", heading "155YEN"
- **English:** REPRICE rounded **up** to the next multiple of 5¢. An exact multiple stays the same, within 1¢. For a **non-yen** product the base is 0, `INT(-1/5)` = 0, so the result is **5¢**, not 0.
- **SQL:** `(CAST((x - 1) / 5 AS int) + 1) * 5` where `x = CASE WHEN r.RAW_IS_FX = 1 THEN r.RAW_PRE_Y ELSE 0 END * 100.0 / 155 * 1.3455`. `CAST AS int` truncates toward zero like UniVerse `INT`; do not use FLOOR, which gives 0 instead of 5 for non-yen products.

#### D_IVMST.10 — SALE1
- **Raw:** `(INT((INT(RAW*1.45+3))/5))*5` · `MD2`
- **English:** Raw × 1.45 + 3¢, truncated, then cut to a multiple of 5¢. This rounds to the nearest 5¢ with ties going up from x.x2.
- **SQL:** `CAST(CAST(r.RAW_N * 1.45 + 3 AS int) / 5 AS int) * 5`

#### D_IVMST.11 — SJL / YEN.TEST
| Item | Raw | English | SQL |
|---|---|---|---|
| SJL | `SUBR('!MULS',QTY.REC,REUSE(OCONV(RAW,'MCN')*7.0687))` · `MD2` (MV) | Per lot: received qty × raw digits × 7.0687 | `x.QTY_REC * r.RAW_MCN * 7.0687` (per IVMST_REC row x) |
| YEN.TEST | `(OCONV(RAW,'MCN')/7.0687)*100;SUBR('!MULS',REUSE(@1),QTY.REC)` · `MD2` (MV) | Per lot: received qty × raw digits ÷ 7.0687 × 100 | `x.QTY_REC * r.RAW_MCN / 7.0687 * 100` |

#### D_IVMST.12 — COST.1 / N1WSC / WCOST
- **Raw:** `((PCT+1000)*NET.1)/1000` (COST.1, WCOST) · `(PCT+1000)*NET.1/1000` (N1WSC) · `MD2` / `MD2Z` · headings "INCL SUR-CH", "PRICE-1 W/SC...", "SALE-1"
- **English:** Member cost with surcharge = Price-1 × (1 + surcharge‰/1000). Example: NET.1 = 10000 (¢), PCT = 60 → 10600 = $106.00.
- **SQL:** `(ISNULL(i.PCT,0) + 1000) * 1.0 * ISNULL(i.NET_1,0) / 1000`  — invoice-equivalent (IV8): `CAST((1 + ISNULL(i.PCT,0) / 1000.0) * i.NET_1 + 0.5 AS int)`

#### D_IVMST.13 — COST.2 / N2WSC, COST.3 / N3WSC
- **Raw:** `((PCT+1000)*NET.2)/1000` · `(PCT+1000)*NET.2/1000` · `((PCT+1000)*NET.3)/1000` · `(PCT+1000)*NET.3/1000` · `MD2Z`
- **English:** Same surcharge applied to Price-2 / Price-3.
- **SQL:** `(ISNULL(i.PCT,0) + 1000) * 1.0 * ISNULL(i.NET_2,0) / 1000` ; `(ISNULL(i.PCT,0) + 1000) * 1.0 * ISNULL(i.NET_3,0) / 1000`

#### D_IVMST.14 — SCOST
- **Raw:** `IF NET.3 GE 1 THEN ((PCT+1000)*NET.3)/1000 ELSE ((PCT+1000)*NET.1)/1000` · `MD2Z,`
- **English:** Surcharged Price-3 if Price-3 is set, else surcharged Price-1.
- **SQL:** `(ISNULL(i.PCT,0) + 1000) * 1.0 * CASE WHEN ISNULL(i.NET_3,0) >= 1 THEN i.NET_3 ELSE ISNULL(i.NET_1,0) END / 1000`

#### D_IVMST.15 — DHCOST / DHNET
- **Raw:** DHCOST `((PCT+1000)*NET.1)/1000; IF @1>99999 THEN OCONV(INT(@1/100+.5),'MD,') ELSE OCONV(@1,'MD2')` · DHNET `IF NET.1>99999 THEN OCONV(INT(NET.1/100+.5),'MD,') ELSE OCONV(NET.1,'MD2')`
- **English:** Text price. Above $999.99 it shows rounded whole dollars with thousands separators; otherwise dollars and cents.
- **SQL:** `CASE WHEN v > 99999 THEN FORMAT(CAST(v / 100.0 + 0.5 AS int), 'N0') ELSE FORMAT(ROUND(v, 0) / 100.0, 'N2') END` where `v` = COST.1 expression (DHCOST) or `i.NET_1` (DHNET). `N2` adds commas, which MD2 does not; use `'0.00'` to match exactly.

#### D_IVMST.16 — CL.NET / CL.NET.1
- **Raw:** CL.NET `(NET.1 * 105/100)` · `MD2Z` · CL.NET.1 `INT((NET.1*1.05)+.5)` · `MD2,`
- **English:** Customer-list price = Price-1 + 5%. CL.NET.1 rounds half-up to the cent.
- **SQL:** `ISNULL(i.NET_1,0) * 105.0 / 100` ; `CAST(ISNULL(i.NET_1,0) * 1.05 + 0.5 AS int)`

#### D_IVMST.17 — SAVE / PCT.SAVE
- **Raw:** SAVE `NET.1-NET.2` · `MD2Z` · PCT.SAVE `SAVE*1000/NET.1` · `MD1`
- **English:** Cents saved by the quantity price, and the saving as a percent of Price-1 in tenths.
- **SQL:** `ISNULL(i.NET_1,0) - ISNULL(i.NET_2,0)` ; `ISNULL((ISNULL(i.NET_1,0) - ISNULL(i.NET_2,0)) * 1000.0 / NULLIF(i.NET_1,0), 0)`

#### D_IVMST.18 — DS.DIFF
- **Raw:** `DS.CHG*1000/NET.1` · `MD1Z` · heading "DS.PCT"
- **English:** Drop-ship charge as a percent of Price-1, in tenths.
- **SQL:** `ISNULL(ISNULL(i.DS_CHG,0) * 1000.0 / NULLIF(i.NET_1,0), 0)`

#### D_IVMST.19 — MCOST.1 / MNET.1
- **Raw:** MCOST.1 `(SUM(AMT.REC)/STOCK)*1.07` · `MD2Z` "NEW MEM COST" · MNET.1 `(((SUM(AMT.RECD)/STOCK)*107)/101)` · `MD2Z` "NEW PRICE 1"
- **English:** Proposed member cost = average cost + 7%. Proposed Price-1 = that ÷ 1.01.
- **SQL:** `ISNULL(s.AMT_REC_SUM * 1.0 / NULLIF(s.STOCK,0), 0) * 1.07` ; `ISNULL(s.AMT_REC_SUM * 1.0 / NULLIF(s.STOCK,0), 0) * 107 / 101`
- **Depends on:** MV receipts (IVMST_REC).

#### D_IVMST.20 — NETNET
- **Raw:** `IF VEND = 479 OR VEND = 497 THEN (COST.1*92)/100 ELSE (COST.1*99)/100` · `MD2` · "NET/NET"
- **SQL:** `cost1 * CASE WHEN i.VEND IN (479, 497) THEN 92 ELSE 99 END / 100.0`, where `cost1` = the D_IVMST.12 expression.

#### D_IVMST.21 — DNETNET
- **Raw:** `IF VEND = 479 OR VEND = 497 THEN (COST.1*88)/100 ELSE (COST.1*99)/100` · `MD2` · "6% NET/NET"
- **SQL:** `cost1 * CASE WHEN i.VEND IN (479, 497) THEN 88 ELSE 99 END / 100.0`

#### D_IVMST.22 — RALNET
- **Raw:** `IF VEND = 479 OR VEND = 497 THEN (COST.1*90)/100 ELSE (COST.1*97)/100` · `MD2` · "NET/NET"
- **SQL:** `cost1 * CASE WHEN i.VEND IN (479, 497) THEN 90 ELSE 97 END / 100.0`

#### D_IVMST.23 — DATING / QTR
- **Raw:** DATING `IF VEND = 479 OR VEND = 497 THEN 'Y' ELSE ''` · QTR `IF VEND = 479 OR VEND = 497 THEN 'YES' ELSE 'NO'`
- **SQL:** `CASE WHEN i.VEND IN (479, 497) THEN 'Y' ELSE '' END` ; `CASE WHEN i.VEND IN (479, 497) THEN 'YES' ELSE 'NO' END`

#### D_IVMST.24 — TERMS2
- **Raw:** `IF VEND = 700 OR VEND = 992 OR VEND = 999 OR VEND = 900 THEN 0 ELSE 6`
- **SQL:** `CASE WHEN i.VEND IN (700, 992, 999, 900) THEN 0 ELSE 6 END`

#### D_IVMST.25 — PTERMS
- **Raw:** `IF VENDOR = 700 OR VENDOR = 992 OR VENDOR = 900 THEN "0" ELSE "2"`
- **SQL:** `CASE WHEN i.VEND IN (700, 992, 900) THEN '0' ELSE '2' END`

#### D_IVMST.32 — VBRAND
- **Raw:** `IF BRAND='PROMASTER' THEN 2869 ELSE AVEND`, where BRAND = `TRANS(BRANDS,BID,NAME,'X')`
- **English:** The AP vendor is 2869 for the ProMaster brand, otherwise the stored actual vendor.
- **SQL:** `CASE WHEN b.NAME = 'PROMASTER' THEN 2869 ELSE i.AVEND END` with `LEFT JOIN BRANDS b ON b.ID = i.BID`
- **Depends on:** TRANS BRANDS.

#### D_IVMST.34 — PMCCALC
- **Raw:** `IF (MAP*1.10) < 1 OR (MAP*1.10) GE (RETAIL*.95) THEN (RETAIL*.95) ELSE (MAP*1.10)` · `MD2Z`
- **English:** Sell price = MAP + 10%, unless MAP is empty or MAP + 10% reaches Retail − 5%. In those cases it is Retail − 5%.
- **SQL:** `CASE WHEN ISNULL(i.MAP,0) * 1.10 < 1 OR ISNULL(i.MAP,0) * 1.10 >= ISNULL(i.RETAIL,0) * 0.95 THEN ISNULL(i.RETAIL,0) * 0.95 ELSE i.MAP * 1.10 END`

#### D_IVMST.35 — PMCSELL
- **Raw:** `TRANS(PMCSELL,@ID,SELL,'X');IF @1 = '' THEN PMCCALC ELSE @1` · `MD2Z`
- **English:** The manual override from the PMCSELL file if present, else PMCCALC.
- **SQL:** `COALESCE(NULLIF(ps.SELL, ''), <PMCCALC expr>)` with `LEFT JOIN PMCSELL ps ON ps.ID = i.PROD`
- **Depends on:** TRANS PMCSELL.

#### D_IVMST.36 — PMCCALC.OLD
- **Raw:** `IF MAP GE 1 THEN MAP*1.10 ELSE RETAIL*.95` · `MD2Z`
- **SQL:** `CASE WHEN ISNULL(i.MAP,0) >= 1 THEN i.MAP * 1.10 ELSE ISNULL(i.RETAIL,0) * 0.95 END`

#### D_IVMST.37 — MAP.MARGIN
- **Raw:** `MAP-COST;IF @1>0 THEN @1*1000/MAP ELSE ''` · `MD1` (COST = attr 8 = NET.1)
- **SQL:** `CASE WHEN ISNULL(i.MAP,0) - ISNULL(i.NET_1,0) > 0 THEN (i.MAP - ISNULL(i.NET_1,0)) * 1000.0 / i.MAP END`

#### D_IVMST.38 — T.RETAIL
- **Raw:** `IF MAP THEN MAP ELSE RETAIL;@1*SUM(QTY.REC)` · `MD02Z,`
- **SQL:** `CASE WHEN ISNULL(i.MAP,0) <> 0 THEN i.MAP ELSE ISNULL(i.RETAIL,0) END * ISNULL(s.STOCK,0)`

#### D_IVMST.39 — WMAP / MAP.BU
- **Raw:** WMAP `IF MAP = '' THEN '     ' ELSE MAP` · MAP.BU `TRANS(IVMST.BU,@ID,MAP,'X')`
- **SQL:** `i.MAP` (blank-padding is presentation) ; `bu.MAP` from `LEFT JOIN IVMST_BU bu ON bu.PROD = i.PROD`
- **Depends on:** TRANS IVMST.BU.

#### D_IVMST.40 — BASE.PROFIT
- **Raw:** `NET.1-RAW` · `MD2`
- **SQL:** `ISNULL(i.NET_1,0) - r.RAW_N`  (`RAW_N` = 0 for a `Y` raw, as in UniVerse)

#### D_IVMST.41 — PERC
- **Raw:** `(NET.1-LAST.COST)*1000/LAST.COST` · `MD1` · "Percent"
- **SQL:** `ISNULL((ISNULL(i.NET_1,0) - ISNULL(i.LAST_COST,0)) * 1000.0 / NULLIF(i.LAST_COST,0), 0)`

#### D_IVMST.42 — MARGIN
- **Raw:** `IF COST.1 = 0 THEN 0 ELSE IF STOCK>0 THEN ((COST.1 - EA)/COST.1) * 1000 ELSE ''` · `MD1Z` (EA = average cost, D_IVMST.45)
- **SQL:** `CASE WHEN cost1 = 0 THEN 0 WHEN s.STOCK > 0 THEN (cost1 - s.AMT_REC_SUM * 1.0 / s.STOCK) / cost1 * 1000 END`

#### D_IVMST.43 — RMARGIN
- **Raw:** `IF RAW > 0 AND COST.1 > 0 THEN ((COST.1 - RAW)/COST.1) * 100 ELSE ''` · `MD2Z` · "RAW MARGIN"
- **English:** Raw margin percent, displayed ÷100 by MD2 (25% shows 0.25). A yen RAW passes `RAW > 0` as a string and is then used as 0.
- **SQL (as built):** `CASE WHEN (r.RAW_IS_FX = 1 OR r.RAW_N > 0) AND cost1 > 0 THEN (cost1 - r.RAW_N) / cost1 * 100 END` (display as value/100 to match).

#### D_IVMST.44 — PROFIT / CASE.PROFIT
- **Raw:** PROFIT `SUM(QTY.REC); IF @1=0 THEN 'None' ELSE NET.1-SUM(AMT.REC)/@1` · `MD2Z,` · CASE.PROFIT `SUM(QTY.REC); IF @1=0 THEN 'None' ELSE (NET.1-SUM(AMT.REC)/@1)*CASE` · `MD2`
- **SQL:** `CASE WHEN ISNULL(s.STOCK,0) = 0 THEN NULL /* 'None' */ ELSE i.NET_1 - s.AMT_REC_SUM * 1.0 / s.STOCK END` ; same `* ISNULL(i.[CASE],0)`

#### D_IVMST.45 — Average cost family
| Item | Raw | Conv | SQL |
|---|---|---|---|
| AVG.COST, AVG.CST | `SUM(QTY.REC); IF @1 = 0 THEN 0 ELSE SUM(AMT.REC)/@1` | MD2Z | `ISNULL(s.AMT_REC_SUM * 1.0 / NULLIF(s.STOCK,0), 0)` |
| AVG | `IF COUNT(RAW,'Y') THEN OCONV(RAW,'MCN')*10000/TRANS(CONTROL,'YEN.CONV',F2,'X') ELSE RAW;SUM(QTY.REC); IF @2 = 0 THEN 0 ELSE SUM(AMT.REC)/@2` | MD2 | same as AVG.COST (the @1 currency step is unused) |
| EACH | `SUM(AMT.REC)/STOCK` | MD2Z | `ISNULL(s.AMT_REC_SUM * 1.0 / NULLIF(s.STOCK,0), 0)` |
| EA | `IF AMT.REC > 0 THEN SUM(AMT.REC)/STOCK ELSE ''` | MD2Z | `CASE WHEN s.AMT_REC_SUM > 0 THEN s.AMT_REC_SUM * 1.0 / NULLIF(s.STOCK,0) END` |
| UNIT.VALUE | `IF STOCK>0 THEN SUM(AMT.REC)/STOCK ELSE RAW` | MD2Z | `CASE WHEN s.STOCK > 0 THEN s.AMT_REC_SUM * 1.0 / s.STOCK ELSE r.RAW_N END` |
| EA.REC (MV) | `AMT.REC/QTY.REC` | MD2 | per lot: `ISNULL(x.AMT_REC * 1.0 / NULLIF(x.QTY_REC,0), 0)` |
| AVG.RECD (MV) | `AMT.RECD/QTY.REC` | MD2 | same as EA.REC |

**Depends on:** MV receipts. AVG also reads CONTROL `YEN.CONV` (result unused).

#### D_IVMST.46 — AVG.REC (two copies, MV)
- **Raw A:** `IF COUNT(RAW,'Y') THEN OCONV(RAW,'MCN')*10000/TRANS(CONTROL,'YEN.CONV',F2,'X') ELSE RAW;IF QTY.REC = 0 OR QTY.REC = '' THEN 0 ELSE SUBR('-DIVS',AMT.REC,QTY.REC)` · "Avg Recv"
- **Raw B:** `… ;IF QTY.REC = 0 OR QTY.REC = '' THEN @1 ELSE SUBR('-DIVS',AMT.REC,QTY.REC)` · "Avg Each"
- **English:** Unit cost per receipt lot. When there are no lots, copy A gives 0 and copy B gives raw cost in US cents. (`QTY.REC = 0` tests the whole multivalued string, so the fallback triggers only when there are no lots at all.)
- **SQL (B):** per lot `ISNULL(x.AMT_REC * 1.0 / NULLIF(x.QTY_REC,0), 0)`; if the product has no lots → `yraw_10000` (YRAW with factor 10000 for every group)
- **Depends on:** CONTROL `YEN.CONV` attr 2; MV receipts.

#### D_IVMST.47 — AVG.ERR
- **Raw:** `SUM(QTY.REC);IF COUNT(RAW,'Y') THEN OCONV(RAW,'MCN')*10000/TRANS(CONTROL,'YEN.CONV',F2,'X') ELSE RAW; IF @1 = 0 THEN @2 ELSE INT(SUM(AMT.REC)/@1+.5); IF @3 < @2*.80 > @3 OR @3 > @2*1.10 THEN 'YES' ELSE ''`
- **English (intended):** Flag when the rounded average cost is below 80% or above 110% of raw cost in US cents. **As built:** only the above-110% branch works reliably.
- **SQL (as built):** `CASE WHEN (CASE WHEN avgc < rawc * 0.80 THEN 1 ELSE 0 END) > avgc OR avgc > rawc * 1.10 THEN 'YES' ELSE '' END` with `rawc` = yen-converted raw (factor 10000), `avgc` = `CASE WHEN ISNULL(s.STOCK,0)=0 THEN rawc ELSE CAST(s.AMT_REC_SUM * 1.0 / s.STOCK + 0.5 AS int) END`. **Intended:** `CASE WHEN avgc < rawc * 0.80 OR avgc > rawc * 1.10 THEN 'YES' ELSE '' END`
- **Depends on:** CONTROL `YEN.CONV` attr 2; MV receipts.

#### D_IVMST.48 — COST.DIFF / DIFF.COST / AVG.DIFF
- **Raw:** COST.DIFF `SUM(QTY.REC); IF @1>0 THEN SUM(AMT.REC)-(RAW*@1) ELSE ''` (MD2Z,) · DIFF.COST `LAST.COST-RAW` (conv `M2`) · AVG.DIFF `LAST.COST-AVG` (MD2)
- **SQL:** `CASE WHEN s.STOCK > 0 THEN s.AMT_REC_SUM - r.RAW_N * s.STOCK END` ; `ISNULL(i.LAST_COST,0) - r.RAW_N` ; `ISNULL(i.LAST_COST,0) - ISNULL(s.AMT_REC_SUM * 1.0 / NULLIF(s.STOCK,0), 0)`

#### D_IVMST.49 — Valuations
| Item | Raw | Conv | SQL |
|---|---|---|---|
| GROSS, VALUE, IVAL, S.VALUE, TIVAL, VALUE1 | `SUM(AMT.REC)` | MD2,/MD02,/MD2Z, | `ISNULL(s.AMT_REC_SUM,0)` |
| REVALUE | `STOCK*LAST.COST` | MD2Z, / MD02Z, (two copies) | `ISNULL(s.STOCK,0) * ISNULL(i.LAST_COST,0)` |
| WHOLESALE | `SUM(QTY.REC)*NET.1` | MD02Z, | `ISNULL(s.STOCK,0) * ISNULL(i.NET_1,0)` |
| OVAL | `L.NET.AVAIL*COST.1` (L.NET.AVAIL = `STOCK-REQ`) | MD2Z, | `(ISNULL(s.STOCK,0) - ISNULL(i.REQ,0)) * cost1` |
| VALUE.DIFF | `VALUE-COST.1*STOCK` | MD02Z, | `ISNULL(s.AMT_REC_SUM,0) - cost1 * ISNULL(s.STOCK,0)` |
| A.VALUE | `TRANS(PHYSLOG,@ID,QTY,'X');IF STOCK>0 THEN (SUM(AMT.REC)/STOCK)*SUM(@1) ELSE RAW*SUM(@1)` | MD2Z, | `CASE WHEN s.STOCK > 0 THEN s.AMT_REC_SUM * 1.0 / s.STOCK ELSE r.RAW_N END * ISNULL(pl.QTY_SUM,0)` (pl = SUM(QTY) from PHYSLOG for the product) |
| YTD.SALES | `NET.1*SUM(YTD)` | MD2Z, | `ISNULL(i.NET_1,0) * ISNULL(ytd.SHIP_SUM,0)` |
| TOT.SALE | `COST*STOCK` (COST = NET.1) | MD02, | `ISNULL(i.NET_1,0) * ISNULL(s.STOCK,0)` |
| EVAL44288.4 | `STOCK*COST/100` | MD0Z | `ISNULL(s.STOCK,0) * ISNULL(i.NET_1,0) / 100.0` (whole dollars) |
| EVAL41708.1 | `RAW*QUAN` | MD2 | `r.RAW_N * ISNULL(i.QUAN,0)` |

Note: in D_IVMST, `STOCK` is the I-type `SUM(QTY.REC)`. **Depends on:** MV receipts; TRANS PHYSLOG (A.VALUE).

#### D_IVMST.50 — RAW.VALUE
- **Raw:** `NET.1*STOCK/2` · `MD2Z,`
- **SQL:** `ISNULL(i.NET_1,0) * ISNULL(s.STOCK,0) / 2.0`

#### D_IVMST.51 — OPEN.VALUE / OPEN.VALUE.2 / VEND.VALUE
- **Raw OPEN.VALUE (MV):** `RAW ; IF COUNT(@1,'Y') THEN TRANS(CONTROL,'YEN',F1,'X')*100*OCONV(@1,'MCN') ELSE @1; PO.QTY+BO.QTY ; REUSE(@2) * @3` · `MD02,Z$`
- **Raw OPEN.VALUE.2 (MV):** `RAW ; IF COUNT(@1,'Y') AND COO = "J" THEN TRANS(CONTROL,'YEN',F1,'X')*100*OCONV(@1,'MCN') ELSE IF COUNT(@1,'Y') AND COO = "C" THEN TRANS(CONTROL,'RMB',F1,'X')*100*OCONV(@1,'MCN') ELSE @1; PO.QTY+BO.QTY ; REUSE(@2) * @3` · `MD02,Z$`
- **Raw VEND.VALUE:** `TRANS(CONTROL,'YEN',F1,'X')*100;IF INDEX(RAW,'Y',1) THEN ORDERED*OCONV(RAW,'MCN')*@1 ELSE ORDERED*RAW` · `MD02Z,` (ORDERED = `SUM(PO.QTY)+SUM(BO.QTY)`)
- **English:** Open purchase value in US cents per PO line (OPEN.VALUE*) or in total (VEND.VALUE), shown in whole dollars. Unit cost = raw converted with the `YEN` (or `RMB`) rate × 100.
- **SQL (OPEN.VALUE.2, per PO row p):** `(ISNULL(p.PO_QTY,0) + ISNULL(p.BO_QTY,0)) * CASE WHEN r.RAW_IS_FX = 1 AND i.COO = 'J' THEN ISNULL(ctl.YEN_F1,0) * 100 * r.RAW_MCN WHEN r.RAW_IS_FX = 1 AND i.COO = 'C' THEN ISNULL(ctl.RMB_F1,0) * 100 * r.RAW_MCN ELSE r.RAW_N END`. OPEN.VALUE drops the COO test and uses YEN for any `Y`. VEND.VALUE = `SUM` of the same over all PO rows (yen only).
- **Depends on:** CONTROL `YEN` F1, `RMB` F1; MV PO lines.

#### D_IVMST.52 — ORD.VALUE
- **Raw:** `IF INDEX(RAW,'Y',1) THEN REQ*NET.1 ELSE REQ*RAW` · `MD02Z,`
- **SQL:** `ISNULL(i.REQ,0) * CASE WHEN r.RAW_IS_FX = 1 THEN ISNULL(i.NET_1,0) ELSE r.RAW_N END`

#### D_IVMST.53 — EXT.PO.COST / VNDAVG / VNDCST
- **Raw EXT.PO.COST (MV):** `SUBR('!ADDS',PO.QTY,BO.QTY);SUBR('!MULS',@1,PO.CST)` · `MD2,`
- **Raw VNDAVG:** `INDEX(RAW,'Y',1); SUM(PO.QTY); SUM(SUBR('-FIELDS',PO.CST,REUSE('Y'),1,1)*PO.QTY); IF @3=0 THEN 0 ELSE @3/@2; IF @1=0 THEN @4 ELSE INT(@4+.5)` · `MD2Z`
- **Raw VNDCST:** `INDEX(RAW,'Y',1); SUBR('-ADDS',PO.QTY,PO.BO); SUM(SUBR('-FIELDS',PO.CST,REUSE('Y'),1,1)*@2); IF @1=0 THEN OCONV(@3,'MD2,') ELSE OCONV(INT(@3+.5),'MD0,')`
- **English:** Extended PO cost per line. Weighted-average PO unit cost (ordered qty only). Total open PO cost (ordered + back-ordered). The yen versions use the amount before the `Y` and round to whole yen.
- **SQL:** per PO row `(ISNULL(p.PO_QTY,0) + ISNULL(p.BO_QTY,0)) * ISNULL(TRY_CAST(p.PO_CST AS decimal(19,4)),0)` ; VNDAVG `ISNULL(SUM(pcst * p.PO_QTY) * 1.0 / NULLIF(SUM(p.PO_QTY),0), 0)` (then `CAST(x + 0.5 AS int)` when yen) ; VNDCST `SUM(pcst * (p.PO_QTY + p.BO_QTY))` (rounded when yen), with `pcst = TRY_CAST(LEFT(p.PO_CST, CHARINDEX('Y', p.PO_CST + 'Y') - 1) AS decimal(19,4))`
- **Depends on:** MV PO lines.

#### D_IVMST.54 — IMPORT
- **Raw:** `TRANS(APMST,AVEND,MISC,'X'); IF @1 = "IMPORT" THEN "Y" ELSE ""`
- **SQL:** `CASE WHEN ap.MISC = 'IMPORT' THEN 'Y' ELSE '' END` with `LEFT JOIN APMST ap ON ap.ID = i.AVEND`
- **Depends on:** TRANS APMST.

#### D_IVMST.55 — Price-change dates
| Item(s) | Raw | Position | SQL |
|---|---|---|---|
| DT.CREATED (MN.CREATED, YEAR, YR.CREATED are the same value in month/year formats) | `FIELD(DATES,@VM,1)` | 1 | `DATEADD(day, d.V1, '1967-12-31')` |
| NET.1.DATE, PRICE.CHG, PRICE.1.CHG | `FIELD(DATES,@VM,2)` | 2 | `DATEADD(day, d.V2, '1967-12-31')` |
| NET.2.DATE, PRICE.2.CHG, DC.3 | `FIELD(DATES,@VM,3)` | 3 | `DATEADD(day, d.V3, '1967-12-31')` |
| PRICE.3.CHG | `FIELD(DATES,@VM,4)` | 4 | `DATEADD(day, d.V4, '1967-12-31')` |
| RAW.CHG, RAW.DATE | `FIELD(DATES,@VM,5)` | 5 | `DATEADD(day, d.V5, '1967-12-31')` |
| MAP.CHG | `FIELD(DATES,@VM,6)` | 6 | `DATEADD(day, d.V6, '1967-12-31')` |

`d.Vn` = value n of attr 11 (side table IVMST_DATES(PROD, SEQ, DATE) pivoted by SEQ).

#### D_IVMST.56 — WEBDT
- **Raw:** `IF DATE() - DATE > 45 THEN '' ELSE DATE` · `D2/`
- **SQL (intended):** `CASE WHEN DATEDIFF(day, DATEADD(day, d.V1, '1967-12-31'), CAST(GETDATE() AS date)) > 45 THEN NULL ELSE DATEADD(day, d.V1, '1967-12-31') END` (which value of DATES is intended: confirm)

#### D_IVMST.57 — TERMSDATA lookups
| Item | Raw | SQL |
|---|---|---|
| TERMS | `TRANS(TERMSDATA,@ID,PERC,'X'); IF @1 = '' THEN 0 ELSE @1` | `ISNULL(NULLIF(t.PERC,''),0)` |
| CSPK | `TRANS(TERMSDATA,@ID,CSPK,'X'); IF @1 = '' THEN 0 ELSE @1` | `ISNULL(NULLIF(t.CSPK,''),0)` |
| TDOPCT1 … TDOPCT15 | `TRANS(TERMSDATA,@ID,OPCTn,'X'); IF @1 = '' THEN 0 ELSE @1` | `ISNULL(NULLIF(t.OPCTn,''),0)` |
| FBILL | `TRANS(TERMSDATA,@ID,FTR,'X')` | `t.FTR` |
| TDED, TDOST, TDOQA, TDOQQ, TDOAQ | `TRANS(TERMSDATA,@ID,<EXPD/OST/OQA/OQQ/OAQ>,'X')` | `t.EXPD`, `t.OST`, `t.OQA`, `t.OQQ`, `t.OAQ` |

`LEFT JOIN TERMSDATA t ON t.PROD = i.PROD`. **Depends on:** TRANS TERMSDATA.

#### D_IVMST.58 — TEMP.RAW / TEMP.NET.1 / TEMP.MAP
- **Raw:** `TRANS(TEMP,@ID,F1,'X')` / `…F2…` / `…F3…`
- **SQL:** `tmp.F1`, `tmp.F2`, `tmp.F3` from `LEFT JOIN TEMP tmp ON tmp.ID = i.PROD`
- **Depends on:** TRANS TEMP.

---

### Items from other dictionaries

#### D_SCANORD.01 — ACOST / EXT.COST / S.EXT.COST (MV, per order line)
- **Raw ACOST:** `TRANS(IVMST,PROD,NET.2,'X');TRANS(IVMST,PROD,QUAN,'X');SUBR('-ANDS',SUBR('-GTS',@1,REUSE(0)),SUBR('-GES',QUAN,@2));SUBR('-MULS',@1,@3);SUBR('-MULS',SUBR('-NOTS',@3),COST);SUBR('-ADDS',@4,@5)` · `MD2`. EXT.COST and S.EXT.COST add `; SUBR('-MULS',@6,QS)` (× shipped qty).
- **English:** Unit cost = Price-2 if Price-2 > 0 and ordered qty ≥ the product's SP-QTY, else the line's own cost. Extended = unit × shipped qty.
- **SQL:** `CASE WHEN ISNULL(iv.NET_2,0) > 0 AND l.QUAN >= ISNULL(iv.QUAN,0) THEN iv.NET_2 ELSE l.COST END` ; `… * l.QS`
- **Depends on:** TRANS IVMST.

#### D_SCANORD.02 — CL.NET / SJL2
- **Raw CL.NET:** `TRANS(IVMST,PROD,NET.1,'X'); TRANS(ARMST,MEMBER,TP,'X') ; IF @2 = 7 THEN SUBR('!DIVS',SUBR('!MULS',@1,REUSE(105)),REUSE(100)) ELSE @1` · `MD2`. SJL2 (heading "Prof") first works out average cost (or LAST.COST when nothing is received) but never uses it. It ends with the same type-7 test, so it returns a price, not a profit.
- **SQL:** `CASE WHEN m.TP = 7 THEN iv.NET_1 * 105.0 / 100 ELSE iv.NET_1 END`
- **Depends on:** TRANS IVMST, ARMST.

#### D_ORDHIST.01 — CL.PRICE / CL.SPQ.PRICE / CLS.SPQ.PRICE
- **Raw:** `TRANS(CONTROL,'CL.SURCHG',F2,'X'); (@1+100); SUBR('!MULS',REUSE(@2),NET.1); SUBR('!DIVS',@3,REUSE(100))` · `MD2` (SPQ versions use NET.2)
- **SQL:** `iv.NET_1 * (ISNULL(ctl.CL_SURCHG_F2,0) + 100) / 100.0` ; `iv.NET_2 * (…)`
- **Depends on:** CONTROL `CL.SURCHG` F2; TRANS IVMST.

#### D_ORDHIST.02 — TEST.NET1
- **Raw:** `SUBR('!GTS',COST,REUSE(1.10)*NET.1)` (per line, COST = ORDHIST attr 4)
- **SQL:** `CASE WHEN l.COST > 1.10 * iv.NET_1 THEN 1 ELSE 0 END`

#### D_ORDHIST.03 — SPC.PCT
- **Raw:** `REUSE(TRANS(IVMST,PROD,VENDOR,'X')); TRANS(VNMST,@1,SPC.PCT,'X')`
- **SQL:** `vn.SPC_PCT` via `JOIN IVMST iv ON iv.PROD = l.PROD LEFT JOIN VNMST vn ON vn.ID = iv.VEND`
- **Depends on:** TRANS IVMST, VNMST.

#### D_IVPO.01 — COST.$ (MV)
- **Raw:** `TRANS(CONTROL,'YEN',F1,'X')*10000;SUBR('-COUNTS',COST,REUSE('Y'));SUBR('!FIELDS',COST,'Y',1,1);SUBR('-DIVS',SUBR('-MULS',SUBR('-MULS',@2,REUSE(@1)),@3),REUSE(100));SUBR('-MULS',SUBR('-EQS',@2,REUSE(0)),@3);SUBR('-ADDS',@4,@5)` · `MD2,`
- **English:** PO line cost in cents: a yen cost × YEN F1 × 100; otherwise unchanged.
- **SQL:** `CASE WHEN CHARINDEX('Y', l.COST) > 0 THEN TRY_CAST(LEFT(l.COST, CHARINDEX('Y', l.COST) - 1) AS decimal(19,4)) * ISNULL(ctl.YEN_F1,0) * 10000 / 100 ELSE TRY_CAST(l.COST AS decimal(19,4)) END`
- **Depends on:** CONTROL `YEN` F1.

#### D_IVPO.02 — FG.QO / FG.QR (MV)
- **Raw:** FG.QO `IF FG.PCT > 0 THEN QUAN * INT(REUSE(FG.PCT/100)+.5) ELSE 0` · FG.QR `IF FG.PCT > 0 THEN QTY.INT(REC * REUSE(FG.PCT/100)+.5) ELSE 0`
- **English (intended):** Free units = qty × FG% rounded to whole units.
- **SQL (as built, FG.QO):** `CASE WHEN po.FG_PCT > 0 THEN l.QUAN * CAST(po.FG_PCT / 100.0 + 0.5 AS int) ELSE 0 END` · **intended:** `CASE WHEN po.FG_PCT > 0 THEN CAST(l.QUAN * po.FG_PCT / 100.0 + 0.5 AS int) ELSE 0 END` (FG.QR the same with QTY_REC)

#### D_MAP.PRICE.01 — MARGIN / COST
- **Raw:** COST `TRANS(IVMST,@ID,NET.1,'X')` · MARGIN `(MAP-COST)*1000/MAP` · `MD1`
- **SQL:** `ISNULL((mp.MAP - iv.NET_1) * 1000.0 / NULLIF(mp.MAP,0), 0)` (no "> 0" guard, unlike MAP.MARGIN)
- **Depends on:** TRANS IVMST.

#### D_IVMST.SALE.01 — SALE.1 … SALE.5
- **Raw:** `IF NUM(SALE-n) THEN SALE-n*100 ELSE SALE-n` · `MD2,` (one copy of SALE.3 returns '' for non-numeric)
- **SQL:** `CASE WHEN TRY_CAST(s.SALE_n AS decimal(19,4)) IS NOT NULL THEN TRY_CAST(s.SALE_n AS decimal(19,4)) * 100 ELSE NULL END`

#### D_TEMP.01 — NET.1 / RETAIL / MAP
- **Raw:** `F2 * 100`, `F3 * 100`, `F4 * 100` · `MD2`
- **SQL:** `ISNULL(TRY_CAST(t.F2 AS decimal(19,4)),0) * 100` (F3, F4 alike)

#### D_RECLOG.01–.03 — FUJI / DMAMT.AMT
- **Raw:** FUJI `IF AVEND=3114 OR AVEND=3555 THEN FUJI.REB*AMOUNT/100 ELSE ''` · DMAMT.AMT `IF AVEND=3114 OR AVEND=3555 THEN (DMAMT-2)*AMOUNT/100 ELSE ''` · `MD2Z,`
- **SQL:** `CASE WHEN rl.AVEND IN (3114, 3555) THEN rl.FUJI_REB * rl.AMOUNT / 100.0 END` ; `CASE WHEN rl.AVEND IN (3114, 3555) THEN (rl.DMAMT - 2) * rl.AMOUNT / 100.0 END`

#### D_RECLOG.04 — FG.AMT
- **Raw:** `TRANS(IVPO,PO,FG.PCT,'X')*AMOUNT/100` · `MD2Z,`
- **SQL:** `ISNULL(po.FG_PCT,0) * rl.AMOUNT / 100.0`
- **Depends on:** TRANS IVPO.

#### D_NUMBER.01 — V.TYPE (vendor-group labels)
- **Raw:** `IF VENDOR=479 THEN 'BAG-TRPD' ELSE IF VENDOR=497 THEN 'MISC-MDS' ELSE IF VENDOR=950 THEN 'HAZDROUS' ELSE IF VENDOR=992 THEN 'CAM-MEM' ELSE IF VENDOR=700 THEN 'PRO-FILM' ELSE IF VENDOR=900 THEN 'LTL-MDS' ELSE ''`
- **SQL:** `CASE n.VENDOR WHEN 479 THEN 'BAG-TRPD' WHEN 497 THEN 'MISC-MDS' WHEN 950 THEN 'HAZDROUS' WHEN 992 THEN 'CAM-MEM' WHEN 700 THEN 'PRO-FILM' WHEN 900 THEN 'LTL-MDS' ELSE '' END`

#### D_IVORD.01 — TEST
- **Raw:** `ORDER;TRANS(VNORD,'700':@1,@ID,'X');TRANS(VNORD,'900':@1,@ID,'X');TRANS(VNORD,'497':@1,@ID,'X');TRANS(VNORD,'479':@1,@ID,'X');TRANS(VNORD,'992':@1,@ID,'X'); IF @2 # '' OR @3 # '' OR @4 # '' OR @5 # '' OR @6 # '' THEN 'FND' ELSE ''`
- **SQL:** `CASE WHEN EXISTS (SELECT 1 FROM VNORD v WHERE v.ID IN (CONCAT('700',o.[ORDER]), CONCAT('900',o.[ORDER]), CONCAT('497',o.[ORDER]), CONCAT('479',o.[ORDER]), CONCAT('992',o.[ORDER]))) THEN 'FND' ELSE '' END` (approximation: the original also requires the attribute named by @ID to be non-empty)
- **Depends on:** TRANS VNORD.

#### D_VENDRA.01 — VALUE (D_VENDRA) / VALUE (D_VENDRET)
- **Raw (VENDRA):** `TRANS(IVMST,PROD,RAW,'X'); SUBR('-EQS',@1,REUSE(''));SUBR('-MULS',@2,PROD);TRANS(IVMST.DISC,@3,RAW,'X');SUBR('-CATS',@1,@4);SUBR('-COUNTS',@5,REUSE('Y'));SUBR('-OCONVS',@5,'MCN');SUBR('-MULS',@7,QUAN); SUBR('-MULS',@6,REUSE(TRANS(CONTROL,'YEN',F1,'X'))); SUBR('-MULS',@8,@9); SUBR('-EQS',@6,REUSE(0)); SUBR('-MULS',@8,@11); SUBR('-ADDS',@12,@10)` · `MD2Z,`
- **English:** Return value = qty × raw (from IVMST, or IVMST.DISC if discontinued). Yen: qty × yen × YEN F1 (no ×100).
- **SQL:** `rq.QUAN * CASE WHEN CHARINDEX('Y', rw.RAW) > 0 THEN dbo.fn_MCN(rw.RAW) * ISNULL(ctl.YEN_F1,0) ELSE dbo.fn_MCN(rw.RAW) END` with `rw.RAW = COALESCE(NULLIF(iv.RAW,''), ivd.RAW)`. D_VENDRET is the same except it starts from `iv.LAST_COST` instead of `iv.RAW` for active products.
- **Depends on:** CONTROL `YEN` F1; TRANS IVMST, IVMST.DISC.

#### D_ORDER.01 — VALUE
- **Raw:** `IF RAW[LEN(RAW),1]='Y' THEN 'YEN' ELSE QUAN*RAW` · `MD2Z,`
- **SQL:** `CASE WHEN RIGHT(o.RAW,1) = 'Y' THEN 'YEN' ELSE CAST(o.QUAN * TRY_CAST(o.RAW AS decimal(19,4)) AS varchar(30)) END`

---

## Appendix I — Formula index (item → rule)

| # | Dictionary | Item | Rule |
|---|---|---|---|
| 1 | D_IVMST | YRAW | D_IVMST.03/.04/.33 |
| 2 | D_IVMST | USACOST | D_IVMST.05 |
| 3 | D_IVMST | AUS.COST | D_IVMST.06 |
| 4 | D_IVMST | AUSCOST (copy A, divide) | D_IVMST.06 |
| 5 | D_IVMST | AUSCOST (copy B, multiply) | D_IVMST.06 |
| 6 | D_IVMST | TEST.YEN | D_IVMST.07 |
| 7 | D_IVMST | AUS.YEN.S1 | D_IVMST.07 |
| 8 | D_IVMST | AUS.YEN.S2 | D_IVMST.07 |
| 9 | D_IVMST | YEN | D_IVMST.08 |
| 10 | D_IVMST | RMB | D_IVMST.08 |
| 11 | D_IVMST | AUS.YEN | D_IVMST.08 |
| 12 | D_IVMST | AUS.RMB | D_IVMST.08 |
| 13 | D_IVMST | RMB.AUS | D_IVMST.08 |
| 14 | D_IVMST | RMB.CONV | D_IVMST.08 |
| 15 | D_IVMST | YEN.CONV | D_IVMST.08 |
| 16 | D_IVMST | REPRICE | D_IVMST.09 |
| 17 | D_IVMST | REPRICE1 | D_IVMST.09 |
| 18 | D_IVMST | SALE1 | D_IVMST.10 |
| 19 | D_IVMST | SJL | D_IVMST.11 |
| 20 | D_IVMST | YEN.TEST | D_IVMST.11 |
| 21 | D_IVMST | COST.1 | D_IVMST.12 |
| 22 | D_IVMST | N1WSC | D_IVMST.12 |
| 23 | D_IVMST | WCOST | D_IVMST.12 |
| 24 | D_IVMST | COST.2 | D_IVMST.13 |
| 25 | D_IVMST | N2WSC | D_IVMST.13 |
| 26 | D_IVMST | COST.3 | D_IVMST.13 |
| 27 | D_IVMST | N3WSC | D_IVMST.13 |
| 28 | D_IVMST | SCOST | D_IVMST.14 |
| 29 | D_IVMST | DHCOST | D_IVMST.15 |
| 30 | D_IVMST | DHNET | D_IVMST.15 |
| 31 | D_IVMST | CL.NET | D_IVMST.16 |
| 32 | D_IVMST | CL.NET.1 | D_IVMST.16 |
| 33 | D_IVMST | SAVE | D_IVMST.17 |
| 34 | D_IVMST | PCT.SAVE | D_IVMST.17 |
| 35 | D_IVMST | DS.DIFF | D_IVMST.18 |
| 36 | D_IVMST | MCOST.1 | D_IVMST.19 |
| 37 | D_IVMST | MNET.1 | D_IVMST.19 |
| 38 | D_IVMST | NETNET | D_IVMST.20 (+.26/.27) |
| 39 | D_IVMST | DNETNET | D_IVMST.21 (+.26/.27) |
| 40 | D_IVMST | RALNET | D_IVMST.22 (+.26/.27) |
| 41 | D_IVMST | DATING | D_IVMST.23 |
| 42 | D_IVMST | QTR | D_IVMST.23 |
| 43 | D_IVMST | TERMS2 | D_IVMST.24 (+.28–.31) |
| 44 | D_IVMST | PTERMS | D_IVMST.25 (+.28–.30) |
| 45 | D_IVMST | VBRAND | D_IVMST.32 |
| 46 | D_IVMST | PMCCALC | D_IVMST.34 |
| 47 | D_IVMST | PMCSELL | D_IVMST.35 |
| 48 | D_IVMST | PMCCALC.OLD | D_IVMST.36 |
| 49 | D_IVMST | MAP.MARGIN | D_IVMST.37 |
| 50 | D_IVMST | T.RETAIL | D_IVMST.38 |
| 51 | D_IVMST | WMAP | D_IVMST.39 |
| 52 | D_IVMST | MAP.BU | D_IVMST.39 |
| 53 | D_IVMST | BASE.PROFIT | D_IVMST.40 |
| 54 | D_IVMST | PERC | D_IVMST.41 |
| 55 | D_IVMST | MARGIN | D_IVMST.42 |
| 56 | D_IVMST | RMARGIN | D_IVMST.43 |
| 57 | D_IVMST | PROFIT | D_IVMST.44 |
| 58 | D_IVMST | CASE.PROFIT | D_IVMST.44 |
| 59 | D_IVMST | AVG.COST | D_IVMST.45 |
| 60 | D_IVMST | AVG.CST | D_IVMST.45 |
| 61 | D_IVMST | AVG | D_IVMST.45 |
| 62 | D_IVMST | EACH | D_IVMST.45 |
| 63 | D_IVMST | EA | D_IVMST.45 |
| 64 | D_IVMST | UNIT.VALUE | D_IVMST.45 |
| 65 | D_IVMST | EA.REC | D_IVMST.45 |
| 66 | D_IVMST | AVG.RECD | D_IVMST.45 |
| 67 | D_IVMST | AVG.REC (copy A) | D_IVMST.46 |
| 68 | D_IVMST | AVG.REC (copy B) | D_IVMST.46 |
| 69 | D_IVMST | AVG.ERR | D_IVMST.47 |
| 70 | D_IVMST | COST.DIFF | D_IVMST.48 |
| 71 | D_IVMST | DIFF.COST | D_IVMST.48 |
| 72 | D_IVMST | AVG.DIFF | D_IVMST.48 |
| 73 | D_IVMST | GROSS | D_IVMST.49 |
| 74 | D_IVMST | VALUE | D_IVMST.49 |
| 75 | D_IVMST | IVAL | D_IVMST.49 |
| 76 | D_IVMST | S.VALUE | D_IVMST.49 |
| 77 | D_IVMST | TIVAL | D_IVMST.49 |
| 78 | D_IVMST | VALUE1 | D_IVMST.49 |
| 79 | D_IVMST | REVALUE | D_IVMST.49 |
| 80 | D_IVMST | WHOLESALE | D_IVMST.49 |
| 81 | D_IVMST | OVAL | D_IVMST.49 |
| 82 | D_IVMST | VALUE.DIFF | D_IVMST.49 |
| 83 | D_IVMST | A.VALUE | D_IVMST.49 |
| 84 | D_IVMST | YTD.SALES | D_IVMST.49 |
| 85 | D_IVMST | TOT.SALE | D_IVMST.49 |
| 86 | D_IVMST | EVAL44288.4 | D_IVMST.49 |
| 87 | D_IVMST | EVAL41708.1 | D_IVMST.49 |
| 88 | D_IVMST | RAW.VALUE | D_IVMST.50 |
| 89 | D_IVMST | OPEN.VALUE | D_IVMST.51 |
| 90 | D_IVMST | OPEN.VALUE.2 | D_IVMST.51 |
| 91 | D_IVMST | VEND.VALUE | D_IVMST.51 |
| 92 | D_IVMST | ORD.VALUE | D_IVMST.52 |
| 93 | D_IVMST | EXT.PO.COST | D_IVMST.53 |
| 94 | D_IVMST | VNDAVG | D_IVMST.53 |
| 95 | D_IVMST | VNDCST | D_IVMST.53 |
| 96 | D_IVMST | IMPORT | D_IVMST.54 |
| 97 | D_IVMST | DT.CREATED | D_IVMST.55 |
| 98 | D_IVMST | NET.1.DATE | D_IVMST.55 |
| 99 | D_IVMST | PRICE.CHG | D_IVMST.55 |
| 100 | D_IVMST | PRICE.1.CHG | D_IVMST.55 |
| 101 | D_IVMST | NET.2.DATE | D_IVMST.55 |
| 102 | D_IVMST | PRICE.2.CHG | D_IVMST.55 |
| 103 | D_IVMST | DC.3 | D_IVMST.55 |
| 104 | D_IVMST | PRICE.3.CHG | D_IVMST.55 |
| 105 | D_IVMST | RAW.CHG | D_IVMST.55 |
| 106 | D_IVMST | RAW.DATE | D_IVMST.55 |
| 107 | D_IVMST | MAP.CHG | D_IVMST.55 |
| 108 | D_IVMST | WEBDT | D_IVMST.56 |
| 109 | D_IVMST | TERMS | D_IVMST.57 |
| 110 | D_IVMST | CSPK | D_IVMST.57 |
| 111 | D_IVMST | FBILL | D_IVMST.57 |
| 112 | D_IVMST | TDOPCT1 | D_IVMST.57 |
| 113 | D_IVMST | TDOPCT2 | D_IVMST.57 |
| 114 | D_IVMST | TDOPCT3 | D_IVMST.57 |
| 115 | D_IVMST | TDOPCT4 | D_IVMST.57 |
| 116 | D_IVMST | TDOPCT5 | D_IVMST.57 |
| 117 | D_IVMST | TDOPCT6 | D_IVMST.57 |
| 118 | D_IVMST | TDOPCT7 | D_IVMST.57 |
| 119 | D_IVMST | TDOPCT8 | D_IVMST.57 |
| 120 | D_IVMST | TDOPCT9 | D_IVMST.57 |
| 121 | D_IVMST | TDOPCT10 | D_IVMST.57 |
| 122 | D_IVMST | TDOPCT11 | D_IVMST.57 |
| 123 | D_IVMST | TDOPCT12 | D_IVMST.57 |
| 124 | D_IVMST | TDOPCT13 | D_IVMST.57 |
| 125 | D_IVMST | TDOPCT14 | D_IVMST.57 |
| 126 | D_IVMST | TDOPCT15 | D_IVMST.57 |
| 127 | D_IVMST | TDED | D_IVMST.57 |
| 128 | D_IVMST | TDOST | D_IVMST.57 |
| 129 | D_IVMST | TDOQA | D_IVMST.57 |
| 130 | D_IVMST | TDOQQ | D_IVMST.57 |
| 131 | D_IVMST | TDOAQ | D_IVMST.57 |
| 132 | D_IVMST | TEMP.RAW | D_IVMST.58 |
| 133 | D_IVMST | TEMP.NET.1 | D_IVMST.58 |
| 134 | D_IVMST | TEMP.MAP | D_IVMST.58 |
| 135 | D_SCANORD | ACOST | D_SCANORD.01 |
| 136 | D_SCANORD | EXT.COST | D_SCANORD.01 |
| 137 | D_SCANORD | S.EXT.COST | D_SCANORD.01 |
| 138 | D_SCANORD | CL.NET | D_SCANORD.02 |
| 139 | D_SCANORD | SJL2 | D_SCANORD.02 |
| 140 | D_ORDHIST | CL.PRICE | D_ORDHIST.01 |
| 141 | D_ORDHIST | CL.SPQ.PRICE | D_ORDHIST.01 |
| 142 | D_ORDHIST | CLS.SPQ.PRICE | D_ORDHIST.01 |
| 143 | D_ORDHIST | TEST.NET1 | D_ORDHIST.02 |
| 144 | D_ORDHIST | SPC.PCT | D_ORDHIST.03 |
| 145 | D_IVPO | COST.$ | D_IVPO.01 |
| 146 | D_IVPO | FG.QO | D_IVPO.02 |
| 147 | D_IVPO | FG.QR | D_IVPO.02 |
| 148 | D_MAP.PRICE | COST | D_MAP.PRICE.01 |
| 149 | D_MAP.PRICE | MARGIN | D_MAP.PRICE.01 |
| 150 | D_IVMST.SALE | SALE.1 | D_IVMST.SALE.01 |
| 151 | D_IVMST.SALE | SALE.2 | D_IVMST.SALE.01 |
| 152 | D_IVMST.SALE | SALE.3 | D_IVMST.SALE.01 |
| 153 | D_IVMST.SALE | SALE.4 | D_IVMST.SALE.01 |
| 154 | D_IVMST.SALE | SALE.5 | D_IVMST.SALE.01 |
| 155 | D_TEMP | NET.1 | D_TEMP.01 |
| 156 | D_TEMP | RETAIL | D_TEMP.01 |
| 157 | D_TEMP | MAP | D_TEMP.01 |
| 158 | D_RECLOG | FUJI | D_RECLOG.01–.03 |
| 159 | D_RECLOG | DMAMT.AMT | D_RECLOG.01–.03 |
| 160 | D_RECLOG | FG.AMT | D_RECLOG.04 |
| 161 | D_NUMBER | V.TYPE | D_NUMBER.01 |
| 162 | D_IVORD | TEST | D_IVORD.01 |
| 163 | D_VENDRA | VALUE | D_VENDRA.01 |
| 164 | D_VENDRA | VALUE.XL | D_VENDRA.01 |
| 165 | D_VENDRET | VALUE | D_VENDRA.01 |
| 166 | D_VENDRET | VALUE.XL | D_VENDRA.01 |
| 167 | D_ORDER | VALUE | D_ORDER.01 |

**167 formulas catalogued:** 134 D_IVMST items (two items, AUSCOST and AVG.REC, each counted once per differing copy) and 33 items from other dictionaries.
