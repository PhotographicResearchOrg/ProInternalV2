using Dapper;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.ProductContract
{
    /* ------------------------------------------------------------------
     * The product page's view of one product.
     *
     * Product and Content are the two contract documents
     * (Schemas/products/product.schema.json and product-content.schema.json).
     * Everything else here is for the screen and is never saved.
     * ------------------------------------------------------------------ */
    public sealed class ProductPageData
    {
        public JsonObject Product { get; set; } = new();
        public JsonObject Content { get; set; } = new();

        /* Live numbers from fulfillment. Shown, never saved. */
        public ProductLiveNumbers Live { get; set; } = new();

        /* True while Computyme still feeds prices, UPC, case quantities and status. */
        public bool ComputymeFieldsLocked { get; set; }

        /* True when the inventory marker, not a stored flag, decides direct vendor ship. */
        public bool FollowsInventoryMarker { get; set; }
        public bool MarkerSaysDirect { get; set; }

        public string? ComputymeActualVendor { get; set; }
        public string? ComputymeVendorGroup { get; set; }

        /* Category ids as ProductData holds them today: top, category, sub-category. */
        public List<string> CategoryPath { get; set; } = new();

        public DateTimeOffset? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }

    public sealed class ProductLiveNumbers
    {
        public int? UnitsAvailable { get; set; }
        public int? UnitsOnOrder { get; set; }
        public int? UnitsOnMemberOrders { get; set; }
        public string? StockDue { get; set; }
    }

    public sealed class ProductSaveRequest
    {
        public JsonObject? Product { get; set; }
        public JsonObject? Content { get; set; }

        /* True leaves direct vendor ship to the inventory marker. */
        public bool FollowInventoryMarker { get; set; } = true;

        /*
         * How each market's prices were made, and why any converted price was overridden:
         *   { "reason": "...", "markets": [ { "country": "DE", "method": "CONVERTED",
         *     "exchangeRateId": 41, "upliftPercent": 0, "sourceHash": "9a1c03ff" } ] }
         * Read by dbo.PIV2_ProductMarketPrice_Audit and _SetMethod.
         */
        public JsonObject? PriceAudit { get; set; }
    }

    public sealed class ProductSaveResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<string> Problems { get; set; } = new();
    }

    public sealed class ProductBrandOption
    {
        public string BrandId { get; set; } = string.Empty;
        public string? Name { get; set; }
        public string? VendorId { get; set; }
        public string? VendorName { get; set; }
        public bool DirectShipAll { get; set; }
    }

    public interface IProductContractDataAccess
    {
        Task<ProductPageData?> GetAsync(int productId, bool sqlIsMaster, CancellationToken cancellationToken);
        Task<ProductSaveResult> SaveAsync(int productId, ProductSaveRequest request, string updatedBy, bool sqlIsMaster, CancellationToken cancellationToken);
        Task<List<ProductBrandOption>> GetBrandsAsync(CancellationToken cancellationToken);

        // ---- market pricing: exchange rates, markets, conversion history ----
        Task<ExchangeRateBoard> GetExchangeRatesAsync(CancellationToken cancellationToken);
        Task<int> AddPulledRatesAsync(IEnumerable<PulledRate> rates, string user, CancellationToken cancellationToken);
        Task DecideExchangeRatesAsync(IEnumerable<int> ids, bool accept, string? reason, string user, CancellationToken cancellationToken);
        Task<RateActionResult> OverrideExchangeRateAsync(OverrideRateRequest request, string user, CancellationToken cancellationToken);
        Task<RateActionResult> ClearExchangeRateAsync(int exchangeRateId, string? reason, string user, CancellationToken cancellationToken);
        Task<List<MarketRow>> GetMarketsAsync(CancellationToken cancellationToken);
        Task<ProductPricingAudit> GetPricingAuditAsync(int productId, CancellationToken cancellationToken);
    }

    public class ProductContractDataAccess : BaseDataAccess, IProductContractDataAccess
    {
        public ProductContractDataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config, helper, "ProConnectionString")
        {
        }

        private const string HomeCountry = "US";

        public async Task<ProductPageData?> GetAsync(
            int productId, bool sqlIsMaster, CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            ProductRow? row;
            List<MarketPriceRow> markets;
            List<ContentRow> content;

            /* Read and close the multi-result set before the next call on this connection. */
            using (var results = await conn.QueryMultipleAsync(new CommandDefinition(
                "dbo.PIV2_Product_Get",
                new { ProductId = productId, SqlIsMaster = sqlIsMaster },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken)))
            {
                row = await results.ReadFirstOrDefaultAsync<ProductRow>();
                markets = (await results.ReadAsync<MarketPriceRow>()).ToList();
                content = (await results.ReadAsync<ContentRow>()).ToList();
            }

            if (row is null)
                return null;

            /* How each language's text was made (AI or a person) and whether it is reviewed. */
            if (content.Count > 0)
            {
                var translations = (await conn.QueryAsync<(string Locale, string TranslationJson)>(new CommandDefinition(
                    "dbo.PIV2_ProductContent_GetTranslation",
                    new { ProductId = productId },
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: cancellationToken)))
                    .ToDictionary(t => t.Locale, t => t.TranslationJson, StringComparer.OrdinalIgnoreCase);

                foreach (var item in content)
                {
                    if (translations.TryGetValue(item.Locale, out var json))
                        item.TranslationJson = json;
                }
            }

            return BuildPageData(row, markets, content, !sqlIsMaster);
        }

        public async Task<ProductSaveResult> SaveAsync(
            int productId, ProductSaveRequest request, string updatedBy, bool sqlIsMaster,
            CancellationToken cancellationToken)
        {
            StampReviews(request.Content, updatedBy);

            using var conn = GetConnection();
            if (conn.State != ConnectionState.Open)
                conn.Open();

            /*
             * One transaction: the save replaces the product's language rows,
             * then the translation status is written back onto them. If either
             * fails, neither is kept, so AI text can never lose its "not
             * reviewed" mark.
             *
             * Market prices: every change is logged against what is stored
             * BEFORE the save overwrites it, and how each market was priced
             * (converted at which rate, or by hand) is written back AFTER.
             * A refused audit (override without a reason, conversion at a
             * rate nobody accepted) saves nothing.
             */
            using var transaction = conn.BeginTransaction();

            var priceAudit = request.PriceAudit?.ToJsonString();

            var audit = await conn.QuerySingleAsync<ProductSaveResult>(new CommandDefinition(
                "dbo.PIV2_ProductMarketPrice_Audit",
                new
                {
                    ProductId = productId,
                    ProductJson = request.Product!.ToJsonString(),
                    MetaJson = priceAudit,
                    User = updatedBy
                },
                transaction,
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));

            if (!audit.Success)
            {
                transaction.Rollback();
                return new ProductSaveResult
                {
                    Success = false,
                    Message = "The product was not saved.",
                    Problems = new List<string> { audit.Message }
                };
            }

            var saved = await conn.QuerySingleAsync<ProductSaveResult>(new CommandDefinition(
                "dbo.PIV2_Product_Save",
                new
                {
                    ProductId = productId,
                    Product = request.Product!.ToJsonString(),
                    Content = request.Content?.ToJsonString(),
                    UpdatedBy = updatedBy,
                    FollowInventoryMarker = request.FollowInventoryMarker,
                    SqlIsMaster = sqlIsMaster
                },
                transaction,
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));

            if (!saved.Success)
            {
                transaction.Rollback();
                return saved;
            }

            if (request.Content is not null)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "dbo.PIV2_ProductContent_SetTranslation",
                    new { ProductId = productId, Content = request.Content.ToJsonString() },
                    transaction,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: cancellationToken));
            }

            await conn.ExecuteAsync(new CommandDefinition(
                "dbo.PIV2_ProductMarketPrice_SetMethod",
                new { ProductId = productId, MetaJson = priceAudit },
                transaction,
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));

            transaction.Commit();
            return saved;
        }

        // ---------------------------------------------------------------
        // Market pricing: exchange rates (pulled, accepted, or set by hand),
        // markets, and how each product's market prices were made.
        // ---------------------------------------------------------------

        public async Task<ExchangeRateBoard> GetExchangeRatesAsync(CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            using var results = await conn.QueryMultipleAsync(new CommandDefinition(
                "dbo.PIV2_ExchangeRate_Get",
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));

            return new ExchangeRateBoard
            {
                Current = (await results.ReadAsync<ExchangeRateRow>()).ToList(),
                Pending = (await results.ReadAsync<ExchangeRateRow>()).ToList(),
                History = (await results.ReadAsync<ExchangeRateRow>()).ToList()
            };
        }

        /* Stores a pull as PENDING; returns how many rates were new. */
        public async Task<int> AddPulledRatesAsync(IEnumerable<PulledRate> rates, string user, CancellationToken cancellationToken)
        {
            var json = JsonSerializer.Serialize(rates.Select(r => new
            {
                currency = r.Currency,
                unitsPerUsd = r.UnitsPerUsd,
                rateDate = r.RateDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            }));

            using var conn = GetConnection();

            return await conn.ExecuteScalarAsync<int>(new CommandDefinition(
                "dbo.PIV2_ExchangeRate_AddPulled",
                new { RatesJson = json, User = user },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
        }

        public async Task DecideExchangeRatesAsync(
            IEnumerable<int> ids, bool accept, string? reason, string user, CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            await conn.ExecuteAsync(new CommandDefinition(
                "dbo.PIV2_ExchangeRate_Decide",
                new { IdsJson = JsonSerializer.Serialize(ids), Accept = accept, Reason = reason, User = user },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
        }

        public async Task<RateActionResult> OverrideExchangeRateAsync(
            OverrideRateRequest request, string user, CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            return await conn.QuerySingleAsync<RateActionResult>(new CommandDefinition(
                "dbo.PIV2_ExchangeRate_Override",
                new
                {
                    Currency = (request.Currency ?? "").Trim().ToUpperInvariant(),
                    UnitsPerUSD = request.UnitsPerUsd,
                    Reason = request.Reason,
                    ExpiresOn = request.ExpiresOn?.Date,
                    User = user
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
        }

        public async Task<RateActionResult> ClearExchangeRateAsync(
            int exchangeRateId, string? reason, string user, CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            return await conn.QuerySingleAsync<RateActionResult>(new CommandDefinition(
                "dbo.PIV2_ExchangeRate_Clear",
                new { ExchangeRateId = exchangeRateId, Reason = reason, User = user },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
        }

        public async Task<List<MarketRow>> GetMarketsAsync(CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var rows = await conn.QueryAsync<MarketRow>(new CommandDefinition(
                "dbo.PIV2_Market_Get",
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));

            return rows.ToList();
        }

        public async Task<ProductPricingAudit> GetPricingAuditAsync(int productId, CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            using var results = await conn.QueryMultipleAsync(new CommandDefinition(
                "dbo.PIV2_ProductPricing_GetAudit",
                new { ProductId = productId },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));

            return new ProductPricingAudit
            {
                Markets = (await results.ReadAsync<MarketPriceMeta>()).ToList(),
                History = (await results.ReadAsync<PriceLogRow>()).ToList()
            };
        }

        /*
         * The reviewer is whoever saves the tick, recorded here on the server,
         * never taken from the page. Unticking clears it.
         */
        private static void StampReviews(JsonObject? content, string updatedBy)
        {
            foreach (var locale in (content?["locales"] as JsonArray)?.OfType<JsonObject>() ?? Enumerable.Empty<JsonObject>())
            {
                if (locale["translation"] is not JsonObject translation)
                    continue;

                var reviewed = translation["reviewed"]?.GetValueKind() == JsonValueKind.True;

                if (!reviewed)
                {
                    translation["reviewed"] = false;
                    translation.Remove("reviewedBy");
                    translation.Remove("reviewedAt");
                }
                else if (translation["reviewedBy"] is null)
                {
                    translation["reviewedBy"] = updatedBy;
                    translation["reviewedAt"] = DateTimeOffset.UtcNow.ToString("o", CultureInfo.InvariantCulture);
                }
            }
        }

        public async Task<List<ProductBrandOption>> GetBrandsAsync(CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var rows = await conn.QueryAsync<ProductBrandOption>(new CommandDefinition(
                "dbo.PIV2_Product_GetBrands",
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));

            return rows.ToList();
        }

        // ---------------------------------------------------------------
        // Rows to contract documents. Empty values are left out: the
        // contract has no place for a blank.
        // ---------------------------------------------------------------

        internal static ProductPageData BuildPageData(
            ProductRow row, List<MarketPriceRow> markets, List<ContentRow> content, bool computymeFieldsLocked)
        {
            var id = row.ProductId.ToString(CultureInfo.InvariantCulture);

            var product = new JsonObject
            {
                ["schemaVersion"] = "1.0",
                ["metadata"] = new JsonObject { ["productId"] = id }
            };

            var core = new JsonObject
            {
                ["sku"] = row.Sku ?? id,
                ["name"] = row.Name ?? row.Sku ?? id,
                ["status"] = row.StatusCode ?? "ACTIVE",
                ["forSale"] = row.ForSale
            };

            /* Only a discontinued product names a replacement. */
            if (row.StatusCode == "DISCONTINUED")
                Put(core, "replacementSku", row.ReplacementSku);

            product["product"] = core;

            if (row.BrandId is not null)
                product["brandId"] = row.BrandId.Value.ToString(CultureInfo.InvariantCulture);

            var identifiers = new JsonObject();
            Put(identifiers, "upc", Digits(row.Upc, 12));
            Put(identifiers, "ean", Digits(row.Ean, 13));
            Put(identifiers, "caseGtin", Digits(row.CaseGtin, 14));
            Put(identifiers, "vendorCatalogNumber", row.VendorCatalogNumber);
            AddIfAny(product, "identifiers", identifiers);

            var currency = row.PriceCurrency ?? "USD";
            var pricing = new JsonObject();
            PutMoney(pricing, "memberPrice", row.MemberPrice, currency);

            /* A carton price is only a carton price when a quantity of 2 or more earns it. */
            if (row.CartonPrice > 0 && row.CartonQuantity >= 2)
            {
                PutMoney(pricing, "cartonPrice", row.CartonPrice, currency);
                pricing["cartonQuantity"] = row.CartonQuantity;
            }

            PutMoney(pricing, "authorizedDealerPrice", row.AuthorizedDealerPrice, currency);
            PutMoney(pricing, "map", row.MapPrice, currency);
            PutMoney(pricing, "consumerRetail", row.ConsumerRetail, currency);
            PutMoney(pricing, "distributorCost", row.DistributorCost, row.DistributorCostCurrency ?? "USD");
            PutMoney(pricing, "landedCost", row.LandedCost, "USD");
            PutMoney(pricing, "dropShipCharge", row.DropShipCharge, currency);
            PutMoney(pricing, "shippingSurcharge", row.ShippingSurcharge, currency);
            AddIfAny(product, "pricing", pricing);

            var marketPricing = new JsonArray();

            foreach (var market in markets)
            {
                var entry = new JsonObject { ["country"] = market.Country };
                PutMoney(entry, "memberPrice", market.MemberPrice, market.Currency);

                if (market.CartonPrice > 0 && market.CartonQuantity >= 2)
                {
                    PutMoney(entry, "cartonPrice", market.CartonPrice, market.Currency);
                    entry["cartonQuantity"] = market.CartonQuantity;
                }

                PutMoney(entry, "authorizedDealerPrice", market.AuthorizedDealerPrice, market.Currency);
                PutMoney(entry, "map", market.MapPrice, market.Currency);
                PutMoney(entry, "consumerRetail", market.ConsumerRetail, market.Currency);
                PutMoney(entry, "dropShipCharge", market.DropShipCharge, market.Currency);

                /* A country with no price is not a market. */
                if (entry.Count > 1)
                    marketPricing.Add(entry);
            }

            if (marketPricing.Count > 0)
                product["marketPricing"] = marketPricing;

            var supply = new JsonObject
            {
                ["directVendorShip"] = row.DirectVendorShip,
                ["dropShipEligible"] = row.DropShipEligible,
                ["specialOrder"] = row.SpecialOrder
            };

            if (row.SupplyVendorId is not null)
                supply["vendorId"] = row.SupplyVendorId.Value.ToString(CultureInfo.InvariantCulture);
            if (row.OrderMultiple >= 1) supply["orderMultiple"] = row.OrderMultiple;
            if (row.UnitsPerCase >= 1) supply["unitsPerCase"] = row.UnitsPerCase;
            product["supply"] = supply;

            var logistics = new JsonObject();

            if (row.WeightValue > 0 && row.WeightUnit is "LB" or "KG")
            {
                logistics["weight"] = new JsonObject { ["value"] = row.WeightValue, ["unit"] = row.WeightUnit };
            }

            if (row.DimLength > 0 && row.DimWidth > 0 && row.DimHeight > 0 && row.DimUnit is "IN" or "CM")
            {
                logistics["dimensions"] = new JsonObject
                {
                    ["length"] = row.DimLength, ["width"] = row.DimWidth,
                    ["height"] = row.DimHeight, ["unit"] = row.DimUnit
                };
            }

            Put(logistics, "countryOfOrigin", row.CountryOfOrigin?.Trim());

            if (ParseArray(row.HsCodesJson) is { Count: > 0 } hsCodes)
                logistics["hsCodes"] = hsCodes;
            if (row.ContainsLithiumBattery is not null)
                logistics["containsLithiumBattery"] = row.ContainsLithiumBattery;

            logistics["prop65Warning"] = row.Prop65Warning;
            product["logistics"] = logistics;

            var replenishment = new JsonObject();
            if (row.MinimumStock >= 0) replenishment["minimumStock"] = row.MinimumStock;
            if (row.MonthsSupply > 0) replenishment["monthsSupply"] = row.MonthsSupply;
            AddIfAny(product, "replenishment", replenishment);

            var returns = new JsonObject();
            Put(returns, "defectiveDisposition", row.DefectiveDisposition);
            AddIfAny(product, "returns", returns);

            // ---- content ----
            var contentDoc = new JsonObject
            {
                ["schemaVersion"] = "1.0",
                ["productId"] = id,
                ["visibility"] = new JsonObject
                {
                    ["published"] = row.Published && content.Count > 0,
                    ["markets"] = ParseArray(row.MarketsJson) ?? new JsonArray()
                }
            };

            var path = new[] { row.TopCatId, row.CatId, row.SubCatId }
                .Where(value => value is not null && value != 0)
                .Select(value => value!.Value.ToString(CultureInfo.InvariantCulture))
                .Distinct()
                .ToList();

            /* The deepest level is where the product sits. */
            if (path.Count > 0)
            {
                contentDoc["categories"] = new JsonArray(
                    new JsonObject { ["categoryId"] = path[^1], ["isPrimary"] = true });
            }

            if (content.Count > 0)
            {
                var locales = new JsonArray();

                foreach (var item in content)
                {
                    var locale = new JsonObject { ["locale"] = item.Locale, ["name"] = item.Name };
                    Put(locale, "shortDescription", item.ShortDescription);
                    Put(locale, "description", item.Description);
                    Put(locale, "featuresHtml", item.FeaturesHtml);
                    Put(locale, "specsHtml", item.SpecsHtml);

                    if (ParseArray(item.FeaturesJson) is { Count: > 0 } features) locale["features"] = features;
                    if (ParseArray(item.SpecsJson) is { Count: > 0 } specs) locale["specs"] = specs;
                    if (ParseArray(item.DocumentsJson) is { Count: > 0 } documents) locale["documents"] = documents;

                    Put(locale, "outOfStockMessage", item.OutOfStockMessage);

                    if (ParseObject(item.TranslationJson) is { } translation)
                        locale["translation"] = translation;

                    locales.Add(locale);
                }

                contentDoc["defaultLocale"] =
                    content.Any(item => item.Locale == row.DefaultLocale)
                        ? row.DefaultLocale
                        : content[0].Locale;
                contentDoc["locales"] = locales;
            }

            return new ProductPageData
            {
                Product = product,
                Content = contentDoc,
                Live = new ProductLiveNumbers
                {
                    UnitsAvailable = row.UnitsAvailable,
                    UnitsOnOrder = row.UnitsOnOrder,
                    UnitsOnMemberOrders = row.UnitsOnMemberOrders,
                    StockDue = row.StockDueDate
                },
                ComputymeFieldsLocked = computymeFieldsLocked,
                FollowsInventoryMarker = row.FollowsInventoryMarker,
                MarkerSaysDirect = row.MarkerSaysDirect,
                ComputymeActualVendor = row.ComputymeActualVendor,
                ComputymeVendorGroup = row.ComputymeVendorGroup,
                CategoryPath = path,
                UpdatedAt = row.UpdatedAt,
                UpdatedBy = row.UpdatedBy
            };
        }

        private static void Put(JsonObject target, string name, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                target[name] = value;
        }

        private static void PutMoney(JsonObject target, string name, decimal? amount, string? currency)
        {
            if (amount is null || amount <= 0 || string.IsNullOrWhiteSpace(currency))
                return;

            target[name] = new JsonObject
            {
                ["amount"] = amount.Value.ToString("0.00##", CultureInfo.InvariantCulture),
                ["currency"] = currency.Trim().ToUpperInvariant()
            };
        }

        private static void AddIfAny(JsonObject target, string name, JsonObject section)
        {
            if (section.Count > 0)
                target[name] = section;
        }

        /* A barcode is kept only when it is the right number of digits. Anything else is left out, not passed on wrong. */
        private static string? Digits(string? value, int length)
        {
            var text = value?.Trim();

            return text is not null && text.Length == length && text.All(char.IsAsciiDigit)
                ? text
                : null;
        }

        private static JsonObject? ParseObject(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return null;

            try
            {
                return JsonNode.Parse(json) as JsonObject;
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static JsonArray? ParseArray(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return null;

            try
            {
                return JsonNode.Parse(json) as JsonArray;
            }
            catch (JsonException)
            {
                return null;
            }
        }

        // ---- result rows of dbo.PIV2_Product_Get ----

        internal sealed class ProductRow
        {
            public int ProductId { get; set; }
            public string? Sku { get; set; }
            public string? Name { get; set; }
            public int? BrandId { get; set; }
            public string? StatusCode { get; set; }
            public bool ForSale { get; set; }
            public string? ReplacementSku { get; set; }
            public string? Upc { get; set; }
            public string? Ean { get; set; }
            public string? CaseGtin { get; set; }
            public string? VendorCatalogNumber { get; set; }
            public string? PriceCurrency { get; set; }
            public decimal? MemberPrice { get; set; }
            public decimal? CartonPrice { get; set; }
            public int? CartonQuantity { get; set; }
            public decimal? AuthorizedDealerPrice { get; set; }
            public decimal? MapPrice { get; set; }
            public decimal? ConsumerRetail { get; set; }
            public decimal? DropShipCharge { get; set; }
            public decimal? ShippingSurcharge { get; set; }
            public decimal? DistributorCost { get; set; }
            public string? DistributorCostCurrency { get; set; }
            public decimal? LandedCost { get; set; }
            public bool DirectVendorShip { get; set; }
            public bool FollowsInventoryMarker { get; set; }
            public bool MarkerSaysDirect { get; set; }
            public bool DropShipEligible { get; set; }
            public bool SpecialOrder { get; set; }
            public int? OrderMultiple { get; set; }
            public int? UnitsPerCase { get; set; }
            public int? SupplyVendorId { get; set; }
            public string? ComputymeActualVendor { get; set; }
            public string? ComputymeVendorGroup { get; set; }
            public decimal? WeightValue { get; set; }
            public string? WeightUnit { get; set; }
            public decimal? DimLength { get; set; }
            public decimal? DimWidth { get; set; }
            public decimal? DimHeight { get; set; }
            public string? DimUnit { get; set; }
            public string? CountryOfOrigin { get; set; }
            public string? HsCodesJson { get; set; }
            public bool? ContainsLithiumBattery { get; set; }
            public bool Prop65Warning { get; set; }
            public int? MinimumStock { get; set; }
            public decimal? MonthsSupply { get; set; }
            public string? DefectiveDisposition { get; set; }
            public bool Published { get; set; }
            public string? MarketsJson { get; set; }
            public string? DefaultLocale { get; set; }
            public long? TopCatId { get; set; }
            public long? CatId { get; set; }
            public long? SubCatId { get; set; }
            public int? UnitsAvailable { get; set; }
            public int? UnitsOnOrder { get; set; }
            public int? UnitsOnMemberOrders { get; set; }
            public string? StockDueDate { get; set; }
            public DateTimeOffset? UpdatedAt { get; set; }
            public string? UpdatedBy { get; set; }
        }

        internal sealed class MarketPriceRow
        {
            public string Country { get; set; } = string.Empty;
            public string Currency { get; set; } = "USD";
            public decimal? MemberPrice { get; set; }
            public decimal? CartonPrice { get; set; }
            public int? CartonQuantity { get; set; }
            public decimal? AuthorizedDealerPrice { get; set; }
            public decimal? MapPrice { get; set; }
            public decimal? ConsumerRetail { get; set; }
            public decimal? DropShipCharge { get; set; }
        }

        internal sealed class ContentRow
        {
            public string Locale { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string? ShortDescription { get; set; }
            public string? Description { get; set; }
            public string? FeaturesHtml { get; set; }
            public string? SpecsHtml { get; set; }
            public string? FeaturesJson { get; set; }
            public string? SpecsJson { get; set; }
            public string? DocumentsJson { get; set; }
            public string? OutOfStockMessage { get; set; }

            /* From dbo.PIV2_ProductContent_GetTranslation, not PIV2_Product_Get. */
            public string? TranslationJson { get; set; }
        }
    }
}
