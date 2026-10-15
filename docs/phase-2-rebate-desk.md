# Phase 2: Rebate Desk

Route `/rebatedesk`. Two rails, in the Product Desk format.

| Instant rebates | Price protection |
| --- | --- |
| Overview, New upload, Uploads, Purgatory, Programs, Batches, Products, Vendors & liability, Templates, Claims, Debit memos, Declined claims, History | Programs, Products, Vendors & liability, Claims, Debit memos, History |

All rebate data stays in **PRO_NUKE**. The desk writes programs into `dbo.RebateProgramDetail` / `dbo.PriceProtectionDetails` and products into `dbo.RebateCameraModels` / `RebateCameraModelsDetails` / `RebateQualifiers`, exactly as the member site (Connection) reads them. The desk's own tables, views and procedures are in the `piv2` schema in PRO_NUKE.

## How an upload works

1. **Vendor and file.** `.xlsx` or `.csv`. The original is stored unchanged on S3 through the file library (category `REBATE_SOURCE`, owner = vendor). The same file twice for a vendor is refused.
2. **Columns.** The desk finds the header row (title rows above it are skipped) and fingerprints the header names.
   - **Saved layout:** the vendor sent these headers before; the confirmed mapping is reused.
   - **AI:** otherwise Claude on Bedrock proposes the mapping from the headers and a few sample rows.
   - **Header names:** if the AI is unavailable, header names are matched against known aliases.

   The person confirms or changes every column. The confirmed mapping becomes the vendor's saved layout. File-wide defaults: rebate type, claim expiry (last end date + 60 days, as before), and load on or off.
3. **Checks.** Every row is checked. A row with any problem goes to **purgatory**:

   | Code | Meaning |
   | --- | --- |
   | `NO_MODEL` | No product matches the PRO code or description (add the product from purgatory) |
   | `AMBIGUOUS_MODEL` | Several products match equally; pick one (legacy "disposition") |
   | `MODEL_RETIRED` | The matched product is retired |
   | `NO_DATES`, `DATES_REVERSED` | Missing or reversed dates |
   | `BAD_REIMBURSEMENT`, `NEGATIVE_AMOUNT` | Bad amounts |
   | `NO_TYPE`, `UNKNOWN_TYPE` | Missing or unknown rebate type |
   | `DUPLICATE_IN_FILE` | The same product, type and dates appear twice in the file |
   | `ALREADY_LOADED`, `OVERLAP` | The same program is already live, or the dates overlap a live one |
   | `STACK_UNKNOWN`, `AMBIGUOUS_STACK` | The stack product cannot be matched |

4. **Load.** Ready rows load as one batch. The batch number continues above the highest legacy `BatchID`. `Expired` is set explicitly: 0 = on, 1 = off. Stack products become `RebateQualifiers` links. Rows fixed in purgatory later load into the same batch.

**Disposition** follows the legacy rule: a product is matched automatically only when exactly one fits. This vendor's products win over other vendors'. The match order is:

1. PRO code in `RebateCameraModelsDetails`
2. PRO code as `ModelName`
3. Description
4. Description ignoring spaces

A product a person picks is kept.

## After loading (Manage)

- **Programs:** turn a program on or off, change its amounts, or extend or shorten one program.
  - Amounts and dates are saved separately (legacy rule).
  - Members see a program as vendor + exact dates, so an extended program shows on its own on Connection.
- **Manual entry:** add programs by hand, with "repeat weekly for N weeks" (legacy rolling weeks). The set gets its own batch number.
- **Batches:** turn a whole batch on or off, or move its dates together.
- **Products:** add, change, retire or reactivate.
  - Manage PRO codes, using a lookup against PRO products.
  - Manage stacks.
  - Adding a PRO code already on another active product of the same rail is refused, because it would make uploads ambiguous.
- **Price protection:** add, change, or turn on/off `PriceProtectionDetails` rows (one per product and date). `EZPay` is left as it is on change. The legacy screen reset it to 0; tell me if that is required.

Every change needs a reason, except adding new things. Changes are kept in `piv2.RebateEvent` with before and after values.

## Vendors and liability

Product → vendor → parent company. Per vendor:

- live, current and upcoming programs
- claims, bucketed from the latest process row:
  - **Submitted:** not decided
  - **Approved, not sent to Computyme:** Status 1, `ComputymeProcessed` empty
  - **Open liability:** Submitted + Approved
  - **Not billed to vendor:** approved with no debit memo (`DM`)
  - **Credited** and **declined** in the chosen period

Drilling in shows per-product amounts and the open claims. Lines a member saved but never submitted are left out.

## Claims (accounting, `Rebates.Accounting`)

The nightly `RebateCredits` program is unchanged: it still sends approved claims to Computyme and builds invoices. The desk adds three repairs and replaces the legacy debit memo screen (`/Accounting/IRRebates`).

- **Resend credit.** Clears `ComputymeProcessed` on the claim's latest decision row, so the next nightly run sends the credit again. It is refused when:
  - AR (`Rebate_EDA_ARHist`) already shows the credit
  - the credit was sent in the last 48 hours (AR has not caught up yet)
  - it was already resent in the last 72 hours

  A claim with `ComputymeProcessed = 0` is shown as **held**: the nightly run skips it, and Resend queues it.
- **Recreate invoice.** Builds the credit invoice PDF from the AR credit with the same templates (`Templates/Rebates/CreditTemplate.pdf`, `CreditPriceTemplate.pdf`). The PRO INVOICE # field now shows the invoice number; the old program printed the member number there.
  - It writes `<invoice number>.pdf` to `RebateDesk:InvoiceFolder` (default `\\10.0.1.161\webserver_e`, where the member site reads it).
  - It keeps a copy on S3 (`REBATE_INVOICE`) and marks the claim invoiced.
- **Reprint.** Downloads the PDF already in that folder.
- **Debit memos.** Pick vendors (parent companies select all their vendors) and decision dates. Approved, unlocked claims with no DM are listed; tick them and enter the DM number.
  - The DM is stamped on the claims.
  - The CSV has the legacy columns and is kept on S3 (`REBATE_DEBIT_MEMO`).
  - It is emailed with the vendor's letter (`Templates/Rebates/DebitMemo/*.html`, chosen by vendor name as before) and any support files. The recipients are remembered per vendor.
  - A DM number can be used once.

**Fix needed in the nightly program, not changed here:** after building the first invoice it finds in AR, it marks *every* pending invoice as built (`Invoiced = 1` / `InvoiceGenerated = 1`). Claims whose credit had not posted yet never get a PDF. Recreate invoice repairs them one at a time. The program itself should mark only the claim it just built. Its UniVerse password is also in the source and should be rotated.

## Deploy

1. In **PRO_NUKE**, run in order (all are safe to run twice):
   - `sql/phase-2-rebate-desk/00-schema-and-grant.sql` (set `@AppUser` to the API's user on PRO_NUKE first)
   - `01-rebate-desk-tables.sql`
   - `02-rebate-desk-procedures.sql`
   - `03-rebate-products.sql`
   - `04-rebate-programs.sql`
   - `05-rebate-vendors.sql`
   - `07-rebate-claims.sql`
   
   `03` reads `[PRO].dbo.ProductData` for PRO code lookups, the same cross-database pattern `SubmitRebate` uses. `07` reads `eda.IVMST.IVMST` (catalog numbers) and `dbo.Rebate_EDA_ARHist` (the EDA database). The API's database user needs SELECT on those in PRO and EDA.
2. In **PRO**, run `06-integration-retention.sql` (the outbox clean-up deferred from Phase 1; runs daily, keeps 180 days, `Integration:RetentionDays`).
3. Bedrock: the server's AWS identity needs `bedrock:InvokeModel` on the mapping model. Settings:
   - `RebateDesk:MappingModel` (empty uses `Bedrock:TranslationModel`)
   - `"off"` disables the AI; header names are used instead
4. Deploy the API and Angular.
5. In Security Admin, create these permissions and grant them:
   - `Rebates.View` (route `/rebatedesk`)
   - `Rebates.Upload`
   - `Rebates.Manage`
   - `Rebates.Accounting`

   Optional settings:
   - `RebateDesk:InvoiceFolder` (`off` keeps invoices on S3 only)
   - `RebateDesk:DebitMemoFrom`
   - `RebateDesk:DebitMemoBcc`

   Email uses the existing `Email:*` SMTP settings.
6. Open Rebate Desk. Every existing program, batch and product shows. Nothing was changed by deploying.

The old screens (`/rebatesupport`, `/uploadrebates`, `/rebatesetup`) still work. Retire them once the desk is in use.

## Verified here

- Mapping: 17 cases pass. They cover the PIV2 template; a vendor sheet with title rows, `$` amounts, Excel serial dates and type names; "Vendor" not mistaken for an end date; footer totals dropped; CSV with quoted commas; `.xls` refused; AI answers with duplicates or out-of-range columns.
- The C# compiles against .NET 10 with stand-ins for Dapper, EPPlus, Bedrock, S3 and the SQL client. The full project was not compiled: NuGet is blocked here.
- The Angular development build succeeds, with no warnings in the new files.
- All SQL parses as T-SQL (sqlfluff). It was not run against a database.
- The credit invoice layout was checked by rendering the template with sample data, using the same field positions and row logic in a Python copy. The C# version uses PDFsharp, which is not available here, so it is compiled against stand-ins only.
- A separate review of the SQL and C# found nine problems. All are fixed:
  - resend now affects the latest decision only, with the 48 h / 72 h guards
  - `XACT_ABORT` is set inside every procedure
  - overlaps within a file or a batch are caught, and live-program checks run one at a time
  - debit memos check the latest decision
  - held (`0`) claims are handled
  - JSON key casing for rebate type and EZPay is fixed
  - null price-protection claim numbers are filtered out
  - rail casing is handled
