# Computyme rules inventory

Every program in BP_Computyme (the Extracted-rules repo, `BP/`), read end to end, with each business rule listed, cited to source lines and given a suggested tag. This is the list of rules PIV2 has to deal with before Computyme can be retired.

**367 programs · 1567 rules**  
KEEP: 579  SIMPLIFY: 99  QUESTION: 614  OBSOLETE: 178  OBSOLETE-INTEGRATION: 56  WAREHOUSE-ONLY: 41

- `all-rules.csv` — one row per rule, with blank Decision / Owner / PIV2 home / Notes columns to work through.
- `by-domain/<Domain>.md` — the same rules grouped by program, with purpose, files, calls and suspected bugs.
- `../extracted-rules/<Domain>/<PROGRAM>.md` — full template extractions (PRO-Extraction-Prompt-v2) for the vendor, product and PO programs.

Tags: **KEEP** rebuild as is · **SIMPLIFY** right intent, cleaner build · **QUESTION** unclear, possibly buggy, or the business must answer (every hard-coded member/vendor/product number is one) · **OBSOLETE** dead or retired (COO/CFO sign-off) · **OBSOLETE-INTEGRATION** legacy file/wire format replaced by the Integration API (CTO sign-off) · **WAREHOUSE-ONLY** physical warehouse, stays with the warehouse system.

## By domain

| Domain | Programs | Rules | KEEP | SIMPLIFY | QUESTION | OBSOLETE | OBSOLETE-INTEGRATION | WAREHOUSE-ONLY |
|---|---|---|---|---|---|---|---|---|
| [Vendors](by-domain/Vendors.md) | 10 | 26 | 10 | 4 | 10 | 2 | 0 | 0 |
| [AP](by-domain/AP.md) | 10 | 38 | 20 | 4 | 8 | 3 | 3 | 0 |
| [Products](by-domain/Products.md) | 39 | 129 | 63 | 9 | 42 | 10 | 4 | 1 |
| [Inventory](by-domain/Inventory.md) | 37 | 192 | 80 | 12 | 62 | 22 | 0 | 16 |
| [Orders](by-domain/Orders.md) | 59 | 375 | 136 | 18 | 147 | 34 | 18 | 22 |
| [EDI](by-domain/EDI.md) | 9 | 109 | 37 | 8 | 54 | 2 | 8 | 0 |
| [Members](by-domain/Members.md) | 50 | 180 | 72 | 9 | 85 | 12 | 2 | 0 |
| [AR](by-domain/AR.md) | 77 | 337 | 145 | 20 | 114 | 39 | 18 | 1 |
| [Reporting](by-domain/Reporting.md) | 24 | 123 | 11 | 10 | 90 | 11 | 1 | 0 |
| [Utility](by-domain/Utility.md) | 52 | 58 | 5 | 5 | 2 | 43 | 2 | 1 |

## Programs that matter for the Vendor Desk, the product page and POs

Relevance as judged by the reader: VENDOR, PRODUCT, PO, PRICING.

| Program | Domain | Mode | Relevance | Rules | Questions | Purpose |
|---|---|---|---|---|---|---|
| AR19 | Members | Interactive | VENDOR, PO | 6 | 0 | Enters/edits member open direct-vendor POs (VENDORD) that count against the member's credit exposure. |
| AR7 | AR | Interactive | VENDOR, PO, PRICING | 28 | 12 | Direct-vendor ("non-PRO MDs") billing: for each vendor invoice shipped direct to a member, bills the member (plus PRO surcharge) on a new PRO invoice and optionally posts the vendor invoice to AP. |
| AUTO.ORDER | Orders | Staging-processor | VENDOR, PRODUCT, PO, PRICING | 11 | 5 | Creates member orders (IVORD/ORDHIST) and vendor order lines (VNORD) from TEAMPRO staging records (one record per member: PO, instructions, discount, future date, then product/qty pairs), then prints vendor orders. |
| BLD.IVPO | Inventory | Utility/maintenance | VENDOR, PRODUCT, PO | 4 | 2 | One-off (2003) conversion that builds IVPO purchase-order records from the PO multivalues stored on IVMST products. |
| CHANGE.INST | Orders | Interactive | PO | 5 | 1 | Changes the special instructions on a PRO order (ORDHIST, IVORD and all its vendor orders) if the order has not been started. |
| CHANGE.VNORD | Orders | Utility/maintenance | VENDOR, PRODUCT, PO | 5 | 3 | After a product's vendor changes, moves that product's open vendor-order lines from the old vendor's VNORD records to the new vendor's and updates NUMBER records. |
| CHG.DATING | Orders | Utility/maintenance | PO | 2 | 2 | Marks an order as 1st dated, 2nd dated, or not dated by overwriting its special-instructions field. |
| CONVERT.DATED | Orders | Interactive | PO | 2 | 1 | Converts a not-yet-started order to a 1st or 2nd dated order (2007). |
| CONVERT.TERMS | Orders | Interactive | PO, PRICING | 3 | 1 | Changes the terms value (attr 11) on an unbilled, active PRO order (03-09-11). |
| COPYWD | Products | Outbound-generator | PRODUCT, PO | 2 | 1 | Copies working files to web-data copies (IVMST.WD, IVDISC.WD, IVORD.WD, SCANORD.WD) for the member website. |
| CS.UPD.UPS | Orders | Outbound-generator | PO | 7 | 3 | For a shipped sale transaction (TRANSLOG), appends a UPS WorldShip import line to the DOWNLOADS 'UPS.CSV' staging record and indexes invoice → transaction in UPSIDX. |
| DEL.NUMBER | Orders | Utility/maintenance | PO | 3 | 2 | Deletes a shipping number record from NUMBER and resets the related vendor order (VNORD) attr 12 to 0. |
| DH1 | Products | Batch | PRODUCT, PO | 5 | 5 | 1985 suggested-order calculator: for a product group, computes reorder quantity from monthly sales history and writes it to ORDER file. |
| EDI.UPDATE | EDI | Staging-processor | VENDOR, PO, PRICING | 30 | 12 | Current EDI drop-ship ("non-PRO MDS") billing run: validates and posts vendor invoices from staging record EDI 'DATA' to member AR (ARINV/ARSHIP/ARMST) and vendor AP (APDIST/APHIST/APMST), tracks PO billing, then chains EDI.CREDIT for credit invoices. |
| FIX.DUP.PROD | Orders | Utility/maintenance | PO, PRODUCT | 3 | 1 | Fix-up (2011) removing a second occurrence of a product from SCANORD, IVORD, ORDHIST and VNORD order lines and adjusting order totals. |
| FIX.FSINV | AR | Utility/maintenance | PO | 1 | 0 | Fix-up that rewrites the <ORDERNUMBER> tag in FSINV XML invoice staging records with the member PO from ARHIST. |
| FIX.IVPO | Inventory | Utility/maintenance | PO | 1 | 0 | Fix-up (2003) re-applying receiving log (RECLOG) quantities/amounts onto PO lines in IVPO. |
| FIX.PO.CST | Products | Utility/maintenance | PO, PRODUCT | 1 | 0 | Fix-up filling missing PO cost on IVMST open-PO multivalues from IVPO. |
| FIX.TPOCST | Inventory | Utility/maintenance | PO, PRICING | 2 | 1 | Recalculates total received cost per PO line in IVPO. |
| FSINV.FIELDS | AR | Utility/maintenance | PO, PRICING | 1 | 0 | Not a program: list of XML tag names making up an FSINV electronic invoice (header and line fields). |
| INP.YEN.CONV | Products | Interactive | PRICING, PO | 1 | 1 | Maintain the single yen conversion rate in CONTROL 'YEN'. |
| IPI.PRO | Members | Utility/maintenance | PO | 7 | 3 | Converts an IPI/affiliate member account to a full PRO member under a new account number, moving AR and history records. |
| IV.AUTO.ORDER | Products | Interactive | PO, PRODUCT, VENDOR, PRICING | 6 | 2 | Turns the suggested-order work file ORDER (product → qty) into a vendor purchase order in IVPO and posts the open PO onto each product's IVMST PO fields. |
| IV.BLD.FSINV | AR | Outbound-generator | PO | 4 | 2 | Rebuilds the FSINV invoice export (XLS/XML) for Canadian members' invoices of a prior billing date and optionally emails it to PhotoSource. |
| IV.DSP.PROD | Products | Interactive | PRODUCT, VENDOR, PRICING, PO | 12 | 4 | Read-only product inquiry screen (copied from product maintenance in 2004) showing master data, costs/prices, groups, vendors, stock/PO figures and monthly order/shipment history vs prior year. |
| IV.MNT.PROD | Products | Interactive | PRODUCT, VENDOR, PRICING, PO | 18 | 3 | Product master maintenance (add/change): descriptions, groups, PRO and actual vendor, costs, price tiers, retail/MAP, surcharge %, UPC/catalog cross-refs, pack quantities, rebate %; propagates price and vendor changes to open orders. |
| IV.ORD.REC | Inventory | Interactive | PO, VENDOR, PRODUCT, PRICING | 21 | 5 | Vendor purchase-order menu (renamed IV6): enter POs (via IV46), auto-create POs from the ORDER suggestion file, and receive merchandise against IVPO/IVMST with landed cost, yen conversion and FIFO stock layers. |
| IV.UPD.SCANORD | Orders | Batch | VENDOR, PRODUCT, PO, PRICING | 34 | 14 | Auto-billing of scanned/completed warehouse shipments (SCANORD): invoices members, relieves stock FIFO layers, posts AR, sales/profit history, vendor totals, and FotoSource (Canada) invoice files. Main production billing run. |
| IV15 | Products | Interactive | PRODUCT, PO | 4 | 1 | Delete a product (archive to IVMST.DISC) or suspend it (IVMST status attr 15). |
| IV17 | Inventory | Utility/maintenance | PO | 3 | 1 | Rewrites IVMST dictionary I-descriptor formulas QR (quantity to reorder) and SUPPLY (months of supply) for an entered months-of-supply target, then compiles the dictionary. |
| IV19 | Inventory | Interactive | PO, PRODUCT | 2 | 2 | Displays outstanding vendor purchase orders stored on a product record. |
| IV20 | Inventory | Report/print | PO, VENDOR | 3 | 1 | Prints a purchase order document for a PO number from the products in an active select list. |
| IV21 | Inventory | Batch | PO, PRODUCT | 10 | 6 | Calculates a tentative reorder quantity per product for a product group/sub-group and writes it to ORDER. |
| IV45 | Inventory | Report/print | PO, VENDOR, PRICING | 8 | 4 | Displays or prints vendor purchase orders from IVPO with vendor address, bill-to/ship-to, terms, instructions and priced lines. |
| IV46 | Inventory | Interactive | PO, VENDOR | 11 | 6 | Manual purchase-order header entry/maintenance (PO number, date, vendor, terms, special instructions), handing line entry to IV46.PROD. |
| IV46.9999 | Vendors | Subroutine | VENDOR, PO | 1 | 1 | Screen-driven entry of one-time/miscellaneous vendor details (vendor 9999) into a multivalued INFO field (IVPO attr 17) using PROMPTS 'IV46.9999' definitions. |
| IV46.DSCR | Inventory | Subroutine | PO, VENDOR | 1 | 0 | Paints the IV46 PO entry screen header (PO number, PO date, primary and second vendor). |
| IV46.PROD | Inventory | Subroutine | PO, PRODUCT, PRICING, VENDOR | 14 | 7 | Multi-line PO line entry (product, qty, unit cost) for IV46; on update rewrites IVPO and the PO arrays on each IVMST product; supports special-order products. |
| IV46.SPORD | Orders | Subroutine | PO, PRICING | 6 | 2 | Special-order customer distribution: splits a special-order PO line across end customers (members or mailing-list customers) with quantities and extended sale, writing IVSPORD and IVCUST. |
| IV52 | Inventory | Interactive | PO, PRODUCT, PRICING | 8 | 2 | Generic Computyme retail-package receiving from IVPO with multi-store stock, serialized item numbers (IVINV/IVNEW), labels, and special-order customer distribution (2000). |
| IV54 | Inventory | Interactive | PO, VENDOR | 4 | 2 | Cancel (delete) an open, unreceived purchase order, removing it from products and deleting attached special orders. |
| IV56 | Inventory | Interactive | PO, PRODUCT | 5 | 2 | Cancel remaining backorder quantities on a vendor PO, either all lines or selected products (modified for PRO IVMST fields in 2003). |
| IV7 | Inventory | Interactive | PRODUCT, PRICING, PO | 8 | 1 | Manual inventory adjustments to a product's stock layers (quantity) or total stock value, logged to IVADJ with a reason. |
| IVPO.ON.ORD | Inventory | Subroutine | PO | 1 | 0 | Computes open (still on order) quantity per PO line. |
| I_IV46_COMMON | Inventory | Subroutine | PO | 2 | 1 | COMMON/EQU include for the IV46 PO programs: a 50-slot FILES() array plus PO header globals (ORDER, PO.DATE, PVND/PVNAME = PRO vendor, SVND/SVNAME = ship/secondary vendor). |
| ORD.EML | Orders | Outbound-generator | PO, PRICING | 4 | 1 | Spools a "PRO warehouse order confirmation" text per IVORD order to a hold-file named <account>-<order>.EML (later emailed by an external process). |
| ORD.EML1 | Orders | Outbound-generator | PO, PRICING | 6 | 1 | Production order-confirmation generator: for every IVORD order not yet confirmed (PS < 1), writes confirmation text to EMAIL file and marks the order confirmed. |
| ORD.PRINT | Orders | Report/print | PO | 9 | 5 | Prints warehouse pick tickets for all new VNORD member orders above CONTROL 'LASTORD', assigning sequential shipping numbers recorded in NUMBER. |
| ORDUP1 | Products | Utility/maintenance | PRODUCT, PO | 3 | 1 | Cleans ORDDUE (product due-date file) and prints a list of out-of-stock products lacking a due date so buyers can enter new dates. |
| PACK.LIST.COMPU | Orders | Report/print | PO | 6 | 2 | Prints a packing slip for one shipping number using BILL.PEND shipped quantities, showing ordered/shipped/backordered per line. |
| PO.DISC | Inventory | Batch | PO, PRODUCT, PRICING | 7 | 2 | Reconciles open purchase orders between IVPO (PO file) and the PO multivalues on IVMST (attrs 20-23), adding missing open POs to IVMST and removing fully received or orphaned POs, printing each discrepancy. |
| REPRINT.BO | Orders | Report/print | PO | 3 | 1 | Reprints pick tickets/order forms for a select list of VNORD orders on 3-part stock using operator-supplied starting shipping number (no NUMBER/CONTROL update). |
| SCAN.ORD | Orders | Interactive | PO | 7 | 1 | Warehouse scan-pick screen. The picker scans a ship ticket number, then products and quantities against the vendor order (VNORD), and marks the ticket pending or complete, which prints a packing list. |
| UPD.EDICREDITS | EDI | Staging-processor | VENDOR, PO, PRICING | 27 | 18 | "Billing for NON-PRO MDS via EDI". It processes vendor invoices for member direct-ship orders staged in EDI 'DATA'. Each invoice posts AP (APDIST/APHIST/APMST/VNMST), bills the member (ARINV/ARSHIP/ARMST/IVEND) with PRO surcharge and member terms, closes the member's vendor PO (VENDORD), and diverts credit invoices to EDICREDITS. |
| UPD.MEMEDI | Orders | Staging-processor | PRODUCT, PO, PRICING, VENDOR | 31 | 15 | Imports member purchase orders received electronically (MEMEDI 'ORDER.TXT'). It validates each order and creates PRO orders (IVORD/ORDHIST), splits them into vendor orders (VNORD) and updates product demand and member open-order totals. |
| UPD.WEBORDERS | Orders | Staging-processor | PRODUCT, PO, PRICING, VENDOR | 23 | 14 | Imports member web orders (CSV staged in WEBORDERS 'TEST_ORDER.TXT'), groups them into PRO orders, and creates IVORD/ORDHIST and per-vendor VNORD orders. It updates product demand and member open orders, and archives the lines to WEBORD.PERM. |
| WHSE.DUE | Products | Interactive | PRODUCT, PO | 2 | 1 | Records the expected inbound shipment (due-in) date for a product in ORDDUE. |
| EDI.CREDITS | EDI | Test-variant | VENDOR, PO, PRICING | 23 | 13 | Older (11/2001) copy of EDI.UPDATE, the EDI drop-ship ("non-PRO MDS") billing run; rules listed in full because it was read before EDI.UPDATE, see EDI.UPDATE for the current logic: parses vendor invoices from staging record EDI 'DATA', bills members in AR (ARINV/ARSHIP/ARMST), books AP (APDIST/APHIST/APMST), updates vendor and PO-tracking totals; negative invoices are parked in EDICREDITS. |
| IV.ORD.REC.N | Inventory | Test-variant | PO, PRODUCT, PRICING | 4 | 1 | May 2012 rework of IV.ORD.REC with a full-screen line editor, customs entry number capture and decimal yen entry. |
| IV6 | Inventory | Test-variant | PO, PRICING | 2 | 0 | Jan 2007 predecessor of IV.ORD.REC (PO ordering/receiving menu). |
| IV6.PO | Inventory | Test-variant | PO, PRICING | 3 | 1 | 2002 earlier version of IV6 with manual PO creation product-by-product. |
| ORD.EML.TEST | Orders | Test-variant | PO, PRICING | 2 | 1 | Variant of ORD.EML that writes the confirmation text into the EMAIL file (key <account>-<order>.EML) instead of a spool hold file. |
| REPRINT.ORDERS | Orders | Test-variant | PO | 1 | 0 | Copy of REPRINT.BO pointed at printer WH8100 (2001 update). |
| AP.SEL.INVSPC | AP | Interactive | VENDOR, PRICING | 11 | 2 | Selects all unpaid AP invoices for one vendor for payment while taking an extra "special" discount off each invoice. |
| AP10 | AP | Interactive | VENDOR | 4 | 1 | Cancels the entire pending AP payment selection and reverses special discounts. |
| AR.INP.PAYMNTS | AR | Interactive | VENDOR | 33 | 9 | Applies deposit-ticket checks to member open invoices (pay due, pay all, by invoice), with discounts, partial payments, adjustments and vendor credit memos that also post AP credits. |
| AR.PRT.CRDMEM | AR | Report/print | VENDOR | 3 | 0 | Lists member credit memos (ARINV code "CM" splits) for a date range, by member or by vendor, with subtotals. |
| AR.PRT.EDIINV | AR | Report/print | VENDOR, PRICING | 5 | 2 | Prints "Billing for <vendor>" invoices to members for vendor-billed (EDI) shipments held in ARSHIP, using the vendor's own product/description/qty/cost lines. |
| AR.UPD.PRO.SUB | AR | Subroutine | VENDOR | 13 | 3 | POSH-framework payment-posting screen (called from AR.UPD.DEPTICK) that applies one check to a member's open invoices with full/skip/partial/non-cash codes and writes ARINV/ARMST; an earlier (1999) alternative to AR.INP.PAYMNTS. |
| AR12 | AR | Batch | VENDOR, PRODUCT | 6 | 2 | Year-end roll: moves YTD figures to prior year and zeroes YTD counters on STOCK, IVMST, VNMST, ARMST; clears IVSOLD and IVEND. |
| AR17 | Vendors | Utility/maintenance | VENDOR | 1 | 1 | Fills IVEND attrs 4/5 with each member's combined amount and surcharge for vendors 195 and 279. |
| AR18 | Members | Interactive | VENDOR | 4 | 1 | Credits members with extra surcharge income and gross purchases from direct-billing vendors (manual entry per vendor/member). |
| AR2 | AR | Report/print | VENDOR, PRICING | 5 | 1 | Prints member invoices from ARSHIP (1994 version): PRO product lines, or a single "Billing for <vendor>" line for direct-bill vendor charges with a terms-dispute notice. |
| AR21 | Members | Utility/maintenance | VENDOR | 1 | 0 | One-off 1995 conversion setting ARMST prior-year sales from old ARMST2 YTD plus BVEND2 direct-bill amounts. |
| AR6 | Reporting | Utility/maintenance | VENDOR | 1 | 0 | Rescales the ARMST "GRAPH" dictionary item (member sales bar graph) to the current largest member's sales. |
| BUILD.UPC | Products | Utility/maintenance | VENDOR, PRODUCT | 3 | 2 | Assigns PRO-prefix UPCs to IVMST products that have none and records them in IVCAT (02-21-02). |
| EDI.CREDIT | EDI | Staging-processor | VENDOR, PRICING | 14 | 7 | Parses vendor credit memos from staging record EDI 'CREDITS' (for non-PRO "MDS" billing) and writes one EDICREDITS record per credit with computed terms and surcharge. |
| HOLD_QTRRBT.CHK | Members | Report/print | PRICING, VENDOR | 2 | 2 | Compiled (object) version of a quarterly member rebate check print program; source is not in BP. Content below is inferred only from embedded strings. |
| IPBILL | EDI | Outbound-generator | VENDOR | 5 | 2 | Builds an EDI-format billing batch (IPBILL 'DATA', same ENDOFINVOICE layout consumed by EDI.UPDATE) for imaging-service charges in a date range, one invoice per member per vendor. |
| IV.INP.RETURNS | Inventory | Interactive | PRODUCT, VENDOR | 6 | 1 | Records member product returns (for auto-credits) in RETURNS and accumulates returned quantities by reason in VNRET for vendor return tracking. |
| IV.MNT.PROD.N | Products | Interactive | PRODUCT, VENDOR, PRICING | 19 | 5 | Full-screen product master maintenance (newest variant, 2011+, adds DUTY and ENTRY.NO): add/repeat/change products, vendors, groups, costs/prices, UPC/catalog cross-refs, logistics and customs fields, with change logging and authority codes. |
| IV.PRT.PACKLIST | Orders | Report/print | VENDOR, PRICING | 9 | 5 | Prints the packing slip for an auto-billed shipment (SCANORD record) at the warehouse, showing ordered/shipped/backordered quantities and payment terms. |
| IV.UPD | Products | Utility/maintenance | PRODUCT, PRICING, VENDOR | 1 | 0 | One-off copy of fields from IVMST.AUX into IVMST for every product. |
| IV.UPD.FSINV | AR | Outbound-generator | VENDOR | 4 | 2 | Original (June 2011) builder of a pseudo-XML invoice file for FotoSource (Canada) from an ARSHIP invoice, appended into FSINV record ORDERSmmddyy. |
| IV.UPD.FSINV.XLS | AR | Outbound-generator | VENDOR, PRICING | 8 | 4 | Builds a tab-delimited (.xls) invoice/dues file for FotoSource (Canada) member billing, one row per invoice line, appended to FSINV record ORDERS/DUES<MMDDYYYY>.xls. Current version, called by IV.UPD.SCANORD (its SUBROUTINE statement still says IV.UPD.FSINV). |
| IV.UPD.RETURNS | AR | Batch | PRICING, VENDOR, PRODUCT | 12 | 4 | Auto-credits unbilled member returns: prices returned lines with surcharge, posts credit invoices to AR, updates member sales history and return statistics. |
| IV1 | Products | Interactive | PRODUCT, VENDOR, PRICING | 13 | 6 | Original product (inventory) master add/change/delete screen for core cost and vendor fields. |
| IV10 | Orders | Report/print | VENDOR | 9 | 2 | Prints new member orders (VNORD) since the last printed order on pre-printed shipping-memo stock for the warehouse, assigning a shipping number to each. |
| IV10.LJ | Orders | Report/print | VENDOR, PRODUCT | 6 | 3 | Laser-jet version of IV10 with barcoded shipping number and lines sorted by product group; current production variant. |
| IV2 | Vendors | Interactive | VENDOR, PRICING | 9 | 3 | Add or change a PRO vendor (VNMST) linked to an AP vendor (APMST) with surcharge and billing-guarantee settings. |
| IV3 | Orders | Interactive | PRICING, PRODUCT, VENDOR | 26 | 8 | Member order entry ("new order received"): terms, member credit check, ship-to, product lines with pricing tiers, freight-prepaid threshold; writes IVORD/ORDHIST and one VNORD per vendor, updates product requirements and member open orders. |
| IV3A | Orders | Batch | PRODUCT, PRICING, VENDOR | 4 | 2 | Mass-creates a "SAMPLE" order of qty 1 of chosen products for every member with zero credit status (minus an exclusion list). |
| IV4 | Orders | Interactive | VENDOR, PRODUCT, PRICING | 15 | 8 | Manual (operator-keyed) billing of PRO merchandise shipments per vendor and order: relieves stock, invoices the member, posts AR and vendor totals. Interactive predecessor of IV.UPD.SCANORD. |
| IV4B | AR | Interactive | PRICING, VENDOR, PRODUCT | 9 | 5 | Operator-keyed member returns: credits a member for returned products at current cost + surcharge, posts a credit invoice and return statistics. |
| IV5 | Orders | Interactive | PRICING, PRODUCT, VENDOR | 11 | 3 | Change quantities/costs on, or cancel, an open member order (IVORD/VNORD/ORDHIST) and keep IVMST requirements and member open-order totals in step. |
| IV9 | Vendors | Report/print | VENDOR | 1 | 0 | Prints vendor mailing labels (3-up) for up to 40 vendors in quantities that are multiples of 3. |
| PANA.RPT | Reporting | Report/print | VENDOR, PRODUCT | 3 | 2 | Builds WKDATA unit-sales totals per product for actual vendor 3121 (Panasonic) from ORDHIST over an operator date range. |
| PDF.EDI.INV | EDI | Outbound-generator | VENDOR, PRICING | 5 | 1 | Renders vendor (EDI / direct-ship) billing invoices in ARSHIP to PDF via spooler hold files (.CFG + .TXT per invoice), using vendor-supplied product, description, qty and cost. |
| PRT.EDI.CREDIT | EDI | Report/print | VENDOR, PRICING | 3 | 1 | Prints vendor (EDI) credit memos from EDICREDITS on the laser printer, using vendor-supplied line data, with "Billing for <vendor>" header. |
| PRT.EDI.INV | EDI | Report/print | VENDOR, PRICING | 1 | 0 | Laser-print version of PDF.EDI.INV: prints all ARSHIP invoices using vendor (EDI) line data with vendor "Billing for" header. |
| QTR.RBT.RPT | Members | Report/print | VENDOR, PRICING | 3 | 2 | One-off reprint of corrected 1st-quarter 1998 member rebate check stubs, breaking rebate into PRO warehouse and Konica components. |
| REBUILD.APBR | AP | Utility/maintenance | VENDOR | 2 | 0 | One-off rebuild of the AP check register (APBR) from AP distribution records in saved list APDIST.JOHN, one APBR record per check. |
| REDI.RPT | EDI | Utility/maintenance | VENDOR | 1 | 0 | Intended to reprint EDI invoices from ARHIST for an invoice-number range by calling PDF.EDI.INV. |
| RESTORE | AR | Utility/maintenance | VENDOR | 4 | 1 | Recovery tool for manually re-keying lost ARHIST (member billing of vendor invoices) records, pulling the amount from APHIST. |
| RPDF.EDI.INV | AR | Report/print | VENDOR | 5 | 2 | Reprints member billing invoices for vendor (EDI) invoices from ARHIST, as print-to-PDF hold entries with a companion .CFG file. |
| RPRT.EDI.INV | AR | Report/print | VENDOR | 5 | 2 | Older printed (HP PCL) version of RPDF.EDI.INV that prints member billing invoices for vendor invoices from ARHIST, falling back to ARHIST.00. |
| RPT.INV | AR | Report/print | VENDOR, PRODUCT | 6 | 2 | Reprints member invoices from ARHIST. It handles both warehouse product invoices and "billing for vendor" (drop-ship/vendor-direct) invoices, the latter with a terms-dispute notice. |
| RPT.VENDRA | Vendors | Report/print | VENDOR, PRODUCT | 4 | 2 | Displays or prints a vendor Return Authorization request (VENDRA record) as a "Defective merchandise return request". |
| SALES.REPORT | Reporting | Report/print | VENDOR | 6 | 5 | 1996-vs-1997 "Vendor participation" letter per member. It lists every PRO vendor program with the member's purchases in each year and flags programs under $300. |
| SLS.COMPARE | Reporting | Batch | VENDOR | 3 | 2 | Builds SALESDATA (input to SALES.REPORT). For each member it holds the vendor list (all APMST.TEMP vendors by name) with 1997 and 1996 purchases per vendor, taken from the IVEND97/BVEND2 and IVEND96/BVEND96 summaries. |
| TAMRON.RPT | Reporting | Batch | VENDOR, PRODUCT | 27 | 26 | Builds TAMDATA, which holds per-member quantity and amount sold for 24 hard-coded Tamron products, from warehouse invoices in ARHIST for a date range (vendor sales report for Tamron). |
| UPD.VENDRA | Vendors | Interactive | VENDOR, PRODUCT | 3 | 1 | Maintains the product lines of a pending vendor return authorization (VENDRA): add products, delete them, or change quantities. |
| VEND.ENT.COMP | Vendors | Interactive | VENDOR | 1 | 0 | Records the completion date of a vendor return (VENDRA attr 7). |
| VEND.ENT.RA | Vendors | Interactive | VENDOR | 1 | 0 | Records the vendor's RA number on a pending vendor return. |
| VEND.ENT.SHIP | Vendors | Interactive | VENDOR | 1 | 1 | Marks a vendor return as shipped today. |
| VEND.RA.HOLD | Vendors | Interactive | VENDOR, PRODUCT | 4 | 1 | Starts a vendor return. All pending return products for a vendor are moved from VENDRET (returns holding, keyed by product) into a new VENDRA return request numbered from CONTROL 'RA'. |
| WEBSTMT | AR | Batch | VENDOR | 7 | 3 | Rebuilds the member web-statement files. It writes one WEBSTMT record per open invoice (with discount, net and due date) and one STMTSUM per member (totals and aging). |
| AR5.LASER | AR | Test-variant | VENDOR | 3 | 0 | Laser-printer (PCL) version of AR5 statements that also shows the vendor invoice number and vendor name per line; only differences from AR5 listed. |
| AR5.LASER.INTERIM | AR | Test-variant | VENDOR | 3 | 2 | Mid-month ("interim") variant of AR5.LASER; only differences listed. |
| IV.UPD.FSINV.XML | AR | Test-variant | VENDOR | 1 | 0 | Duplicate of IV.UPD.FSINV (June 2011) producing proper '<TAG>' XML into FSINV ORDERSmmddyy.xml. |
| IV4A | AR | Test-variant | PRICING, VENDOR | 1 | 0 | 2001 interactive member-returns credit entry (older copy of IV4B). |
| RPT.INV.97 | AR | Test-variant | VENDOR | 1 | 0 | Copy of RPT.INV pointed at the 1997 archive file ARHIST.97. |
| UPDATE.ARSHIP | AR | Test-variant | VENDOR | 1 | 0 | Truncated/broken copy of UPD.EDICREDITS (member-billing half only) that was meant to rebuild ARMST/ARINV/ARSHIP from EDI invoice data. |
| ADJ.ARHIST | Products | Utility/maintenance | PRODUCT, PRICING | 3 | 2 | One-off fix-up that recalculates the cost field (attr 15) on ARHIST lines for returns using IVMST average received cost. |
| BLD.IVMST.PW | Products | Outbound-generator | PRODUCT, PRICING | 4 | 1 | Builds a tab-delimited product price list (product, description, member price, multiple, status, UPC) for Photoware users into PWDB record 'IVMST.PW'. |
| BLD.IVMST.XML | Products | Outbound-generator | PRODUCT, PRICING | 2 | 0 | Earlier XML version of the Photoware product/price feed into PWDB 'IVMST.XML'. |
| CUST.RBT | Members | Interactive | PRODUCT, PRICING | 5 | 0 | Enters consumer rebate claims for a dealer, prints the consumer rebate check, and voids checks. |
| EM.1 | Members | Interactive | PRICING | 2 | 1 | Enter a member's sales amount and rebate percentage to compute a vendor-rebate check amount stored in MISC. |
| FIX.COST | Orders | Utility/maintenance | PRICING, PRODUCT | 3 | 1 | Fix-up that re-prices lines of selected IVORD orders from current IVMST cost and recalculates order total. |
| FIX.SURCHG | Members | Utility/maintenance | PRICING | 4 | 2 | Recomputes a member's YTD sales, surcharge and PRO sales in ARMST from ORDHIST (selected externally) plus IVEND. |
| IV.ADJ | Inventory | Interactive | PRODUCT, PRICING | 17 | 3 | Multi-store retail inventory adjustments (serial change, value adjustment, warehouse reduction, delete serialized item, store bulk stock, remove batch sale date, purge log) with an IVADJ audit trail. |
| IV.UPD.COGS | Inventory | Subroutine | PRODUCT, PRICING | 5 | 4 | When a product's on-hand goes negative, backs out profit already booked on the most recent billed shipments of that product (product YTD profit and member warehouse profit) using an average cost. |
| IV.UPD.PLOG | Inventory | Batch | PRODUCT, PRICING | 7 | 1 | Posts physical inventory counts (PHYSLOG) to IVMST stock cost layers and logs adjustments to IVADJ. |
| IV8 | Orders | Interactive | PRICING, PRODUCT | 4 | 0 | Re-prices every open member order line for one product to a new cost and adjusts each member's open-order balance. |
| LJ.INV1 | AR | Report/print | PRICING | 5 | 1 | Prints laser (PCL) member invoices from a select list of ARSHIP records. |
| MC.1 | Members | Report/print | PRICING | 5 | 1 | Prints member rebate checks from the MISC work file, numbering checks sequentially and recording check number back on MISC. |
| MONEY | Utility | Subroutine | PRICING | 2 | 1 | Validates an operator-typed money string and converts it to integer cents. |
| MONEY.CONV | Utility | Subroutine | PRICING | 3 | 0 | Converts a foreign-currency amount tagged Y (yen) or R (renminbi) to USD using rates stored in CONTROL. |
| NEWAR5 | AR | Report/print | PRICING | 9 | 2 | Prints monthly member statements (three-part form) from ARINV open invoices with prompt-pay discount, past-due flags, aging totals and grand totals; advances CONTROL 'UPD' step from 3 to 4. |
| PATR.CALC | Members | Utility/maintenance | PRICING | 2 | 2 | One-year patronage dividend calculation per member in STOCK, with hard-coded totals. |
| PATR.WH | Members | Utility/maintenance | PRICING | 2 | 2 | Computes a 3% warehouse surcharge bonus per member into STOCK. |
| PDF.INV.HIST | AR | Outbound-generator | PRICING | 2 | 0 | Reprints historical member invoices from ARHIST to PDF (spooler .CFG/.TXT) for a pre-selected list. |
| PDF.INV2 | AR | Outbound-generator | PRICING | 2 | 0 | Renders all current ARSHIP member invoices to PDF via spooler hold files with an invoice background bitmap. |
| PENDINGRBT | Members | Interactive | PRODUCT, PRICING | 7 | 3 | Operator confirms consumer (end-customer) rebate claims submitted online (PENDRBTS), assigns a rebate check number, writes to RBTDATA and removes the pending record. |
| QTRDATA.LTR | Members | Report/print | PRODUCT, PRICING | 5 | 2 | Prints reminder letters to members not yet qualified for the 2% quarterly warehouse rebate, listing missing product groups and the dollar shortfall to $10,000. |
| QTRDATA.LTR1 | Members | Report/print | PRODUCT, PRICING | 5 | 5 | Later version of the reminder letter for the 5% quarterly warehouse incentive program with SKU-count minimums per product group and a selectable dollar threshold. |
| QUARTERLY.RPT | Members | Batch | PRODUCT, PRICING | 7 | 5 | Builds QTRDATA quarterly warehouse-rebate qualification per member from ARHIST for an operator date range. |
| UPD.IVMST.LCOST | Products | Utility/maintenance | PRODUCT, PRICING | 2 | 1 | Sets every product's IVMST LAST.COST (attr 28) to the unit cost of its most recent receipt. |
| UPD.RAW | Products | Utility/maintenance | PRODUCT, PRICING | 2 | 1 | Bulk-loads IVMST RAW cost (attr 19) from a staged TEMPDATA file keyed by product. |
| ENTER.MISC | Members | Test-variant | PRICING | 1 | 1 | Earlier (01/1994) version of EM.1 with a fixed rebate rate. |
| IV.MNT.PROD.O | Products | Test-variant | PRODUCT, PRICING | 1 | 0 | Copy of IV.MNT.PROD.N without DUTY/ENTRY.NO fields, using screens 'IV.MNT.PROD' / 'IV.MNT.PROD.PRMTS'. |
| IV.UPD.PLOG.TST | Inventory | Test-variant | PRODUCT, PRICING | 4 | 2 | Later (2012) version of IV.UPD.PLOG run against IVMST.TEMP / IVADJ.TEMP using saved list PLOG. |
| IV.UPD.SCANORD.PRO | Orders | Test-variant | PRICING, PRODUCT | 3 | 1 | March 2004 copy of IV.UPD.SCANORD (pre-profit, pre-Canada). |
| IV.UPD.SCANORD.SJL | Orders | Test-variant | PRICING, PRODUCT | 3 | 2 | Feb 2005 developer copy of IV.UPD.SCANORD (between .PRO and current). |
| IV3.NEW | Orders | Test-variant | PRICING | 2 | 1 | May 2006 copy of IV3 (before 2008-09 changes: no SHIPTO codes, no expedite, no '*' manual price, no 9985 freight exception). |
| IV3.ORIG | Orders | Test-variant | PRICING | 1 | 0 | Dec 2005 copy of IV3; products inserted in group/product sorted order rather than entry order. |
| IV3.TEST | Orders | Test-variant | PRICING | 2 | 0 | Oct 2001 copy of IV3. |
| IV4.NEW | Orders | Test-variant | PRICING | 1 | 0 | Older (1997-99) copy of IV4 despite the name; no ORDHIST update. |
| LJ.INV2 | AR | Test-variant | PRICING | 1 | 0 | Variant of LJ.INV1 (laser invoice print from ARSHIP) using LOOP/REPEAT, form feeds and PRINTER ON spooling. |
| LJ.INV3 | AR | Test-variant | PRICING | 1 | 0 | Near-identical copy of LJ.INV2 (laser invoice print), differing only in print column layout and no ESC E reset. |
| QUARTERLY.LY | Members | Test-variant | PRODUCT, PRICING | 5 | 4 | Variant of QUARTERLY.RPT run against archive ARHIST.01 with later-era exclusions and a $15,000 threshold. |
| UPD.MEMEDI.TST | Orders | Test-variant | PRODUCT, PRICING | 6 | 4 | 2011 test copy of UPD.MEMEDI that reads an operator-entered MEMEDI id, with all file writes commented out (dry run). It contains newer rules not present in the production UPD.MEMEDI. |
| 28200.RPT | Reporting | Report/print | PRODUCT | 5 | 2 | Builds a per-member TEMPDATA summary of quantity and amount sold for four hard-coded Olympus products from a date range of TEMPHIST (ARHIST copy). |
| AR4 | AR | Batch | PRODUCT | 8 | 2 | Month-end AR close: purges fully paid invoices, ages open invoices, assesses 1.5% service charges, rolls ARMST aging buckets and advances the AR month. |
| AR8 | Members | Batch | PRODUCT | 11 | 4 | Monthly dues billing for PRO and Affiliate members: creates a dues invoice per member (product 9995) and, for FotoSource-type members, an FSINV spreadsheet line and email. |
| BLD.IVSOLD | Reporting | Utility/maintenance | PRODUCT | 3 | 1 | Rebuilds IVSOLD (per member: products and quantities bought this year) from ARHIST for chosen members or all ("*"). |
| BLD.QS | Reporting | Utility/maintenance | PRODUCT | 1 | 0 | One-off (08-23-10) reconciliation that builds a per-member QSTEMP record comparing quantities shipped by product from SCANORD, ARHIST and IVSOLD. |
| BUILD.IVCAT | Products | Utility/maintenance | PRODUCT | 2 | 1 | Builds the IVCAT UPC→product cross-reference by generating a PRO UPC for every IVMST product (2002). |
| BUILD.PROMASTER | Members | Utility/maintenance | PRODUCT | 5 | 4 | Computes each member's PROMASTER-brand purchases from ARHIST (2002 onward) into ARMST attr 35 PROMASTER. |
| BUILD.YTD.SALES | Reporting | Utility/maintenance | PRODUCT | 1 | 0 | Builds SALES.TEMP per product (total qty sold, number of members, description, group, E-group) from the 2005 IVSOLD archive. |
| CASE.CTN | Products | Interactive | PRODUCT | 1 | 0 | Manually maintains a product's case and carton pack quantities. |
| COMPARE.QS | Reporting | Utility/maintenance | PRODUCT | 1 | 0 | One-off (08-23-10) display of products in QSTEMP not present in a member's IVSOLD. |
| COPY.UPC | Products | Utility/maintenance | PRODUCT | 1 | 0 | One-off copy of IVMST attr 29 UPC into attr 51 W.UPC/EAN for a select list. |
| COUNT.GRPS | Reporting | Report/print | PRODUCT | 2 | 1 | For a trade show, counts how many distinct E-groups each member bought in a date range (TEMPDATA). |
| COUNTRY | Products | Subroutine | PRODUCT | 1 | 0 | Translates country-of-origin codes to country names using CONTROL 'COO'. |
| CUST.RBT.CHKS | AP | Report/print | PRODUCT | 5 | 2 | Reprints/prints consumer rebate checks from RBTDATA for a check-number range not yet flagged printed. |
| CUST.RBT.LJ | AP | Interactive | PRODUCT | 9 | 1 | Enter a consumer rebate (dealer, rebate code, products, consumer address), store in RBTDATA and print the rebate check on a LaserJet; also voids checks. |
| EGRP.SALES | Reporting | Batch | PRODUCT | 4 | 2 | Rebuilds EGRPSLS: per-member sales totals by product e-group (IVMST attr 39 EGRP) for a date range from ARHIST. |
| ENTER.HST | Products | Interactive | PRODUCT | 1 | 0 | Quick entry of harmonized tariff (HS) codes onto products. |
| FIX.MON.ORDERS | Products | Utility/maintenance | PRODUCT | 1 | 0 | One-off (2007) correction moving monthly order history value 12 into value 9 of IVMST attr 17 MORD, backing up the old value to TEMP. |
| FIX.SERIAL.NOS | Inventory | Utility/maintenance | PRODUCT | 1 | 0 | One-off (2009) re-key of SERIAL.NOS to PROD:SERIAL. |
| FIX.UPC | Products | Utility/maintenance | PRODUCT | 1 | 0 | One-off (2007) copy of 12-digit UPCs from IVCAT cross-reference into IVMST attr 29 UPC. |
| FLYER.RPT | Reporting | Report/print | PRODUCT | 26 | 25 | 1998 extract of member unit purchases of specific PRO-brand AF lenses and FTD flashes from IVSOLD into TEMPDATA (for a flyer/promo). |
| FREEZA.RPT | Reporting | Report/print | PRODUCT | 12 | 11 | Extracts member units and dollars for 11 Freez-A-Frame products from ARHIST for a date range into TEMPDATA. |
| INP.SERIAL.NOS | Inventory | Interactive | PRODUCT | 5 | 1 | Capture serial numbers of cameras received, validated against per-product serial formats. |
| INP.UPC | Products | Interactive | PRODUCT | 1 | 0 | Scan a UPC onto a product. |
| IV.INP.SCANORD | Orders | Interactive | PRODUCT | 15 | 5 | Warehouse pick/pack scanning of a shipment (NUMBER → VNORD order): validates scanned products/quantities, captures serials, pends or closes the shipment in SCANORD, triggers UPS staging and packing list. |
| IV.PI.COUNT | Inventory | Interactive | PRODUCT | 4 | 1 | Physical inventory count entry for warehouse scanners, logging counts per product and employee. |
| IV11 | Orders | Report/print | PRODUCT | 7 | 1 | Prints backorder pick tickets ("backorders ready to ship") for open VNORD orders containing products of a chosen group or a typed list of up to 300 products, assigning shipping numbers. |
| IV11.AUTO | Orders | Batch | PRODUCT | 16 | 8 | Automatic backorder allocation and printing: finds products with stock, allocates available stock to oldest open orders, builds BKORD, then prints barcoded backorder tickets and marks orders printed. Runs from receiving when CONTROL ABO = 1 (per comment). |
| IV13 | Inventory | Utility/maintenance | PRODUCT | 2 | 1 | Rebuild IVMST member-order requirement (attr 3 REQ) from open member orders in IVORD. |
| IV16 | Products | Interactive | PRODUCT | 4 | 0 | Merge one product's sales history into another product, archive and delete the old product, and re-point IVSOLD sales to the kept product. |
| IV18 | Orders | Report/print | PRODUCT | 2 | 0 | Report of open member orders (IVORD) grouped by product with quantity, cost, extended value, member name, PO and ship date. |
| IV22 | Products | Interactive | PRODUCT | 1 | 0 | Edit the deletion date (attr 11) of a discontinued product in IVMST.DISC. |
| I_IVMNT_COMMON | Products | Subroutine | PRODUCT | 1 | 0 | Large COMMON block shared by the product-maintenance (IV.MNT.PROD*) programs: the product record R(150), screen state, file handles and many working variables. |
| I_MEQ.ERROR | Inventory | Report/print | PRODUCT | 3 | 1 | Include used by IV.MEQ.ERRORS, IV.PI.MEQ, IV.TRAN.MEQ to print/display MEQ (scanner transfer) errors and purge old error lists. |
| I_READ_IVCAT | Products | Subroutine | PRODUCT | 1 | 0 | Include that resolves a scanned/entered value (catalog no./UPC) to a PRO product number via the IVCAT cross-reference. |
| LENS.RPT | Reporting | Report/print | PRODUCT | 4 | 3 | Rebuilds LENSDATA with per-member year-to-date quantity and dollars of group-1 (lens) products from all ARHIST invoices. |
| LOOKUP | Inventory | Interactive | PRODUCT | 1 | 0 | Operator looks up a lens part number in PARTS and sees its description (attr 2) and bin location (attr 1). |
| LOWEPRO.RPT | Reporting | Report/print | PRODUCT | 3 | 1 | Builds TEMPDATA per member with quantity and dollars sold of four specific Lowepro product codes for an operator-entered date range. |
| MAX | Products | Utility/maintenance | PRODUCT | 1 | 0 | One-off load copying MAXLEVEL attr 1 into IVMST attr 34 for every MAXLEVEL key. |
| MEMORY.RPT | Reporting | Report/print | PRODUCT | 3 | 2 | Builds TEMPDATA per member with qty and dollars of eight ProMaster memory product codes for an operator date range. |
| MINOLTA.RPT | Reporting | Report/print | PRODUCT | 2 | 1 | Same template as LOWEPRO.RPT for four Minolta product codes. |
| OLYMPUS.RPT | Reporting | Report/print | PRODUCT | 2 | 1 | Same template as LOWEPRO.RPT for three Olympus product codes. |
| PRO.LBL | Products | Report/print | PRODUCT | 1 | 0 | Prints small 4-across product labels (product # + description) in quantities from the ORDER work file, descriptions from FILTERS. |
| REBUILD.MSALES | Products | Utility/maintenance | PRODUCT | 2 | 2 | Rebuilds MSALES (per-product quantity and sales dollars) by accumulating ARHIST invoice lines from an active select list. |
| RETURNS.BY.MEMBER | Reporting | Report/print | PRODUCT | 6 | 3 | Report of member returns (RETURNS.10) totalled per member, shown against the member's PROMASTER purchases as a return percentage, to the screen, a printer, or an Excel download. |
| RPT.LJ.INV | AR | Report/print | PRODUCT | 4 | 1 | LaserJet (PCL) reprint of member product invoices from ARHIST, with a fallback to ARHIST.98. |
| SET.DISCARD | Products | Utility/maintenance | PRODUCT | 1 | 0 | Operator marks products as discontinued by setting IVMST attr 41 (DISCD) = 1. |
| UNIQUE.PROD.CNT | Reporting | Report/print | PRODUCT | 4 | 1 | Report of how many distinct products each member bought (and, in detail mode, the quantity per product) in a date range, from ARHIST invoices. |
| UPC.CODE | Products | Utility/maintenance | PRODUCT | 2 | 1 | Calculates the full UPC-A for a PRO 4-digit product code using PRO's UPC manufacturer prefix. |
| UPD.IVMST.QREC | Inventory | Utility/maintenance | PRODUCT | 2 | 0 | One-off 2008 fix-up that folds the physical-inventory (PLOG) adjustment receipt layers dated on PI days into the preceding (older) receiving layer in IVMST. |
| UPD.UPC | Products | Utility/maintenance | PRODUCT | 1 | 1 | Copies UPCs from the IVCAT cross-reference into IVMST attr 29 (UPC). |
| UPD.UPS | Orders | Outbound-generator | PRODUCT | 9 | 5 | Subroutine that appends a ship ticket to the UPS WorldShip import CSVs (UPS_DOM, plus UPS_INT customs lines for Canada) held as records in the UPS file. It writes 3 copies (.CSV, _2.CSV, _4.CSV). |
| UPD.WH | Members | Batch | PRODUCT | 7 | 5 | Year-end accumulation for the co-op STOCK record. It adds each member's purchases of camera products (IVMST EGRP 59) from the ARHIST.11 archive into STOCK attr 9. |
| UPDATE.UPC | Products | Utility/maintenance | PRODUCT | 1 | 0 | One-off that copies IVMST UPC (attr 29) into W.UPC (attr 51, warehouse UPC/EAN) for an active select list. |
| WH.DATA | Inventory | Interactive | PRODUCT | 8 | 0 | Warehouse product maintenance screen for case qty, carton qty, weight, dimensions and primary/secondary bin locations on IVMST, with a field-level change log to IVMST.LOG. |
| XX | Members | Utility/maintenance | PRODUCT | 2 | 2 | One-off correction that reduces members' warehouse profit (ARMST attr 40 WH.PROFIT) for units of product 9832 on a saved list of ARHIST invoices. |
| BUILD.PROMASTER.2 | Members | Test-variant | PRODUCT | 1 | 0 | Copy of BUILD.PROMASTER run against ARMST2 / ARHIST.01 / IVMST2 (2001 archive files); only differences listed. |
| CUSTRBT.LJ | AP | Test-variant | PRODUCT | 2 | 1 | Duplicate of CUST.RBT.LJ (consumer rebate entry + check print) with a different check layout including a MICR line. |
| CUSTRBT.NEW | AP | Test-variant | PRODUCT | 1 | 0 | Copy of CUST.RBT.LJ that records consumer rebates in RBTDATA without printing a check (checks printed later by CUST.RBT.CHKS). |
| CUSTRBTNEW1 | AP | Test-variant | PRODUCT | 2 | 1 | Variant of CUSTRBT.NEW that takes the next rebate check number from CONTROL instead of operator entry; no void function. |
| IV11.DHPRT | Orders | Test-variant | PRODUCT | 5 | 2 | 2010 manual backorder print (IV11.LJ lineage) routed to printer DHPRT; adds dated-order skip and pick location. |
| PENTAX.RPT | Reporting | Test-variant | PRODUCT | 1 | 1 | Copy of MINOLTA.RPT repurposed for a single Pentax ZXL product code. |
| RPT.LJ.INVC | AR | Test-variant | PRODUCT | 1 | 0 | Copy of RPT.LJ.INV. |
| X | Inventory | Test-variant | PRODUCT | 1 | 0 | Developer call of IV.UPD.COGS for one product. |

## All programs

| Program | Domain | Mode | Lines | Rules | Purpose |
|---|---|---|---|---|---|
| 28200.RPT | Reporting | Report/print | 40 | 5 | Builds a per-member TEMPDATA summary of quantity and amount sold for four hard-coded Olympus products from a date range of TEMPHIST (ARHIST copy). |
| ADJ | Members | Utility/maintenance | 9 | 1 | Manually decrements a member's STOCK warehouse-profit figure by an operator-entered amount. |
| ADJ.ARHIST | Products | Utility/maintenance | 25 | 3 | One-off fix-up that recalculates the cost field (attr 15) on ARHIST lines for returns using IVMST average received cost. |
| AP.SEL.INVSPC | AP | Interactive | 126 | 11 | Selects all unpaid AP invoices for one vendor for payment while taking an extra "special" discount off each invoice. |
| AP10 | AP | Interactive | 38 | 4 | Cancels the entire pending AP payment selection and reverses special discounts. |
| AR.ADJ.CY | AR | Utility/maintenance | 18 | 2 | Year-roll/reset style fix-up that sets every member's current-year high credit to the current balance. |
| AR.CHANGE | AR | Utility/maintenance | 10 | 2 | One-off script that re-keys selected ARHIST records to member 2829 (moves history from one member to another). |
| AR.INP.DEPTICK | AR | Interactive | 433 | 10 | Enters and edits cash deposit tickets (member account, check number, check amount per line) that payments are later applied against. |
| AR.INP.PAYMNTS | AR | Interactive | 1137 | 33 | Applies deposit-ticket checks to member open invoices (pay due, pay all, by invoice), with discounts, partial payments, adjustments and vendor credit memos that also post AP credits. |
| AR.INQ.DEPTICK | AR | Subroutine | 107 | 2 | POSH screen-framework hook for the deposit ticket inquiry screen (inquiry only, optional print). |
| AR.PRT.CRDMEM | AR | Report/print | 167 | 3 | Lists member credit memos (ARINV code "CM" splits) for a date range, by member or by vendor, with subtotals. |
| AR.PRT.EDIINV | AR | Report/print | 83 | 5 | Prints "Billing for <vendor>" invoices to members for vendor-billed (EDI) shipments held in ARSHIP, using the vendor's own product/description/qty/cost lines. |
| AR.RPT.DEPTICK | AR | Report/print | 46 | 1 | Detail or summary report of deposit tickets in a ticket-number range (amounts, unapplied, discount adj, CM, adjustments). |
| AR.SHIP.MNT | Members | Interactive | 436 | 11 | Maintains a member's alternate ship-to addresses (SHIPTO records keyed member*code) with UPS zone derived from ZIP. |
| AR.TEST.SUB | AR | Utility/maintenance | 38 | 1 | One-off diagnostic (GJS 12-27-1999) counting ARINV records that have multiple partial payments. |
| AR.UPD.PRO.SUB | AR | Subroutine | 793 | 13 | POSH-framework payment-posting screen (called from AR.UPD.DEPTICK) that applies one check to a member's open invoices with full/skip/partial/non-cash codes and writes ARINV/ARMST; an earlier (1999) alternative to AR.INP.PAYMNTS. |
| AR1 | Members | Interactive | 124 | 11 | Adds new members (auto-numbered) or changes existing member master data (name, address, credit limit, phone, mailings, dues, EIN). |
| AR10 | AR | Batch | 28 | 3 | After invoice printing, copies ARSHIP to ARHIST, clears ARSHIP, and deletes billed SCANORD records. |
| AR11 | AR | Utility/maintenance | 26 | 1 | Recomputes ARMST aging buckets and balance from ARINV open invoices (marked "DON'T USE"). |
| AR12 | AR | Batch | 67 | 6 | Year-end roll: moves YTD figures to prior year and zeroes YTD counters on STOCK, IVMST, VNMST, ARMST; clears IVSOLD and IVEND. |
| AR13 | Members | Report/print | 33 | 4 | Prints annual member stock (patronage share) letters (1986). |
| AR14 | Members | Utility/maintenance | 18 | 1 | Sequentially numbers ARMST/ARMST2 field 28, 29, 33, 34 or 35 from an active select list. |
| AR15 | Members | Utility/maintenance | 13 | 1 | Calculator for member share buyout to cap holdings at a percentage of total shares. |
| AR16 | Members | Interactive | 34 | 2 | Toggles a member's credit-hold status. |
| AR17 | Vendors | Utility/maintenance | 27 | 1 | Fills IVEND attrs 4/5 with each member's combined amount and surcharge for vendors 195 and 279. |
| AR18 | Members | Interactive | 55 | 4 | Credits members with extra surcharge income and gross purchases from direct-billing vendors (manual entry per vendor/member). |
| AR19 | Members | Interactive | 128 | 6 | Enters/edits member open direct-vendor POs (VENDORD) that count against the member's credit exposure. |
| AR1A | Members | Interactive | 120 | 4 | Copy of AR1 for adding/changing IPI (non-PRO) members; only differences listed. |
| AR1B | Members | Interactive | 137 | 6 | Copy of AR1A (05-26-11) for adding/changing Canadian affiliate members; only differences listed. |
| AR2 | AR | Report/print | 71 | 5 | Prints member invoices from ARSHIP (1994 version): PRO product lines, or a single "Billing for <vendor>" line for direct-bill vendor charges with a terms-dispute notice. |
| AR20 | Members | Interactive | 36 | 2 | Adds/changes a member's permanent ship-to address on ARMST and resets the UPS zone from the ship-to ZIP. |
| AR21 | Members | Utility/maintenance | 17 | 1 | One-off 1995 conversion setting ARMST prior-year sales from old ARMST2 YTD plus BVEND2 direct-bill amounts. |
| AR3 | AR | Interactive | 285 | 16 | Original member payment entry (no deposit ticket): pays due/all/selected invoices with prompt-pay discount, records credits, updates ARMST/ARINV and stamps date paid on ARHIST. |
| AR4 | AR | Batch | 76 | 8 | Month-end AR close: purges fully paid invoices, ages open invoices, assesses 1.5% service charges, rolls ARMST aging buckets and advances the AR month. |
| AR5 | AR | Report/print | 107 | 7 | Prints monthly member statements (three-part pre-printed form) with prompt-pay discount and past-due flags, and advances the month-end state. |
| AR5.LASER | AR | Test-variant | 151 | 3 | Laser-printer (PCL) version of AR5 statements that also shows the vendor invoice number and vendor name per line; only differences from AR5 listed. |
| AR5.LASER.INTERIM | AR | Test-variant | 152 | 3 | Mid-month ("interim") variant of AR5.LASER; only differences listed. |
| AR5.OFFICE | AR | Test-variant | 154 | 1 | Office-copy variant of AR5.LASER; only differences listed. |
| AR6 | Reporting | Utility/maintenance | 21 | 1 | Rescales the ARMST "GRAPH" dictionary item (member sales bar graph) to the current largest member's sales. |
| AR7 | AR | Interactive | 398 | 28 | Direct-vendor ("non-PRO MDs") billing: for each vendor invoice shipped direct to a member, bills the member (plus PRO surcharge) on a new PRO invoice and optionally posts the vendor invoice to AP. |
| AR8 | Members | Batch | 119 | 11 | Monthly dues billing for PRO and Affiliate members: creates a dues invoice per member (product 9995) and, for FotoSource-type members, an FSINV spreadsheet line and email. |
| AR9 | Reporting | Report/print | 29 | 2 | Prints the monthly totals report from CONTROL 'MS' and, if statements are done, resets the month cycle. |
| AR9.BU | Reporting | Test-variant | 29 | 1 | Copy of AR9 run against CONTROL.BU; only differences listed. |
| ARHIST.CHANGE | AR | Utility/maintenance | 9 | 1 | One-off script moving member 7063's 2009 history (ARHIST.09) to member 3417. |
| AUTO.ORDER | Orders | Staging-processor | 172 | 11 | Creates member orders (IVORD/ORDHIST) and vendor order lines (VNORD) from TEAMPRO staging records (one record per member: PO, instructions, discount, future date, then product/qty pairs), then prints vendor orders. |
| BLD.IVMST.PW | Products | Outbound-generator | 44 | 4 | Builds a tab-delimited product price list (product, description, member price, multiple, status, UPC) for Photoware users into PWDB record 'IVMST.PW'. |
| BLD.IVMST.XML | Products | Outbound-generator | 46 | 2 | Earlier XML version of the Photoware product/price feed into PWDB 'IVMST.XML'. |
| BLD.IVPO | Inventory | Utility/maintenance | 33 | 4 | One-off (2003) conversion that builds IVPO purchase-order records from the PO multivalues stored on IVMST products. |
| BLD.IVSOLD | Reporting | Utility/maintenance | 70 | 3 | Rebuilds IVSOLD (per member: products and quantities bought this year) from ARHIST for chosen members or all ("*"). |
| BLD.QS | Reporting | Utility/maintenance | 52 | 1 | One-off (08-23-10) reconciliation that builds a per-member QSTEMP record comparing quantities shipped by product from SCANORD, ARHIST and IVSOLD. |
| BLD.SCANORD.UPS | Orders | Staging-processor | 137 | 5 | Loads UPS shipping export CSV content (UPS.PERM records keyed EXP...) onto SCANORD pick/ship records: tracking numbers, package counts, published and negotiated freight cost. |
| BUILD.IVCAT | Products | Utility/maintenance | 24 | 2 | Builds the IVCAT UPC→product cross-reference by generating a PRO UPC for every IVMST product (2002). |
| BUILD.PROMASTER | Members | Utility/maintenance | 35 | 5 | Computes each member's PROMASTER-brand purchases from ARHIST (2002 onward) into ARMST attr 35 PROMASTER. |
| BUILD.PROMASTER.2 | Members | Test-variant | 35 | 1 | Copy of BUILD.PROMASTER run against ARMST2 / ARHIST.01 / IVMST2 (2001 archive files); only differences listed. |
| BUILD.UPC | Products | Utility/maintenance | 28 | 3 | Assigns PRO-prefix UPCs to IVMST products that have none and records them in IVCAT (02-21-02). |
| BUILD.YTD.SALES | Reporting | Utility/maintenance | 38 | 1 | Builds SALES.TEMP per product (total qty sold, number of members, description, group, E-group) from the 2005 IVSOLD archive. |
| CAPTURE | Utility | Utility/maintenance | 59 | 1 | Runs any LIST/SORT sentence and transfers the captured report to a PC file (default C:\DOWNLOADS\) via the FT file-transfer utility. |
| CASE.CTN | Products | Interactive | 13 | 1 | Manually maintains a product's case and carton pack quantities. |
| CHANGE | Members | Utility/maintenance | 8 | 1 | One-off copy of ARMST2 attr 29 into ARMST attr 29 for a select list. |
| CHANGE.INST | Orders | Interactive | 119 | 5 | Changes the special instructions on a PRO order (ORDHIST, IVORD and all its vendor orders) if the order has not been started. |
| CHANGE.VNORD | Orders | Utility/maintenance | 60 | 5 | After a product's vendor changes, moves that product's open vendor-order lines from the old vendor's VNORD records to the new vendor's and updates NUMBER records. |
| CHG.DATING | Orders | Utility/maintenance | 31 | 2 | Marks an order as 1st dated, 2nd dated, or not dated by overwriting its special-instructions field. |
| CHK.ARMST.NAME | Members | Report/print | 46 | 1 | Reports ARMST records with duplicate member names (adjacent in name sort) to the printer and ARERR. |
| CHK.CAN.TOTS | AR | Batch | 25 | 1 | Pre-month-end check (04-26-12) that aborts if Canadian members have any balances. |
| CLEAN.UP.MV | AR | Utility/maintenance | 16 | 1 | One-off (2000) fix deleting the last product/qty/amount value on ARHIST.95 records (trailing empty multivalue). |
| COMPARE.QS | Reporting | Utility/maintenance | 32 | 1 | One-off (08-23-10) display of products in QSTEMP not present in a member's IVSOLD. |
| CONV.ARHIST | AR | Utility/maintenance | 26 | 1 | One-off (10-29-02) renumbering of a series of invoices (+50) in ARHIST keys and ARINV. |
| CONVERT.DATED | Orders | Interactive | 41 | 2 | Converts a not-yet-started order to a 1st or 2nd dated order (2007). |
| CONVERT.FSINVS | AR | Utility/maintenance | 86 | 3 | Moves all open invoices of FotoSource members (ARMST TYPE = "CAN") onto the FotoSource master account 7000 (06-23-11). |
| CONVERT.TERMS | Orders | Interactive | 62 | 3 | Changes the terms value (attr 11) on an unbilled, active PRO order (03-09-11). |
| COPY.UPC | Products | Utility/maintenance | 13 | 1 | One-off copy of IVMST attr 29 UPC into attr 51 W.UPC/EAN for a select list. |
| COPYWD | Products | Outbound-generator | 7 | 2 | Copies working files to web-data copies (IVMST.WD, IVDISC.WD, IVORD.WD, SCANORD.WD) for the member website. |
| COUNT.GRPS | Reporting | Report/print | 44 | 2 | For a trade show, counts how many distinct E-groups each member bought in a date range (TEMPDATA). |
| COUNTRY | Products | Subroutine | 18 | 1 | Translates country-of-origin codes to country names using CONTROL 'COO'. |
| CR.CKS | Members | Report/print | 13 | 1 | Prints a full page of "X" characters on the laser printer (alignment test for customer rebate checks). |
| CRUPDATE | Members | Interactive | 37 | 2 | Updates a member's statement date (LST.STMT) or credit limit (ARMST attr 7). |
| CS.UPD.UPS | Orders | Outbound-generator | 100 | 7 | For a shipped sale transaction (TRANSLOG), appends a UPS WorldShip import line to the DOWNLOADS 'UPS.CSV' staging record and indexes invoice → transaction in UPSIDX. |
| CUST.RBT | Members | Interactive | 114 | 5 | Enters consumer rebate claims for a dealer, prints the consumer rebate check, and voids checks. |
| CUST.RBT.CHKS | AP | Report/print | 70 | 5 | Reprints/prints consumer rebate checks from RBTDATA for a check-number range not yet flagged printed. |
| CUST.RBT.LJ | AP | Interactive | 114 | 9 | Enter a consumer rebate (dealer, rebate code, products, consumer address), store in RBTDATA and print the rebate check on a LaserJet; also voids checks. |
| CUSTRBT.LJ | AP | Test-variant | 114 | 2 | Duplicate of CUST.RBT.LJ (consumer rebate entry + check print) with a different check layout including a MICR line. |
| CUSTRBT.NEW | AP | Test-variant | 92 | 1 | Copy of CUST.RBT.LJ that records consumer rebates in RBTDATA without printing a check (checks printed later by CUST.RBT.CHKS). |
| CUSTRBTNEW1 | AP | Test-variant | 79 | 2 | Variant of CUSTRBT.NEW that takes the next rebate check number from CONTROL instead of operator entry; no void function. |
| DEL.ARINV | AR | Utility/maintenance | 42 | 4 | Deletes one open invoice from a member's ARINV record and backs its open balance out of ARMST aging buckets. |
| DEL.NUMBER | Orders | Utility/maintenance | 24 | 3 | Deletes a shipping number record from NUMBER and resets the related vendor order (VNORD) attr 12 to 0. |
| DELETE.MEMBER | Members | Utility/maintenance | 46 | 4 | Zeroes a member's ARMST balances and deletes the member's ARINV, BVEND, IVEND, IVSOLD detail records (keeps ARMST record). |
| DH$ | Utility | Utility/maintenance | 53 | 1 | Test harness that converts an amount in cents to check-writing words using word table CONTROL 'MONEY'. |
| DH1 | Products | Batch | 61 | 5 | 1985 suggested-order calculator: for a product group, computes reorder quantity from monthly sales history and writes it to ORDER file. |
| DIVD.CHK.LJ | Members | Report/print | 80 | 9 | Prints annual patronage dividend checks (with stub) for members in STOCK with a dividend, and records each check in APBR. |
| DRAW.BOX | Utility | Subroutine | 29 | 1 | Draws a box on the terminal using per-terminal graphics chars from TERMINALS. |
| DSP.REPORT | Utility | Subroutine | 37 | 1 | Pages a field-mark-delimited report on screen 21 lines at a time with Back/End/custom prompt. |
| EDI.CREDIT | EDI | Staging-processor | 194 | 14 | Parses vendor credit memos from staging record EDI 'CREDITS' (for non-PRO "MDS" billing) and writes one EDICREDITS record per credit with computed terms and surcharge. |
| EDI.CREDITS | EDI | Test-variant | 343 | 23 | Older (11/2001) copy of EDI.UPDATE, the EDI drop-ship ("non-PRO MDS") billing run; rules listed in full because it was read before EDI.UPDATE, see EDI.UPDATE for the current logic: parses vendor invoices from staging record EDI 'DATA', bills members in AR (ARINV/ARSHIP/ARMST), books AP (APDIST/APHIST/APMST), updates vendor and PO-tracking totals; negative invoices are parked in EDICREDITS. |
| EDI.UPDATE | EDI | Staging-processor | 413 | 30 | Current EDI drop-ship ("non-PRO MDS") billing run: validates and posts vendor invoices from staging record EDI 'DATA' to member AR (ARINV/ARSHIP/ARMST) and vendor AP (APDIST/APHIST/APMST), tracks PO billing, then chains EDI.CREDIT for credit invoices. |
| EDIT.LINE | Utility | Subroutine | 75 | 1 | Raw-keystroke full-line editor for green-screen input fields (insert/overtype, arrows, ESC/up exit). |
| EGRP.SALES | Reporting | Batch | 45 | 4 | Rebuilds EGRPSLS: per-member sales totals by product e-group (IVMST attr 39 EGRP) for a date range from ARHIST. |
| EM.1 | Members | Interactive | 17 | 2 | Enter a member's sales amount and rebate percentage to compute a vendor-rebate check amount stored in MISC. |
| EMAIL.FSINV | AR | Outbound-generator | 28 | 2 | Builds an 'email.bat' command line in the FSINV directory file to email an FSINV invoice attachment via the ericmail utility. |
| EMAIL.INVOICES | AR | Outbound-generator | 41 | 3 | Builds INVOICES.DBF (email notification feed) listing invoice PDF URLs per member for invoices posted on a given date. |
| ENTER.HST | Products | Interactive | 17 | 1 | Quick entry of harmonized tariff (HS) codes onto products. |
| ENTER.MISC | Members | Test-variant | 15 | 1 | Earlier (01/1994) version of EM.1 with a fixed rebate rate. |
| ENV.1 | Orders | Interactive | 153 | 4 | 1984 log of mailing envelopes/packages (date shipped, AM/PM, method, origin office) in PRO.ENV, purging old entries on exit. |
| EPSON.DRAFT | Utility | Utility/maintenance | 8 | 1 | Sends escape code to set an Epson 5000 printer to draft mode. |
| EPSON.NLQ | Utility | Utility/maintenance | 8 | 1 | Sets Epson 5000 printer to near-letter-quality mode. |
| FF | Utility | Utility/maintenance | 7 | 1 | Sends a form feed to the Epson 5000 printer. |
| FILE.STATS.SUB | Utility | Subroutine | 12 | 1 | Diagnostic: displays UNIX permissions of a file after a write error. |
| FILE.STATUS | Utility | Utility/maintenance | 7 | 1 | Interactive version of FILE.STATS.SUB showing a file's permissions. |
| FIX.AGE | AR | Utility/maintenance | 24 | 1 | One-off (2003) fix-up resetting ARINV aging for EDI invoices from the due date logged in EDILOG. |
| FIX.AGE.MEMB | AR | Utility/maintenance | 34 | 1 | Fix-up: set aging to an operator-entered value for all of one member's invoices dated on/before a cutoff. |
| FIX.AGING | AR | Utility/maintenance | 24 | 1 | Month-end fix-up: for invoices of a given date with terms 0 and aging 0, set aging to -1. |
| FIX.ARINV | AR | Utility/maintenance | 19 | 1 | One-off conversion of ARINV invoice dates (attr 2) from MM/DD/YY text to internal date. |
| FIX.ARINV.FSTOT | AR | Utility/maintenance | 100 | 3 | One-off (10/2011) fix-up making ARINV open-invoice amounts equal the ARHIST line total (adding missing FSTOT), and adjusting ARMST balances. |
| FIX.CAN.UPS | Orders | Utility/maintenance | 75 | 3 | Fix-up for Canadian UPS shipments not combined: merges dependent shipping numbers into the master's line in the UPS_DOM CSV staging records and re-keys UPS_INT lines to the master. |
| FIX.COST | Orders | Utility/maintenance | 27 | 3 | Fix-up that re-prices lines of selected IVORD orders from current IVMST cost and recalculates order total. |
| FIX.DUP.PROD | Orders | Utility/maintenance | 205 | 3 | Fix-up (2011) removing a second occurrence of a product from SCANORD, IVORD, ORDHIST and VNORD order lines and adjusting order totals. |
| FIX.FSINV | AR | Utility/maintenance | 31 | 1 | Fix-up that rewrites the <ORDERNUMBER> tag in FSINV XML invoice staging records with the member PO from ARHIST. |
| FIX.IVPO | Inventory | Utility/maintenance | 25 | 1 | Fix-up (2003) re-applying receiving log (RECLOG) quantities/amounts onto PO lines in IVPO. |
| FIX.MON.ORDERS | Products | Utility/maintenance | 23 | 1 | One-off (2007) correction moving monthly order history value 12 into value 9 of IVMST attr 17 MORD, backing up the old value to TEMP. |
| FIX.ORDERS | Members | Utility/maintenance | 26 | 1 | Rebuilds ARMST attr 17 ORDERS (open-order dollars) for all members from IVORD. |
| FIX.PO.CST | Products | Utility/maintenance | 24 | 1 | Fix-up filling missing PO cost on IVMST open-PO multivalues from IVPO. |
| FIX.RBTCHK | AP | Utility/maintenance | 10 | 1 | One-off renumbering of consumer rebate checks. |
| FIX.SERIAL.NOS | Inventory | Utility/maintenance | 25 | 1 | One-off (2009) re-key of SERIAL.NOS to PROD:SERIAL. |
| FIX.SURCHG | Members | Utility/maintenance | 90 | 4 | Recomputes a member's YTD sales, surcharge and PRO sales in ARMST from ORDHIST (selected externally) plus IVEND. |
| FIX.TPOCST | Inventory | Utility/maintenance | 29 | 2 | Recalculates total received cost per PO line in IVPO. |
| FIX.UPC | Products | Utility/maintenance | 20 | 1 | One-off (2007) copy of 12-digit UPCs from IVCAT cross-reference into IVMST attr 29 UPC. |
| FLYER.RPT | Reporting | Report/print | 53 | 26 | 1998 extract of member unit purchases of specific PRO-brand AF lenses and FTD flashes from IVSOLD into TEMPDATA (for a flyer/promo). |
| FREEZA.RPT | Reporting | Report/print | 47 | 12 | Extracts member units and dollars for 11 Freez-A-Frame products from ARHIST for a date range into TEMPDATA. |
| FSINV.FIELDS | AR | Utility/maintenance | 23 | 1 | Not a program: list of XML tag names making up an FSINV electronic invoice (header and line fields). |
| GET.SLAVE | Utility | Subroutine | 10 | 1 | Returns the terminal slave-printer port from CONTROL 'SLAVEPORT', prompting and saving it if missing. |
| HOLD_QTRRBT.CHK | Members | Report/print | n/a (compiled object code, no source) | 2 | Compiled (object) version of a quarterly member rebate check print program; source is not in BP. Content below is inferred only from embedded strings. |
| HP.RESET | Utility | Utility/maintenance | 5 | 1 | Sends PCL reset to HP8000 printer. |
| HP.WIDE | Utility | Utility/maintenance | 7 | 1 | Sets HP8000 printer to landscape and prints a test line. |
| IDATE | Utility | Subroutine | 50 | 2 | Inventory date-entry parser/validator with allowed past/future day windows. |
| INP.SERIAL.NOS | Inventory | Interactive | 156 | 5 | Capture serial numbers of cameras received, validated against per-product serial formats. |
| INP.UPC | Products | Interactive | 21 | 1 | Scan a UPC onto a product. |
| INP.YEN.CONV | Products | Interactive | 18 | 1 | Maintain the single yen conversion rate in CONTROL 'YEN'. |
| IPBILL | EDI | Outbound-generator | 58 | 5 | Builds an EDI-format billing batch (IPBILL 'DATA', same ENDOFINVOICE layout consumed by EDI.UPDATE) for imaging-service charges in a date range, one invoice per member per vendor. |
| IPI.PRO | Members | Utility/maintenance | 87 | 7 | Converts an IPI/affiliate member account to a full PRO member under a new account number, moving AR and history records. |
| IV.ADJ | Inventory | Interactive | 573 | 17 | Multi-store retail inventory adjustments (serial change, value adjustment, warehouse reduction, delete serialized item, store bulk stock, remove batch sale date, purge log) with an IVADJ audit trail. |
| IV.AUTO.ORDER | Products | Interactive | 78 | 6 | Turns the suggested-order work file ORDER (product → qty) into a vendor purchase order in IVPO and posts the open PO onto each product's IVMST PO fields. |
| IV.BLD.FSINV | AR | Outbound-generator | 69 | 4 | Rebuilds the FSINV invoice export (XLS/XML) for Canadian members' invoices of a prior billing date and optionally emails it to PhotoSource. |
| IV.DSP.PROD | Products | Interactive | 310 | 12 | Read-only product inquiry screen (copied from product maintenance in 2004) showing master data, costs/prices, groups, vendors, stock/PO figures and monthly order/shipment history vs prior year. |
| IV.INP.RETURNS | Inventory | Interactive | 77 | 6 | Records member product returns (for auto-credits) in RETURNS and accumulates returned quantities by reason in VNRET for vendor return tracking. |
| IV.INP.SCANORD | Orders | Interactive | 270 | 15 | Warehouse pick/pack scanning of a shipment (NUMBER → VNORD order): validates scanned products/quantities, captures serials, pends or closes the shipment in SCANORD, triggers UPS staging and packing list. |
| IV.INP.SHPCHG | Orders | Interactive | 52 | 3 | Enter shipping charges for shipments (SCANORD) awaiting shipping, adding a 9999 shipping line and marking them complete. |
| IV.LABELS | Utility | Utility/maintenance | 32 | 1 | Prints keys from the active select list as text labels on a Blazer label printer via aux port. |
| IV.MNT.PROD | Products | Interactive | 675 | 18 | Product master maintenance (add/change): descriptions, groups, PRO and actual vendor, costs, price tiers, retail/MAP, surcharge %, UPC/catalog cross-refs, pack quantities, rebate %; propagates price and vendor changes to open orders. |
| IV.MNT.PROD.N | Products | Interactive | 1116 | 19 | Full-screen product master maintenance (newest variant, 2011+, adds DUTY and ENTRY.NO): add/repeat/change products, vendors, groups, costs/prices, UPC/catalog cross-refs, logistics and customs fields, with change logging and authority codes. |
| IV.MNT.PROD.O | Products | Test-variant | 1088 | 1 | Copy of IV.MNT.PROD.N without DUTY/ENTRY.NO fields, using screens 'IV.MNT.PROD' / 'IV.MNT.PROD.PRMTS'. |
| IV.ORD.REC | Inventory | Interactive | 360 | 21 | Vendor purchase-order menu (renamed IV6): enter POs (via IV46), auto-create POs from the ORDER suggestion file, and receive merchandise against IVPO/IVMST with landed cost, yen conversion and FIFO stock layers. |
| IV.ORD.REC.N | Inventory | Test-variant | 523 | 4 | May 2012 rework of IV.ORD.REC with a full-screen line editor, customs entry number capture and decimal yen entry. |
| IV.PI.COUNT | Inventory | Interactive | 46 | 4 | Physical inventory count entry for warehouse scanners, logging counts per product and employee. |
| IV.PRT.PACKLIST | Orders | Report/print | 132 | 9 | Prints the packing slip for an auto-billed shipment (SCANORD record) at the warehouse, showing ordered/shipped/backordered quantities and payment terms. |
| IV.PRT.PACKLIST.CT | Orders | Test-variant | 102 | 4 | Office reprint of IV.PRT.PACKLIST that reads order header from ORDHIST (VNORD is deleted after billing). |
| IV.SCAN.ORD | Orders | Utility/maintenance | 1 | 1 | VOC-style alias "$ USE IV.INP.SCANORD" — points to the real program IV.INP.SCANORD. |
| IV.UPD | Products | Utility/maintenance | 11 | 1 | One-off copy of fields from IVMST.AUX into IVMST for every product. |
| IV.UPD.BILLPEND | Orders | Utility/maintenance | 1 | 1 | Alias "$ USE IV.UPD.SCANORD" — billing-pending update is the IV.UPD.SCANORD program. |
| IV.UPD.COGS | Inventory | Subroutine | 101 | 5 | When a product's on-hand goes negative, backs out profit already booked on the most recent billed shipments of that product (product YTD profit and member warehouse profit) using an average cost. |
| IV.UPD.FSINV | AR | Outbound-generator | 87 | 4 | Original (June 2011) builder of a pseudo-XML invoice file for FotoSource (Canada) from an ARSHIP invoice, appended into FSINV record ORDERSmmddyy. |
| IV.UPD.FSINV.XLS | AR | Outbound-generator | 111 | 8 | Builds a tab-delimited (.xls) invoice/dues file for FotoSource (Canada) member billing, one row per invoice line, appended to FSINV record ORDERS/DUES<MMDDYYYY>.xls. Current version, called by IV.UPD.SCANORD (its SUBROUTINE statement still says IV.UPD.FSINV). |
| IV.UPD.FSINV.XML | AR | Test-variant | 87 | 1 | Duplicate of IV.UPD.FSINV (June 2011) producing proper '<TAG>' XML into FSINV ORDERSmmddyy.xml. |
| IV.UPD.PLOG | Inventory | Batch | 89 | 7 | Posts physical inventory counts (PHYSLOG) to IVMST stock cost layers and logs adjustments to IVADJ. |
| IV.UPD.PLOG.TST | Inventory | Test-variant | 101 | 4 | Later (2012) version of IV.UPD.PLOG run against IVMST.TEMP / IVADJ.TEMP using saved list PLOG. |
| IV.UPD.RETURNS | AR | Batch | 97 | 12 | Auto-credits unbilled member returns: prices returned lines with surcharge, posts credit invoices to AR, updates member sales history and return statistics. |
| IV.UPD.SCANORD | Orders | Batch | 476 | 34 | Auto-billing of scanned/completed warehouse shipments (SCANORD): invoices members, relieves stock FIFO layers, posts AR, sales/profit history, vendor totals, and FotoSource (Canada) invoice files. Main production billing run. |
| IV.UPD.SCANORD.PRO | Orders | Test-variant | 378 | 3 | March 2004 copy of IV.UPD.SCANORD (pre-profit, pre-Canada). |
| IV.UPD.SCANORD.SJL | Orders | Test-variant | 402 | 3 | Feb 2005 developer copy of IV.UPD.SCANORD (between .PRO and current). |
| IV1 | Products | Interactive | 230 | 13 | Original product (inventory) master add/change/delete screen for core cost and vendor fields. |
| IV10 | Orders | Report/print | 99 | 9 | Prints new member orders (VNORD) since the last printed order on pre-printed shipping-memo stock for the warehouse, assigning a shipping number to each. |
| IV10.LJ | Orders | Report/print | 134 | 6 | Laser-jet version of IV10 with barcoded shipping number and lines sorted by product group; current production variant. |
| IV10.RP | Orders | Test-variant | 84 | 2 | Reprint variant of IV10 for an externally built select list of VNORD orders; does not use or update LASTORD. |
| IV11 | Orders | Report/print | 146 | 7 | Prints backorder pick tickets ("backorders ready to ship") for open VNORD orders containing products of a chosen group or a typed list of up to 300 products, assigning shipping numbers. |
| IV11.AUTO | Orders | Batch | 320 | 16 | Automatic backorder allocation and printing: finds products with stock, allocates available stock to oldest open orders, builds BKORD, then prints barcoded backorder tickets and marks orders printed. Runs from receiving when CONTROL ABO = 1 (per comment). |
| IV11.DHPRT | Orders | Test-variant | 171 | 5 | 2010 manual backorder print (IV11.LJ lineage) routed to printer DHPRT; adds dated-order skip and pick location. |
| IV11.LJ | Orders | Test-variant | 157 | 2 | Laser-jet version of IV11 (2001) with barcoded shipping number. |
| IV12 | Orders | Utility/maintenance | 23 | 1 | Add or delete "shipping numbers" in the NUMBER file, each stored with a date. |
| IV13 | Inventory | Utility/maintenance | 25 | 2 | Rebuild IVMST member-order requirement (attr 3 REQ) from open member orders in IVORD. |
| IV15 | Products | Interactive | 50 | 4 | Delete a product (archive to IVMST.DISC) or suspend it (IVMST status attr 15). |
| IV16 | Products | Interactive | 54 | 4 | Merge one product's sales history into another product, archive and delete the old product, and re-point IVSOLD sales to the kept product. |
| IV17 | Inventory | Utility/maintenance | 18 | 3 | Rewrites IVMST dictionary I-descriptor formulas QR (quantity to reorder) and SUPPLY (months of supply) for an entered months-of-supply target, then compiles the dictionary. |
| IV18 | Orders | Report/print | 49 | 2 | Report of open member orders (IVORD) grouped by product with quantity, cost, extended value, member name, PO and ship date. |
| IV19 | Inventory | Interactive | 35 | 2 | Displays outstanding vendor purchase orders stored on a product record. |
| IV2 | Vendors | Interactive | 191 | 9 | Add or change a PRO vendor (VNMST) linked to an AP vendor (APMST) with surcharge and billing-guarantee settings. |
| IV20 | Inventory | Report/print | 53 | 3 | Prints a purchase order document for a PO number from the products in an active select list. |
| IV21 | Inventory | Batch | 70 | 10 | Calculates a tentative reorder quantity per product for a product group/sub-group and writes it to ORDER. |
| IV22 | Products | Interactive | 15 | 1 | Edit the deletion date (attr 11) of a discontinued product in IVMST.DISC. |
| IV3 | Orders | Interactive | 645 | 26 | Member order entry ("new order received"): terms, member credit check, ship-to, product lines with pricing tiers, freight-prepaid threshold; writes IVORD/ORDHIST and one VNORD per vendor, updates product requirements and member open orders. |
| IV3.NEW | Orders | Test-variant | 418 | 2 | May 2006 copy of IV3 (before 2008-09 changes: no SHIPTO codes, no expedite, no '*' manual price, no 9985 freight exception). |
| IV3.ORIG | Orders | Test-variant | 419 | 1 | Dec 2005 copy of IV3; products inserted in group/product sorted order rather than entry order. |
| IV3.TEST | Orders | Test-variant | 384 | 2 | Oct 2001 copy of IV3. |
| IV3A | Orders | Batch | 98 | 4 | Mass-creates a "SAMPLE" order of qty 1 of chosen products for every member with zero credit status (minus an exclusion list). |
| IV4 | Orders | Interactive | 369 | 15 | Manual (operator-keyed) billing of PRO merchandise shipments per vendor and order: relieves stock, invoices the member, posts AR and vendor totals. Interactive predecessor of IV.UPD.SCANORD. |
| IV4.NEW | Orders | Test-variant | 290 | 1 | Older (1997-99) copy of IV4 despite the name; no ORDHIST update. |
| IV45 | Inventory | Report/print | 247 | 8 | Displays or prints vendor purchase orders from IVPO with vendor address, bill-to/ship-to, terms, instructions and priced lines. |
| IV46 | Inventory | Interactive | 311 | 11 | Manual purchase-order header entry/maintenance (PO number, date, vendor, terms, special instructions), handing line entry to IV46.PROD. |
| IV46.9999 | Vendors | Subroutine | 277 | 1 | Screen-driven entry of one-time/miscellaneous vendor details (vendor 9999) into a multivalued INFO field (IVPO attr 17) using PROMPTS 'IV46.9999' definitions. |
| IV46.DSCR | Inventory | Subroutine | 16 | 1 | Paints the IV46 PO entry screen header (PO number, PO date, primary and second vendor). |
| IV46.PROD | Inventory | Subroutine | 1003 | 14 | Multi-line PO line entry (product, qty, unit cost) for IV46; on update rewrites IVPO and the PO arrays on each IVMST product; supports special-order products. |
| IV46.SPORD | Orders | Subroutine | 629 | 6 | Special-order customer distribution: splits a special-order PO line across end customers (members or mailing-list customers) with quantities and extended sale, writing IVSPORD and IVCUST. |
| IV4A | AR | Test-variant | 117 | 1 | 2001 interactive member-returns credit entry (older copy of IV4B). |
| IV4B | AR | Interactive | 127 | 9 | Operator-keyed member returns: credits a member for returned products at current cost + surcharge, posts a credit invoice and return statistics. |
| IV5 | Orders | Interactive | 293 | 11 | Change quantities/costs on, or cancel, an open member order (IVORD/VNORD/ORDHIST) and keep IVMST requirements and member open-order totals in step. |
| IV52 | Inventory | Interactive | 787 | 8 | Generic Computyme retail-package receiving from IVPO with multi-store stock, serialized item numbers (IVINV/IVNEW), labels, and special-order customer distribution (2000). |
| IV54 | Inventory | Interactive | 116 | 4 | Cancel (delete) an open, unreceived purchase order, removing it from products and deleting attached special orders. |
| IV56 | Inventory | Interactive | 199 | 5 | Cancel remaining backorder quantities on a vendor PO, either all lines or selected products (modified for PRO IVMST fields in 2003). |
| IV6 | Inventory | Test-variant | 312 | 2 | Jan 2007 predecessor of IV.ORD.REC (PO ordering/receiving menu). |
| IV6.PO | Inventory | Test-variant | 182 | 3 | 2002 earlier version of IV6 with manual PO creation product-by-product. |
| IV7 | Inventory | Interactive | 222 | 8 | Manual inventory adjustments to a product's stock layers (quantity) or total stock value, logged to IVADJ with a reason. |
| IV8 | Orders | Interactive | 74 | 4 | Re-prices every open member order line for one product to a new cost and adjusts each member's open-order balance. |
| IV9 | Vendors | Report/print | 44 | 1 | Prints vendor mailing labels (3-up) for up to 40 vendors in quantities that are multiples of 3. |
| IVPO.ON.ORD | Inventory | Subroutine | 7 | 1 | Computes open (still on order) quantity per PO line. |
| I_APTREE_EQUATE | Utility | Subroutine | 7 | 1 | Include file that names TS() slots used by the AP B-tree index routines (TREE, ROOTID, PRG) and defines AM/DELIM/NILL constants. |
| I_BLD.MEQHIST | Inventory | Subroutine | 32 | 2 | Include routine for IV.PI.MEQ and IV.TRAN.MEQ that archives the current MEQDATA (hand-held scanner/MEQ transfer) records into MEQHIST and purges old history. |
| I_CLOSE.PORT | Utility | Subroutine | 14 | 1 | Include that turns off the system printer or the terminal slave (aux) port depending on WORD. |
| I_IV14EQ_COMMON | Utility | Subroutine | 7 | 1 | Include defining TS() tree-index equates (duplicate of I_APTREE_EQUATE). |
| I_IV46_COMMON | Inventory | Subroutine | 29 | 2 | COMMON/EQU include for the IV46 PO programs: a 50-slot FILES() array plus PO header globals (ORDER, PO.DATE, PVND/PVNAME = PRO vendor, SVND/SVNAME = ship/secondary vendor). |
| I_IVMNT_COMMON | Products | Subroutine | 17 | 1 | Large COMMON block shared by the product-maintenance (IV.MNT.PROD*) programs: the product record R(150), screen state, file handles and many working variables. |
| I_MEQ.ERROR | Inventory | Report/print | 95 | 3 | Include used by IV.MEQ.ERRORS, IV.PI.MEQ, IV.TRAN.MEQ to print/display MEQ (scanner transfer) errors and purge old error lists. |
| I_MV_COMMON | Utility | Subroutine | 28 | 1 | COMMON include declaring TS(30), FILES(50), IV(150), AP(30), TL(12), SOLD(12) and the reserved file-slot equates. |
| I_OPEN.PORT | Utility | Subroutine | 27 | 1 | Include that turns on the system printer or a terminal slave printer using terminal-specific escape codes. |
| I_RAWINP | Utility | Subroutine | 6 | 1 | Include that reads one raw keystroke (KEYIN) for UniVerse. |
| I_READ_IVCAT | Products | Subroutine | 15 | 1 | Include that resolves a scanned/entered value (catalog no./UPC) to a PRO product number via the IVCAT cross-reference. |
| I_TREE_EQUATE | Utility | Subroutine | 36 | 1 | Include naming TS(1..29) slots for the home-grown B-tree index routines. |
| LASER.PATR | Members | Report/print | 59 | 4 | Prints IRS 1099-PATR patronage dividend forms for members (shareholders) on a laser printer, 3 per page. |
| LASER.TEST | Utility | Test-variant | 32 | 1 | Test print of a sample cheque-like form with MICR font to the laser printer. |
| LBL.TEST | AR | Test-variant | 27 | 2 | Test print of "PRO invoice" remittance labels (invoice #, date, amount, terms, account) for selected ARSHIP/ARHIST invoices, each label printed 275 times. |
| LENS.RPT | Reporting | Report/print | 33 | 4 | Rebuilds LENSDATA with per-member year-to-date quantity and dollars of group-1 (lens) products from all ARHIST invoices. |
| LIST.BOX | Utility | Subroutine | 99 | 1 | AccuTerm 2K2 helper that builds and runs a Windows script dialog listbox and returns the selected index (0 on cancel). |
| LJ.CHK.TEST | AP | Test-variant | 24 | 1 | Test print of a sample check with MICR line on the laser printer (dummy data). |
| LJ.INV1 | AR | Report/print | 49 | 5 | Prints laser (PCL) member invoices from a select list of ARSHIP records. |
| LJ.INV2 | AR | Test-variant | 54 | 1 | Variant of LJ.INV1 (laser invoice print from ARSHIP) using LOOP/REPEAT, form feeds and PRINTER ON spooling. |
| LJ.INV3 | AR | Test-variant | 54 | 1 | Near-identical copy of LJ.INV2 (laser invoice print), differing only in print column layout and no ESC E reset. |
| LJFONTS | Utility | Test-variant | 29 | 1 | Test of check-print overlay config (CHKTEST, RBTCHK.BMP, HP8150) and MICR font. |
| LOOKUP | Inventory | Interactive | 15 | 1 | Operator looks up a lens part number in PARTS and sees its description (attr 2) and bin location (attr 1). |
| LOWEPRO.RPT | Reporting | Report/print | 41 | 3 | Builds TEMPDATA per member with quantity and dollars sold of four specific Lowepro product codes for an operator-entered date range. |
| M1 | Members | Interactive | 39 | 3 | Add/change/delete entries in the secondary member mailing list MLIST, auto-numbering new entries from CONTROL 'AR' attr 2. |
| M2 | Members | Interactive | 14 | 1 | Operator enters the number of mailings for a member, stored on ARMST. |
| MAX | Products | Utility/maintenance | 8 | 1 | One-off load copying MAXLEVEL attr 1 into IVMST attr 34 for every MAXLEVEL key. |
| MC.1 | Members | Report/print | 62 | 5 | Prints member rebate checks from the MISC work file, numbering checks sequentially and recording check number back on MISC. |
| MEMORY.RPT | Reporting | Report/print | 44 | 3 | Builds TEMPDATA per member with qty and dollars of eight ProMaster memory product codes for an operator date range. |
| MINOLTA.RPT | Reporting | Report/print | 40 | 2 | Same template as LOWEPRO.RPT for four Minolta product codes. |
| MOD.AGING | AR | Utility/maintenance | 62 | 3 | One-off fix-up (2004) re-deriving ARINV aging buckets from ARHIST terms for invoices dated on/after 02/15/04, then rebuilding ARMST aging totals. |
| MOD.AR.INV | AR | Interactive | 140 | 5 | Operator changes terms (discount %) and future-dating/aging of a single open member invoice in ARINV and moves the amount between ARMST aging buckets. |
| MONEY | Utility | Subroutine | 21 | 2 | Validates an operator-typed money string and converts it to integer cents. |
| MONEY.CONV | Utility | Subroutine | 23 | 3 | Converts a foreign-currency amount tagged Y (yen) or R (renminbi) to USD using rates stored in CONTROL. |
| MOVE | Members | Utility/maintenance | 11 | 1 | One-off copy of high-credit fields from ARMST2 into ARMST (attr 36 -> 38, attr 37 -> 37) and zeroing ARMST attr 36. |
| NEWAR5 | AR | Report/print | 107 | 9 | Prints monthly member statements (three-part form) from ARINV open invoices with prompt-pay discount, past-due flags, aging totals and grand totals; advances CONTROL 'UPD' step from 3 to 4. |
| OLYMPUS.RPT | Reporting | Report/print | 40 | 2 | Same template as LOWEPRO.RPT for three Olympus product codes. |
| ORD.EML | Orders | Outbound-generator | 63 | 4 | Spools a "PRO warehouse order confirmation" text per IVORD order to a hold-file named <account>-<order>.EML (later emailed by an external process). |
| ORD.EML.TEST | Orders | Test-variant | 57 | 2 | Variant of ORD.EML that writes the confirmation text into the EMAIL file (key <account>-<order>.EML) instead of a spool hold file. |
| ORD.EML1 | Orders | Outbound-generator | 80 | 6 | Production order-confirmation generator: for every IVORD order not yet confirmed (PS < 1), writes confirmation text to EMAIL file and marks the order confirmed. |
| ORD.PRINT | Orders | Report/print | 92 | 9 | Prints warehouse pick tickets for all new VNORD member orders above CONTROL 'LASTORD', assigning sequential shipping numbers recorded in NUMBER. |
| ORDUP1 | Products | Utility/maintenance | 22 | 3 | Cleans ORDDUE (product due-date file) and prints a list of out-of-stock products lacking a due date so buyers can enter new dates. |
| P.OFF | Utility | Utility/maintenance | 2 | 1 | Sends terminal escape ESC 4 (slave/aux printer off). |
| P.ON | Utility | Utility/maintenance | 2 | 1 | Sends terminal escape ESC 3 (slave/aux printer on). |
| PACK.LIST.COMPU | Orders | Report/print | 97 | 6 | Prints a packing slip for one shipping number using BILL.PEND shipped quantities, showing ordered/shipped/backordered per line. |
| PANA.RPT | Reporting | Report/print | 37 | 3 | Builds WKDATA unit-sales totals per product for actual vendor 3121 (Panasonic) from ORDHIST over an operator date range. |
| PATR.CALC | Members | Utility/maintenance | 16 | 2 | One-year patronage dividend calculation per member in STOCK, with hard-coded totals. |
| PATR.UPD | Members | Utility/maintenance | 12 | 1 | Year-end roll: adds patronage credit to patronage balance and zeroes credit and dividend. |
| PATR.WH | Members | Utility/maintenance | 13 | 2 | Computes a 3% warehouse surcharge bonus per member into STOCK. |
| PATR1099 | Members | Report/print | 57 | 3 | Prints IRS Form 1099-PATR for each member with a patronage dividend in STOCK2. |
| PC.PRINTOFF | Utility | Utility/maintenance | 3 | 1 | Turns off Windows PC printing and resets terminal to 80x24. |
| PC.PRINTON | Utility | Utility/maintenance | 3 | 1 | Sets terminal to 132x57 and turns on Windows PC printing. |
| PDF.EDI.INV | EDI | Outbound-generator | 74 | 5 | Renders vendor (EDI / direct-ship) billing invoices in ARSHIP to PDF via spooler hold files (.CFG + .TXT per invoice), using vendor-supplied product, description, qty and cost. |
| PDF.INV.HIST | AR | Outbound-generator | 65 | 2 | Reprints historical member invoices from ARHIST to PDF (spooler .CFG/.TXT) for a pre-selected list. |
| PDF.INV2 | AR | Outbound-generator | 66 | 2 | Renders all current ARSHIP member invoices to PDF via spooler hold files with an invoice background bitmap. |
| PENDINGRBT | Members | Interactive | 76 | 7 | Operator confirms consumer (end-customer) rebate claims submitted online (PENDRBTS), assigns a rebate check number, writes to RBTDATA and removes the pending record. |
| PENTAX.RPT | Reporting | Test-variant | 42 | 1 | Copy of MINOLTA.RPT repurposed for a single Pentax ZXL product code. |
| PO.DISC | Inventory | Batch | 135 | 7 | Reconciles open purchase orders between IVPO (PO file) and the PO multivalues on IVMST (attrs 20-23), adding missing open POs to IVMST and removing fully received or orphaned POs, printing each discrepancy. |
| PRINT.132 | Utility | Utility/maintenance | 3 | 1 | Sends compressed-print / PCL 132-column codes to printer. |
| PRINT.132.JP | Utility | Utility/maintenance | 10 | 1 | Turns on slave printer port at 132 chars (16.67 cpi). |
| PRINT.LABEL | AR | Report/print | 25 | 1 | Production version of LBL.TEST: prints one remittance label per selected invoice (ARSHIP, else ARHIST). |
| PRINT.LABEL.96 | AR | Test-variant | 25 | 1 | Copy of PRINT.LABEL that falls back to archive file ARHIST.96 instead of ARHIST. |
| PRO.LBL | Products | Report/print | 24 | 1 | Prints small 4-across product labels (product # + description) in quantities from the ORDER work file, descriptions from FILTERS. |
| PROCESS.EXPORT | Orders | Staging-processor | 124 | 5 | Parses the UPS WorldShip export CSV staged in UPS.PERM record "Export_sjl.csv" and posts tracking numbers, package counts and published/negotiated freight cost to SCANORD shipments; then consolidates multi-package shipments. |
| PRO_CREDIT | AR | Outbound-generator | 24 | 4 | Exports a member credit spreadsheet (PRO_CREDIT.XLS) to the Windows download directory via WIN.IMPORT. |
| PRT.EDI.CREDIT | EDI | Report/print | 58 | 3 | Prints vendor (EDI) credit memos from EDICREDITS on the laser printer, using vendor-supplied line data, with "Billing for <vendor>" header. |
| PRT.EDI.INV | EDI | Report/print | 58 | 1 | Laser-print version of PDF.EDI.INV: prints all ARSHIP invoices using vendor (EDI) line data with vendor "Billing for" header. |
| PRT.NR | Utility | Utility/maintenance | 4 | 1 | Runs NEW.REPORT.PRT with aux printer on/off around it. |
| PRT.OFF | Utility | Utility/maintenance | 4 | 1 | Aux printer off (ESC 4); duplicate of P.OFF. |
| PRT.ON | Utility | Utility/maintenance | 4 | 1 | Aux printer on (ESC 3); duplicate of P.ON. |
| PURGE.PGM.AUDIT | Utility | Utility/maintenance | 40 | 2 | Purges program-usage audit entries older than 30/60/90/120 days from PGM.AUDIT. |
| PURGE.UPS | Orders | Staging-processor | 96 | 4 | Earlier version of PROCESS.EXPORT: reads UPS export CSVs (Export_1/2/4.csv) staged in UPS file, posts tracking/costs to SCANORD, and purges matching shipments from the UPS_DOM/UPS_INT outbound staging records. |
| QTR.RBT.RPT | Members | Report/print | 68 | 3 | One-off reprint of corrected 1st-quarter 1998 member rebate check stubs, breaking rebate into PRO warehouse and Konica components. |
| QTRDATA.LTR | Members | Report/print | 54 | 5 | Prints reminder letters to members not yet qualified for the 2% quarterly warehouse rebate, listing missing product groups and the dollar shortfall to $10,000. |
| QTRDATA.LTR1 | Members | Report/print | 76 | 5 | Later version of the reminder letter for the 5% quarterly warehouse incentive program with SKU-count minimums per product group and a selectable dollar threshold. |
| QUARTERLY.LY | Members | Test-variant | 63 | 5 | Variant of QUARTERLY.RPT run against archive ARHIST.01 with later-era exclusions and a $15,000 threshold. |
| QUARTERLY.RPT | Members | Batch | 58 | 7 | Builds QTRDATA quarterly warehouse-rebate qualification per member from ARHIST for an operator date range. |
| RAWINPUT | Utility | Subroutine | 86 | 1 | Terminal full-line editor (raw keystroke input with insert mode, arrows, tab/esc/up/down actions). |
| REBUILD.APBR | AP | Utility/maintenance | 23 | 2 | One-off rebuild of the AP check register (APBR) from AP distribution records in saved list APDIST.JOHN, one APBR record per check. |
| REBUILD.MSALES | Products | Utility/maintenance | 27 | 2 | Rebuilds MSALES (per-product quantity and sales dollars) by accumulating ARHIST invoice lines from an active select list. |
| REDI.RPT | EDI | Utility/maintenance | 18 | 1 | Intended to reprint EDI invoices from ARHIST for an invoice-number range by calling PDF.EDI.INV. |
| REM.PROD.ORDHIST | Orders | Utility/maintenance | 63 | 2 | Removes one of two duplicate occurrences of a product line from an ORDHIST order. |
| REMOVE.FROM.FSINV | AR | Utility/maintenance | 91 | 4 | Moves open invoices that were billed under FotoSource consolidated account 7000 back to the real member's ARINV when the invoice exists in ARHIST under that member, then rebuilds aging for both via RESET.ARMST. |
| REPRINT.BO | Orders | Report/print | 87 | 3 | Reprints pick tickets/order forms for a select list of VNORD orders on 3-part stock using operator-supplied starting shipping number (no NUMBER/CONTROL update). |
| REPRINT.ORDERS | Orders | Test-variant | 90 | 1 | Copy of REPRINT.BO pointed at printer WH8100 (2001 update). |
| RESET.ARMST | AR | Batch | 53 | 5 | Recomputes ARMST aging buckets and balance from ARINV open invoices for every account in the active select list, backing up before/after images to ERRFL. |
| RESET.ARMST.SEL | AR | Interactive | 53 | 1 | Same as RESET.ARMST but prompts the operator for each account instead of reading a select list. |
| RESET.CREDIT.AGING | AR | Utility/maintenance | 37 | 3 | One-off fix-up that moves member credits (negative open invoice amounts) out of the 30/60/90 aging buckets back into Current, after backing up the records to ERRFL. |
| RESET.ERRFL | AR | Utility/maintenance | 24 | 1 | Undo for RESET.CREDIT.AGING. It writes every ERRFL backup record back over ARINV (keys containing 'I') or ARMST (other keys). |
| RESET.RBT.CHKS | AR | Utility/maintenance | 27 | 1 | Clears the PRINTED flag on a range of customer rebate checks so they can be reprinted. |
| RESIZE.FILES | Utility | Utility/maintenance | 35 | 1 | DBA tool that runs RESIZE ... * * * on every file and dictionary in VOC (skipping paths that contain '/') and resizes each physical path once. |
| RESTORE | AR | Utility/maintenance | 31 | 4 | Recovery tool for manually re-keying lost ARHIST (member billing of vendor invoices) records, pulling the amount from APHIST. |
| RETURNS.BY.MEMBER | Reporting | Report/print | 90 | 6 | Report of member returns (RETURNS.10) totalled per member, shown against the member's PROMASTER purchases as a return percentage, to the screen, a printer, or an Excel download. |
| REV.MEMEZPAY | AR | Batch | 191 | 13 | Reverses a posted EZPAY run (member automatic payment). Each EZPAY gross amount goes back into the member's balance and aging bucket, the paid dates are reset, the cash control total is backed out, and WEBSTMT is rebuilt. |
| RPDF.EDI.INV | AR | Report/print | 74 | 5 | Reprints member billing invoices for vendor (EDI) invoices from ARHIST, as print-to-PDF hold entries with a companion .CFG file. |
| RPRT.EDI.INV | AR | Report/print | 60 | 5 | Older printed (HP PCL) version of RPDF.EDI.INV that prints member billing invoices for vendor invoices from ARHIST, falling back to ARHIST.00. |
| RPT.INV | AR | Report/print | 70 | 6 | Reprints member invoices from ARHIST. It handles both warehouse product invoices and "billing for vendor" (drop-ship/vendor-direct) invoices, the latter with a terms-dispute notice. |
| RPT.INV.97 | AR | Test-variant | 64 | 1 | Copy of RPT.INV pointed at the 1997 archive file ARHIST.97. |
| RPT.LJ.INV | AR | Report/print | 56 | 4 | LaserJet (PCL) reprint of member product invoices from ARHIST, with a fallback to ARHIST.98. |
| RPT.LJ.INVC | AR | Test-variant | 56 | 1 | Copy of RPT.LJ.INV. |
| RPT.VENDRA | Vendors | Report/print | 36 | 4 | Displays or prints a vendor Return Authorization request (VENDRA record) as a "Defective merchandise return request". |
| SALES.REPORT | Reporting | Report/print | 60 | 6 | 1996-vs-1997 "Vendor participation" letter per member. It lists every PRO vendor program with the member's purchases in each year and flags programs under $300. |
| SCAN.ORD | Orders | Interactive | 88 | 7 | Warehouse scan-pick screen. The picker scans a ship ticket number, then products and quantities against the vendor order (VNORD), and marks the ticket pending or complete, which prints a packing list. |
| SEL.SHIPTO | Members | Subroutine | 129 | 3 | Screen subroutine to pick a member's drop-ship address from SHIPTO by code or from a paged list, returning name, address line 1, city/state/zip and UPS zone. |
| SET.DISCARD | Products | Utility/maintenance | 11 | 1 | Operator marks products as discontinued by setting IVMST attr 41 (DISCD) = 1. |
| SET.HP.132 | Utility | Utility/maintenance | 16 | 1 | Sends PCL reset/margin/16.66-cpi codes to set an HP printer to 132 columns. |
| SET.HP.80 | Utility | Utility/maintenance | 15 | 1 | Same as SET.HP.132 without the compressed-pitch code (80 columns). |
| SHARES | Members | Utility/maintenance | 10 | 1 | Adds newly purchased co-op shares to a member's share count in STOCK. |
| SHIP.TICKET | Orders | Report/print | 11 | 1 | Stub of a "print shipping tickets" program. It only opens files and has no logic. |
| SLS.COMPARE | Reporting | Batch | 55 | 3 | Builds SALESDATA (input to SALES.REPORT). For each member it holds the vendor list (all APMST.TEMP vendors by name) with 1997 and 1996 purchases per vendor, taken from the IVEND97/BVEND2 and IVEND96/BVEND96 summaries. |
| SPOOL.ORDERS | Utility | Utility/maintenance | 42 | 1 | Lists jobs on Unix spool queue PR1, lets the operator choose jobs, copies them to the &HOLD& file (through SETPROWHSE + SPOOL) and cancels them from the queue. |
| T | Utility | Test-variant | 13 | 1 | Test print of a PCL barcode font and two text fonts with sample strings. |
| TAMRON.RPT | Reporting | Batch | 60 | 27 | Builds TAMDATA, which holds per-member quantity and amount sold for 24 hard-coded Tamron products, from warehouse invoices in ARHIST for a date range (vendor sales report for Tamron). |
| TEMP | Members | Utility/maintenance | 8 | 1 | One-off script copying each member's ARMST2 attr 26 (P.SALES "PRO-MERCH"/"WH-SALES") into STOCK attr 7. |
| TEST | Utility | Test-variant | 9 | 1 | Developer test of LOCATE to find a second occurrence in a multivalue list. |
| TEST.BC | Utility | Test-variant | 4 | 1 | Prints a test barcode "*12345*" in a PCL barcode font. |
| TEST.OH | Orders | Test-variant | 11 | 1 | Developer test that looks for 14 product numbers in the products of ORDHIST order 21154. |
| TESTDATE | Utility | Test-variant | 4 | 1 | Prints TIMEDATE() and its ICONV date conversion. |
| TT | Utility | Test-variant | 5 | 1 | Prints a test barcode "*72262*". |
| UNIQUE.PROD.CNT | Reporting | Report/print | 118 | 4 | Report of how many distinct products each member bought (and, in detail mode, the quantity per product) in a date range, from ARHIST invoices. |
| UPC.CODE | Products | Utility/maintenance | 23 | 2 | Calculates the full UPC-A for a PRO 4-digit product code using PRO's UPC manufacturer prefix. |
| UPD.ARHIST | AR | Utility/maintenance | 37 | 1 | One-off 2009 backfill of ARHIST attr 16 (DT.PAID per the ARSHIP dict, which ARHIST shares per UPD.DICTS) from ARINV paid dates. |
| UPD.ARLOG | AR | Subroutine | 16 | 1 | Writes an audit entry to ARLOG whenever a program changes ARMST. |
| UPD.CHARGES | AR | Utility/maintenance | 50 | 3 | Dev-environment sync that copies open invoices from the production PRO account (PRO.ARINV) into the PRO.DEVLP account's ARINV, rolls them into ARMST balances, and copies CONTROL 'MS'. |
| UPD.DICTS | Utility | Utility/maintenance | 20 | 2 | Year-end utility that points the VOC entries of last year's archive files (APHIST.yy, ARHIST.yy, IVMST.yy, ORDHIST.yy etc.) at the shared live dictionaries. |
| UPD.EDICREDITS | EDI | Staging-processor | 344 | 27 | "Billing for NON-PRO MDS via EDI". It processes vendor invoices for member direct-ship orders staged in EDI 'DATA'. Each invoice posts AP (APDIST/APHIST/APMST/VNMST), bills the member (ARINV/ARSHIP/ARMST/IVEND) with PRO surcharge and member terms, closes the member's vendor PO (VENDORD), and diverts credit invoices to EDICREDITS. |
| UPD.IVMST.LCOST | Products | Utility/maintenance | 35 | 2 | Sets every product's IVMST LAST.COST (attr 28) to the unit cost of its most recent receipt. |
| UPD.IVMST.QREC | Inventory | Utility/maintenance | 43 | 2 | One-off 2008 fix-up that folds the physical-inventory (PLOG) adjustment receipt layers dated on PI days into the preceding (older) receiving layer in IVMST. |
| UPD.MEMEDI | Orders | Staging-processor | 473 | 31 | Imports member purchase orders received electronically (MEMEDI 'ORDER.TXT'). It validates each order and creates PRO orders (IVORD/ORDHIST), splits them into vendor orders (VNORD) and updates product demand and member open-order totals. |
| UPD.MEMEDI.TST | Orders | Test-variant | 512 | 6 | 2011 test copy of UPD.MEMEDI that reads an operator-entered MEMEDI id, with all file writes commented out (dry run). It contains newer rules not present in the production UPD.MEMEDI. |
| UPD.MEMEZPAY | AR | Batch | 217 | 11 | Posts the EZPAY (member automatic payment) batch. Each EZPAY invoice is marked paid on ARINV and its gross is removed from ARMST balance/aging. EZ-discount is accumulated, the cash control total is updated, and WEBSTMT is rebuilt. |
| UPD.RAW | Products | Utility/maintenance | 14 | 2 | Bulk-loads IVMST RAW cost (attr 19) from a staged TEMPDATA file keyed by product. |
| UPD.SCANORD.UPS | Orders | Staging-processor | 124 | 4 | Imports UPS WorldShip export results (UPS.PERM 'EXP...' records from the last 5 days) and writes tracking numbers, package counts and published/negotiated freight cost onto the SCANORD ship tickets. It then consolidates multi-package tickets. |
| UPD.UPC | Products | Utility/maintenance | 14 | 1 | Copies UPCs from the IVCAT cross-reference into IVMST attr 29 (UPC). |
| UPD.UPS | Orders | Outbound-generator | 143 | 9 | Subroutine that appends a ship ticket to the UPS WorldShip import CSVs (UPS_DOM, plus UPS_INT customs lines for Canada) held as records in the UPS file. It writes 3 copies (.CSV, _2.CSV, _4.CSV). |
| UPD.VENDRA | Vendors | Interactive | 43 | 3 | Maintains the product lines of a pending vendor return authorization (VENDRA): add products, delete them, or change quantities. |
| UPD.WEBORDERS | Orders | Staging-processor | 413 | 23 | Imports member web orders (CSV staged in WEBORDERS 'TEST_ORDER.TXT'), groups them into PRO orders, and creates IVORD/ORDHIST and per-vendor VNORD orders. It updates product demand and member open orders, and archives the lines to WEBORD.PERM. |
| UPD.WH | Members | Batch | 50 | 7 | Year-end accumulation for the co-op STOCK record. It adds each member's purchases of camera products (IVMST EGRP 59) from the ARHIST.11 archive into STOCK attr 9. |
| UPDATE | Utility | Utility/maintenance | 27 | 1 | Generic tool that overwrites one attribute (validated against the dictionary) with a fixed value on every record of an active select list, in any file. |
| UPDATE.ARSHIP | AR | Test-variant | 117 | 1 | Truncated/broken copy of UPD.EDICREDITS (member-billing half only) that was meant to rebuild ARMST/ARINV/ARSHIP from EDI invoice data. |
| UPDATE.UPC | Products | Utility/maintenance | 8 | 1 | One-off that copies IVMST UPC (attr 29) into W.UPC (attr 51, warehouse UPC/EAN) for an active select list. |
| VEND.ENT.COMP | Vendors | Interactive | 15 | 1 | Records the completion date of a vendor return (VENDRA attr 7). |
| VEND.ENT.RA | Vendors | Interactive | 13 | 1 | Records the vendor's RA number on a pending vendor return. |
| VEND.ENT.SHIP | Vendors | Interactive | 14 | 1 | Marks a vendor return as shipped today. |
| VEND.RA.HOLD | Vendors | Interactive | 82 | 4 | Starts a vendor return. All pending return products for a vendor are moved from VENDRET (returns holding, keyed by product) into a new VENDRA return request numbered from CONTROL 'RA'. |
| VERIFY.ARMST | AR | Report/print | 60 | 3 | Integrity check that recomputes each member's balance and aging buckets from ARINV and reports mismatches against ARMST. |
| WEBRBTS | AR | Staging-processor | 36 | 3 | Converts online consumer-rebate submissions staged in CONTROL 'RBTDATA' into PENDRBTS (pending rebate checks) records. |
| WEBSTMT | AR | Batch | 65 | 7 | Rebuilds the member web-statement files. It writes one WEBSTMT record per open invoice (with discount, net and due date) and one STMTSUM per member (totals and aging). |
| WH.DATA | Inventory | Interactive | 309 | 8 | Warehouse product maintenance screen for case qty, carton qty, weight, dimensions and primary/secondary bin locations on IVMST, with a field-level change log to IVMST.LOG. |
| WH.PRINT | Utility | Utility/maintenance | 27 | 1 | Lets the warehouse choose which printer prints new orders and packing lists (CONTROL 'WH-PRINTERS'). |
| WHOAMI | Utility | Utility/maintenance | 2 | 1 | Displays SYSTEM(42) (current session/terminal info). |
| WHSE.DUE | Products | Interactive | 28 | 2 | Records the expected inbound shipment (due-in) date for a product in ORDDUE. |
| WIN.FTP.DATA | Utility | Utility/maintenance | 23 | 1 | Downloads the whole FTP.DATA file to the PC (directory from CONTROL 'FTP.DIR' attr 2, file IVDATA) via the wIntegrate terminal import. |
| X | Inventory | Test-variant | 3 | 1 | Developer call of IV.UPD.COGS for one product. |
| XX | Members | Utility/maintenance | 19 | 2 | One-off correction that reduces members' warehouse profit (ARMST attr 40 WH.PROFIT) for units of product 9832 on a saved list of ARHIST invoices. |
| ZIP.9 | Members | Interactive | 20 | 1 | Captures the +4 part of a member's ZIP code into ZIP9. |
