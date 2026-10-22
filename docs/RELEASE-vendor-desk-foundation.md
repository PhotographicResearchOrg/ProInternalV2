# Vendor Desk foundation: release notes

Cutover map, Brands & vendors (brand ↔ vendor links and product classes), and two new Vendor Desk tabs: Vendor record and Direct billing. A Brands tab on the Vendor Desk shows the vendor's brands from `dbo.Brand.VendorID`. Every list exports to Excel.

## Run in PRO (both are non-destructive and safe to run twice)
1. `sql/vendor-desk/01-vendor-desk-foundation.sql`: new `piv2` tables, functions and procedures; seeds the cutover map, the APMST field labels and Computyme's product classes (insert-only).
2. `sql/vendor-desk/02-vendor-desk-permissions.sql`: adds `Cutover.Admin`, `Brands.Edit`, `Vendors.Edit`, `ProductClasses.Edit`.
3. `sql/vendor-desk/03-product-supply.sql`: `piv2.Warehouse` (seeded with the PA warehouse, Hatboro) and `piv2.Product_SupplyInfo` for the product page header.

If you ran an earlier copy of 01, run it again: the direct-billing split moved onto the existing Terms & Financials split, so `piv2.VendorBillingSplit` and `piv2.VendorBilling_Save` from that copy are no longer used (they can stay; nothing reads them).

The only write to an existing table is `piv2.BrandVendor_Set`. It changes `dbo.Brand.VendorID` for one brand, needs a reason and logs the change. The B2B vendor filter reads that column, so a moved brand shows up under its new vendor there. Nothing is written to EDA.

## Security Admin
- Routes to add as menu items: `/cutover` (Cutover map, under Admin with the Integration Desk), `/brandvendors` (Brands & vendors, under Vendor Management). `/vendor-card` already exists.
- Grant `Brands.Edit` only to the people who should move brands between vendors (it shows on the B2B site).
- `Cutover.Admin` changes who is master of a section. Only the people deciding cutover should have it.

## What each screen shows
| Screen | Data | Master |
|---|---|---|
| Cutover map | `piv2.CutoverSection` (23 sections seeded), with B2B-read sections marked | the map itself is PIV2 |
| Brands & vendors › Brands | `dbo.Brand.VendorID` vs each product's actual vendor in Computyme (IVMST A.VENDOR) | brand link: SQL; "bought from": Computyme |
| Brands & vendors › Product classes | `piv2.ProductClass`: Computyme's 479/497/500/600/700/900/992/999 with their hard-coded rules; new classes | Computyme (locked) / PIV2 extension |
| Vendor Desk › Vendor record | every APMST field, parsed terms, where the vendor is used | Computyme (read only) |
| Vendor Desk › Brands | this vendor's brands; move a brand here | SQL |
| Vendor Desk › Terms & Financials | "In Computyme" card: parsed terms, cash discount, surcharge, member-bill flag, direct-billing programs; compared with the PIV2 discount split and payable terms below it | Computyme (locked) / PIV2 |
| Vendor Desk › Direct Vendor Ship | where the vendor's products ship from: PA warehouse, direct (99999+), out of stock, by brand; flags brands set to ship everything direct that are stocked in PA | Computyme stock (read only) |
| Product page header | vendor (Computyme actual vendor), brand's vendor when different, class, suspend status 1/2/3, stock by warehouse with bin locations | Computyme (locked) / SQL (brand's vendor) |

## Things to confirm with the data
- APMST `SUR_CHG_PCT` vs `R_ADD`: AR7 reads APMST field 30 as the surcharge rate, but the mirror's field 30 column is named `R_ADD`. Both are shown with a note.
- Terms text that doesn't parse shows "Not understood" with the original text.
