# Vendor Desk and Product PO: build and cutover plan

PIV2 is replacing Computyme piece by piece. Each piece below runs alongside Computyme until it is switched over, and a piece switches only when everything that still reads it in Computyme is fed from PIV2.

Grounded in: the vendor discovery run (`sql/vendor-desk/00-vendor-discovery.sql`, results 2026-10-22), the rules inventory (`docs/computyme-rules/`) and the full extractions in `docs/extracted-rules/`. Rule IDs below point into those files.

## What Computyme actually has

| Thing | Where it lives | What it really is |
|---|---|---|
| **Vendor** | APMST (191 rows, 4-digit ids 1009–9087) | Who we buy from and pay. Every product's actual vendor (IVMST 37 `A.VENDOR`) points here; 81 have products. PIV2's `dbo.Vendor` already uses these ids. |
| **Vendor group** | VNMST, ids 479 / 497 / 500 / 600 / 700 / 900 / 992 / 999 | Product buckets, not vendors. 497 PRO General Merchandise holds 6,366 products across 71 real vendors; 479 Bags-Tripods-Lighting 1,832; 992 private label 918. Code hangs rules on these numbers (terms, fast shipping, returns credit, dated orders). |
| **Direct-billing program** | VNMST, the other ~46 rows (3-digit ids) | Vendors members buy from direct while PRO bills a surcharge (2–4%). No products. APID links each to its AP vendor. |
| **Brand → vendor** | `dbo.Brand.VendorID` | The only link. `dbo.VendorBrand` is empty. 93 brands point at an AP vendor, 39 have none (DJI 191 products, Phottix 374, Elinchrom 254), ProMaster points at PIV2-only vendor 1. |
| VENDXREF | not in EDA | Used only by IPBILL; nothing writes it. Ignore. |
| 171 PIV2-only vendors | `dbo.Vendor` | Dead AP vendors: no products, no brands. Already hidden in the grid. |

VNMST and APMST ids never collide (3 vs 4 digits), which is why Computyme gets away with a PO vendor field that holds either (IV46.07, IV45.03).

## The cutover pattern

New table `piv2.CutoverPiece` (Piece, Piv2IsMaster, SwitchedAt, SwitchedBy, Note), one row per piece, changed only in Security Admin and logged. `Product:SqlIsMaster` stays as it is for the product fields.

- **Before the switch:** PIV2 reads Computyme through the EDA mirror. Computyme-owned fields show the lock. Fields PIV2 owns are editable from day one.
- **The switch:** one-time copy into the PIV2 tables, flip the row. Where Computyme still reads the data (warehouse, billing, AP), PIV2 sends it back through the outbox until that consumer is cut over too.

## Pieces, in order

### 1. Brand → vendor link (PIV2 master now)
No Computyme dependency.
- Keep `Brand.VendorID` as the link; add `piv2.BrandVendorHistory` (brand, old vendor, new vendor, who, when, why) so brands can move between vendors with a trail.
- Category Desk and product filters resolve vendor through `Brand.VendorID` (today they go through VendorBrand by name, which is empty).
- Retire `dbo.VendorBrand` from the code (the table stays; nothing is dropped).
- Work list on the desk: the 39 brands with no vendor, and ProMaster → vendor 1.

### 2. Vendor Desk (vendor master)
Keyed on the AP vendor number.

| Field | Owner until AP cuts over |
|---|---|
| Name, addresses (main, payment, rep), phones, emails, dealer number, due days, PCT, surcharge %, surcharge-to-member flag (APMST 29), not-in-use | Computyme (locked) |
| Currency, structured payment terms, contacts, contracts, price lists, freight/shipping/return policies, brands, notes | PIV2 |
| Direct-billing program (from VNMST): program number, surcharge %, special deduction, admin days, PRO terms | Computyme (locked) until AR/billing cuts over |

- Terms: APMST due days are free text ("30DAYS", "10TH"; IV46.12, IV45.09). Parse into net days or day-of-month, keep the original text beside it, flag anything that doesn't parse.
- Currency is per vendor and replaces the "Y" suffix on costs (D_IVMST.02–.04). Rates come from the Product Desk exchange-rate table (pulled by button, accepted before use, overrides audited).
- Vendor returns get real statuses (requested → RA issued → shipped → credited) with serials and credit amount, instead of VENDRA's free-form screens (VEND.RA.HOLD.05, VEND.ENT.SHIP.04, UPD.VENDRA.07). Built after POs.
- New vendors: created in PIV2 below 9000 as today. While AP is still in Computyme, a new vendor also has to exist in APMST; see decision 3.

### 3. Product class (was "vendor group")
`piv2.ProductClass` (479, 497, 500, 600, 700, 900, 992, 999) holding what is hard-coded today:
net-net factors, terms %, prompt-pay %, fast shipping allowed, dated orders, returns-credit rules (D_IVMST.20–.31; the 479 test in `dbo.Product`).
- The product page shows **Class** and **Vendor** (the real one) separately. Class stays locked until product maintenance cuts over (IVMST 5 is still edited in Computyme, and changing it moves open vendor orders: IV.MNT.PROD.23, CHANGE.VNORD).

### 4. PO build on the product page
PIV2 builds and sends POs; Computyme keeps receiving them until piece 5.

Tables: `piv2.PurchaseOrder` (number, vendor = AP vendor only, status Draft / Sent / Partly received / Closed / Cancelled, currency, rate, terms, ship-to, one-time vendor details as structured fields, who/when) and `piv2.PurchaseOrderLine` (product, qty, unit cost and currency, due date, special-order link). On-order is computed from open lines, never stored on the product (the double storage is why PO.DISC, FIX.PO.CST and BLD.IVPO exist: IV.ORD.REC.15, PO.DISC.01–07).

**Suggest.** One formula with its inputs as settings, shown on the product's Order section and as a per-vendor draft:
- demand from shipped history (YTD-ship, prior year, or the PIV2 forecast) over months of supply;
- minus stock, minus on-order **including partly received balances** (every Computyme version forgets IVMST 23: IV21.07, DH1.10, IV19.04);
- rounded up to case / carton / MOQ from the product (Computyme never uses them: IV21.12–.15, DH1.11);
- grouped by real vendor (`A.VENDOR`), one draft PO per vendor (Computyme puts the whole ORDER file on one PO: IV.ORD.REC.09, IV.AUTO.ORDER.03).

**Enter.** Cost defaults to raw cost per unit in the vendor's currency; changing it on a PO doesn't change the product's raw cost (IV46.PROD.22 offers to overwrite it, with no audit). Money is entered in dollars, never "12 = 12 cents". A product whose vendor differs from the PO's vendor is blocked, not warned (IV46.PROD.10). Special orders link to a member order instead of placeholder product 555.

**Due dates.** Per PO line (ORDDUE is one date per product with no PO link and deletes itself on the day: ORDUP1.02, WHSE.DUE.05). The product's "stock due" becomes the earliest open line date, and late lines show as late.

**Side by side.** On-order and due dates on the product = PIV2 open lines + Computyme open POs from the EDA mirror (IVPO + its MV tables), by PO number. A PO sent from PIV2 goes to Computyme through the outbox so receiving keeps working there.

### 5. Receiving (later)
Replace IV.ORD.REC(.N): receipts table with qty, date, landed-cost %, exchange rate and customs entry stored per receipt (today the landed % and rate are typed per session and lost: IV.ORD.REC.22–.27); line-level close (not netted across lines: IV.ORD.REC.20); a transaction around each receipt (IV.ORD.REC.32). Cost layers and COGS restatement (IV.ORD.REC.28–.31, IV.UPD.COGS) come with it. Backorder release (IV11.AUTO) needs its own fix list before it moves.

### 6. AP (last)
Payments, the 2% special discount (AP.SEL.INVSPC) and its reversal (AP10) stay in Computyme until then.

## Bugs we don't carry over
- Surcharge ×10 on every visit to the product screen (IV.MNT.PROD.16, bug 4).
- "25" typed as a price stored as $0.25 (IV.MNT.PROD.14, IV46.PROD.21).
- Product's real vendor accepts anything since 2003 (IV.MNT.PROD.12).
- New POs with a blank vendor (IV.AUTO.ORDER.03).
- Yen and dollars added into one total (IV46.PROD.23).
- CHANGE.VNORD can overwrite the vendor on every order-number record when nothing matches (CHANGE.VNORD.03/.04). Check it before anyone runs it again.

## Decisions needed
1. **Suggested quantity:** which method do the buyers trust? IV21 (last year's remaining months, growth capped at 2×), DH1 (last year, uncapped) or the dictionary's MIN.STK (YTD/10 × months of supply)? Nothing in BP calls IV21 or DH1. Default if no answer: MIN.STK with on-order fixed and case rounding.
2. **PO numbers while both systems issue them:** Computyme takes the next number from CONTROL `IVPO`. Proposal: PIV2 issues from its own block (e.g. 900000+) so they can't collide.
3. **Getting PIV2 POs and new vendors into Computyme** until receiving and AP move: a small Computyme staging program that reads the outbox (needs a UniVerse developer), or keyed in by hand from a PIV2 print.
4. **Which programs are live:** IV.MNT.PROD.N vs IV.MNT.PROD, IV.ORD.REC.N vs IV.ORD.REC, DH1/IV19/IV20, and whether IV52/IV54 are off the menus (VOC / PRO.MENU export).
5. **Hard-coded numbers to explain:** vendors 497, 569, 1322 (skipped in member-by-vendor totals; 1322 looks like PRO's warehouse), 992 dated orders, product 555, members 1000 / 1819 / 1846 / 9985.
6. **ProMaster brand:** stays on PIV2 vendor 1 "PRO", or an AP vendor?

## Build order
1. `sql/vendor-desk/01`: `piv2.CutoverPiece`, `piv2.BrandVendorHistory`, `piv2.ProductClass` (seeded from today's hard-coded values), `piv2.VendorProgram` view over VNMST, a vendor read view over APMST + PIV2, terms parser. Non-destructive.
2. Vendor Desk screens: lock icons, brand moves, program tab, work list.
3. Category Desk vendor resolution through `Brand.VendorID`.
4. `sql/vendor-desk/02`: PO tables and the suggestion procedure; product Order section; per-vendor draft POs.
5. Outbox to Computyme for POs (after decision 3).
