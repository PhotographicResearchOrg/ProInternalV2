# Release: Category Desk and Product AI

**Branch:** `feature/category-desk` (from `feature/phase-2-rebate-desk`) · **Date:** 2026-10-21 · **Owner:** Mark (CTO)

## What's new

### Category Desk (`/categories`)
- Manage the category tree members see on the Connection WH page: groups, EGRP categories and sub-categories, at any depth.
- Drag and drop categories and products; rename, show/hide, internal notes, merge, delete (with reallocation of its products).
- Everything is a **draft until Publish**. Undo/redo, discard, and the draft survives a reload.
- **History:** every publish logged with before and after; **any past publish can be reverted** (as a new publish).
- **Queues:** Uncategorized and Suspect (hidden or missing category, product on a parent, product outside its EGRP category, discontinued with an uncategorized replacement), each with a suggested category and the reason (replacement, brand, vendor, EGRP).
- **Bulk moves:** search by name, code, brand, vendor, status, for sale, public, EGRP, new in N days; select all matches; move.
- **Preview** of the WH page Categories list, built from the draft.
- **Excel export** on the tree, every product list and queue, history and any single publish.
- **EGRP categories** (marked with a lock) are Computyme's until `Product:SqlIsMaster` is true: they can be renamed and regrouped, never nested, merged away or emptied; products stay inside their own EGRP category.
- Replaces the legacy ProdCat and NewCats screens.

### Product Desk
- **Categories:** a picker with the breadcrumb and EGRP; saves through the Category Desk publish, so it's in the history.
- **Market research** (`AI.MarketResearch`): one-click topics or your own question, answered from the web with sources by Perplexity. Every answer is saved to the product with the model, cost, who and when.
- **Forecast** (`AI.Forecast`): 3, 6 or 12 months, likely units and an 80% range per month, all countries and per country, charted with the last 24 months of sales. Numbers worked out in the PIV2 back end from Computyme sales history (the most accurate of six standard methods per product, $0); Claude on Bedrock writes the buyer note. Every run is saved and scored against actual sales; accuracy report across products exports to Excel.
- **Translate** now needs `AI.Translate` and counts against the AI budget.
- **Find details** (`AI.ProductLookup`): the manufacturer's name, descriptions, features, specs, UPC, EAN and image links, beside what the product has now. **Use** copies a value into the page; nothing changes until Save. UPC stays Computyme's until cutover.
- **Competitor prices** (`AI.CompetitorPricing`): US retailer prices with links, stock and date, lowest and typical, compared with our MAP; exports to Excel. Both use Perplexity and are saved to the product like market research.
- **Discontinued** switch beside For sale and Shown on web (Computyme's until `SqlIsMaster`), and **Replaced by** with search by code or name and a link to the replacement.
- **Shopify & assets** (read only): Shopify ids and every Shopify column on ProductData, the `productlastchanged` feed with Shopify's answers, governance issues, taxonomy; images (`ProductImage` with the sizes FolderScan found), `UploadFile` documents, S3 files (`GetProductFiles`), video columns; exports to Excel.

### AI controls
- One permission per feature, always enforced: `AI.MarketResearch`, `AI.Translate`, `AI.Forecast`, `AI.ProductLookup`, `AI.CompetitorPricing`, `AI.Usage` (report).
- On/off switch for all AI and per feature; monthly budget; daily limit per person; cost estimate before each call.
- Every call logged (`piv2.AiUsageLog`) with the model that answered; usage report exports to Excel.

## Database (PRO)

Nothing is dropped, deleted or updated when the scripts run; all are safe to run twice.

| Script | Adds |
|---|---|
| `00-discovery-read-only.sql` | Read only: checks before deploying |
| `01-category-desk-tables.sql` | `Category.Notes` (nullable), `piv2.CategoryChangeLog`, publish sequence, EGROUPS synonym, `piv2.vProductEgrp`, `piv2.vCategoryProduct`, `piv2.vCategoryTree` |
| `02-category-desk-procedures.sql` | `piv2.CategoryDesk_*` procedures |
| `03-category-desk-permissions.sql` | `Categories.View`, `Categories.Edit` |
| `04-ai-governance.sql` | `piv2.AiUsageLog`, `piv2.Ai_*` procedures |
| `05-ai-permissions.sql` | AI permissions |
| `06-forecast.sql` | `piv2.ProductForecast`, `piv2.SalesMonthly`, `piv2.vMemberCountry`, `piv2.Forecast_*`; grant to read sales |
| `07-product-assets.sql` | `piv2.Product_Assets` (read only: Shopify fields and feed, images, documents) |

## Deploy, in order

1. **SQL in PRO:** `01` to `07`.
   - `05`: `@ProductRoute` is `/productedit`; change it if the Product Desk route is `/products`.
   - `06`: set `@AppUser` in the last block (the API's database user) so the API can read sales history.
   - Run `01` again if the Vendor Desk's `dbo.VendorBrand` is added later; run `06` again after the Rebate Desk's nightly sales job is installed.
2. **Security Admin:**
   - **First:** `AI.Translate` to the roles that translate today, or their Translate buttons disappear.
   - `Categories.View` / `Categories.Edit`, `AI.MarketResearch`, `AI.Forecast`, `AI.Usage` to the right roles.
   - Add **Category Desk** → `/categories` to the menu.
3. **appsettings** (internal API):
   ```json
   "AI": { "Enabled": true, "MonthlyBudgetUsd": 100 },
   "Perplexity": { "ApiKey": "(from Secrets Manager)" }
   ```
   Optional: `AI:Features:<MarketResearch|Translate|Forecast>` for `Enabled`, `DailyLimitPerUser`, `EstimatedCostUsd`; `Bedrock:SummaryModel` for the forecast note (default Claude Sonnet 5.5).
4. **Deploy** the API and client from the branch.
5. **Retire** ProdCat and NewCats from the old ProInternal menu.

**Rollback:** redeploy the previous API and client. The new SQL objects are only used by this release.

## Checked

- Client builds (Angular 17, `strictTemplates`): no errors, no new warnings.
- API code compiles (.NET 8) against the real security helpers.
- Forecast engine tested on seasonal, trending, flat, declining, intermittent and new-product sales.
- Perplexity answer handling tested against the documented Agent API response.
- SQL reviewed line by line and by an independent reviewer (all findings fixed). Not run here; no SQL Server was available.

## Known open items

- Whether the WH page already hides empty categories and products in hidden categories (from `00`); if not, a small change to `Shop_GetActiveCategories` / `Warehouse_Search_FIX`.
- Members' country comes from `Roster.Country` once the Member Desk columns exist; until then forecasts count everyone as US.
- Production SA passwords are in plain text in the legacy site's `Web.config` and Connection's `appsettings.json`: rotate them and move them to Secrets Manager.
