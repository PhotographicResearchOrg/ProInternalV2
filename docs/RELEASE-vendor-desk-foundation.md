# Vendor Desk foundation: release notes

Cutover map, Brands & vendors (brand ↔ vendor links and product classes), and two new Vendor Desk tabs: Vendor record and Direct billing. A Brands tab on the Vendor Desk shows the vendor's brands from `dbo.Brand.VendorID`. Every list exports to Excel.

## Run in PRO (both are non-destructive and safe to run twice)
1. `sql/vendor-desk/01-vendor-desk-foundation.sql`: new `piv2` tables, functions and procedures; seeds the cutover map, the APMST field labels and Computyme's product classes (insert-only).
2. `sql/vendor-desk/02-vendor-desk-permissions.sql`: adds `Cutover.Admin`, `Brands.Edit`, `Vendors.Edit`, `ProductClasses.Edit`.

The only write to an existing table is `piv2.BrandVendor_Set`. It changes `dbo.Brand.VendorID` for one brand, needs a reason and logs the change. The B2B vendor filter reads that column, so a moved brand shows up under its new vendor there. Nothing is written to EDA.

## Security Admin
- Routes to add as menu items: `/cutover` (Cutover map), `/brandvendors` (Brands & vendors). `/vendor-card` already exists.
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
| Vendor Desk › Direct billing | APMST PCT / SUR_CHG_PCT / CODE and VNMST program records as stored; the PIV2 split | Computyme (locked) / PIV2 extension |

## Things to confirm with the data
- APMST `SUR_CHG_PCT` vs `R_ADD`: AR7 reads APMST field 30 as the surcharge rate, but the mirror's field 30 column is named `R_ADD`. Both are shown with a note.
- Terms text that doesn't parse shows "Not understood" with the original text.
