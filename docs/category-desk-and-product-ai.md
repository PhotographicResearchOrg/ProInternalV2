# Category Desk + Product AI

**Built 2026-10-21** on branch `feature/category-desk`, from `feature/phase-2-rebate-desk`. Design and decisions: `docs/category-desk-and-product-ai.docx`.

## Where it is

```
sql/category-desk/
  00-discovery-read-only.sql         read-only checks (send the results back)
  01-category-desk-tables.sql        Category.Notes, piv2.CategoryChangeLog, publish sequence, EGROUPS synonym, views
  02-category-desk-procedures.sql    tree, products + queues + suggestions, filters, publish, revert, history
  03-category-desk-permissions.sql   Categories.View, Categories.Edit
  04-ai-governance.sql               piv2.AiUsageLog + budget / limit / report / research procedures
  05-ai-permissions.sql              AI.MarketResearch, AI.Translate, AI.Usage (+ 4 for the next package)
Controllers/CategoryDeskController.cs, Controllers/AiController.cs
Models/CategoryDesk/, Models/Ai/
Services/Ai/AiGovernance.cs, Services/Ai/PerplexityResearchService.cs
Services/IProDataAccess.cs, Services/ProDataAccess.cs        #region Category Desk, #region Product AI
Controllers/ProductContractController.cs                      Translate behind AI.Translate, budget and log
Program.cs                                                    AiGovernance, PerplexityResearchService
ClientApp/src/app/prointernalengine/components/ecommerce/category-desk/, category-picker/, product-ai/
ClientApp/src/app/models/category/, models/ai/
ClientApp/src/app/services/data.service.ts                    Category Desk and Product AI regions
app.module.ts, app-routing.module.ts (/categories), product-edit (category picker, Market research, Translate gating)
docs/category-desk-and-product-ai.docx                        design and decisions
```

## Deploy, in order

1. **Names are confirmed** against PRO: EGRP list `EDA.EGROUPS.EGROUPS`; a product's EGRP is `IVMSTData.E_GRP` (read in one view, `piv2.vProductEgrp`, which is the one line to change at cutover); brand from `dbo.Brand`; vendor from `dbo.VendorBrand` when it exists. `dbo.Product` (a synonym to a cache table) is not used.
   - `02`: the restore of a deleted category assumes `Category.ImageName` fits 400 characters and `Type` 100; adjust if the columns are larger.
2. **SQL, in PRO:** run `01`, `02`, `03`, `04`, `05`, `06` (forecast; set `@AppUser` in its last block so the API can read the sales copy in PRO_NUKE). `01` builds the product view with vendors only if `dbo.VendorBrand` exists at that moment; if the Vendor Desk tables arrive later, run `01` again. In `05`, `@ProductRoute` is `/productedit`; change it if the Product Desk route has moved to `/products`.
3. **Security Admin:**
   - **First:** give `AI.Translate` to the roles that translate today. Translate is behind it from this release, or the buttons disappear.
   - `Categories.View` / `Categories.Edit`, `AI.MarketResearch`, `AI.Usage` to the right roles. `PIV2_ADMIN` passes everything.
4. **appsettings** (internal API). Every value is optional; these are the defaults apart from the key:
   ```json
   "AI": {
     "Enabled": true,
     "MonthlyBudgetUsd": 100,
     "Features": {
       "MarketResearch": { "Enabled": true, "Model": "Perplexity Agent (fast)", "EstimatedCostUsd": 0.03, "DailyLimitPerUser": 25 },
       "Translate":      { "Enabled": true, "Model": "Claude on Bedrock",       "EstimatedCostUsd": 0.02, "DailyLimitPerUser": 100 }
     }
   },
   "Perplexity": { "ApiKey": "(from Secrets Manager)", "Preset": "fast", "MaxOutputTokens": 1500 }
   ```
   `FileLibrary:Bucket` is already set (Rebate Desk); research snapshots go there under `product-research/<product id>/`.
5. **API and client:** build and deploy this branch.
6. **Menu:** add **Category Desk** → `/categories` in Security Admin's menu/route list, and take ProdCat and NewCats off the old ProInternal menu so the tree has one editor.

**Rollback:** redeploy the previous API and client. The SQL adds only a nullable column, new piv2 objects and permissions; nothing reads them but this package.

## How it behaves

- Everything on the Category Desk is a draft until **Publish**. Undo/redo, discard, and the draft survives a reload.
- Any past publish can be reverted (as a new publish). Later changes to the same items are listed; skip or overwrite.
- A publish is refused if someone published changes to the same items after you started.
- EGRP categories (Category.EGRP set) sit at the top level or under a web group. Until `Product:SqlIsMaster` is true they are Computyme's: they can be renamed and regrouped, not merged away or emptied; products and the sub-categories inside an EGRP category stay inside it. EGRP categories never nest.
- Product placement is written exactly as today (`TopCatId` / `CatId` / `SubCatId`); moving a category re-writes every product under it. Show/hide writes `IsActive` and `IsPublic` together.
- Rules refused by the procedures come back as 400 with a plain message (50480–50499).
- Forecast (Product Desk, `AI.Forecast`): monthly units for 3, 6 or 12 months, by country, from the nightly sales copy (`PRO_NUKE.piv2.MemberSalesMonth`). The numbers come from an engine built into the API that backtests several methods per product and keeps the most accurate ($0); Claude on Bedrock writes the buyer summary. Every run is saved (`piv2.ProductForecast`) and scored against actual sales; accuracy report exports to Excel.
- AI: every call checks permission, feature on, monthly budget and the user's daily limit, then logs who, model, cost and outcome to `piv2.AiUsageLog`. Market research answers are saved to the product with sources, model and cost.

## Checked here

- **Client** builds (Angular 17, `strictTemplates`): no errors, no new warnings.
- **API** files compile (.NET 8) against the real `Permissions` / `RequirePermission` helpers, with stand-ins for Dapper, SqlClient and the File Library (NuGet wasn't reachable).
- **Perplexity parsing** tested against the documented Agent API response shape.
- **SQL** reviewed line by line and twice by a second reviewer (eight fixes applied, then re-checked clean); not run, as no SQL Server was available.

## Open

- `category-discovery.sql` results: which column `Warehouse_Search_FIX` matches, which flag `Shop_GetActiveCategories` reads, what else reads `Category`.
- Whether `Shop_GetActiveCategories` leaves out empty categories, and `Warehouse_Search_FIX` drops products in hidden ones. If not, each is a small change to that procedure.
