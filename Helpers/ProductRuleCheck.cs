using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ProInternal.Services.ProductContract
{
    /* ------------------------------------------------------------------
     * The contract's rules, checked on the server before a save.
     *
     * This is NOT the JSON Schema validator. It checks the rules that
     * matter most with plain code, so a save is never unguarded. Add
     * the schema check beside it the way OrderSchemaValidator does for
     * orders; the two together are the full guard.
     * ------------------------------------------------------------------ */
    public static class ProductRuleCheck
    {
        private static readonly Regex Amount = new(@"^[0-9]+(\.[0-9]{1,4})?$", RegexOptions.Compiled);
        private static readonly Regex Currency = new("^[A-Z]{3}$", RegexOptions.Compiled);
        private static readonly Regex Country = new("^[A-Z]{2}$", RegexOptions.Compiled);
        private static readonly Regex HsCode = new("^[0-9]{6,10}$", RegexOptions.Compiled);
        private static readonly Regex Locale = new("^[a-z]{2}(-[A-Z]{2})?$", RegexOptions.Compiled);

        private static readonly string[] PriceNames =
        {
            "memberPrice", "cartonPrice", "authorizedDealerPrice", "map", "consumerRetail",
            "distributorCost", "landedCost", "dropShipCharge", "shippingSurcharge"
        };

        private static readonly string[] Statuses = { "ACTIVE", "DISCONTINUED", "INACTIVE" };
        private static readonly string[] Dispositions = { "DISCARD", "RETURN_TO_WAREHOUSE", "RETURN_TO_VENDOR", "RETURN_TO_HQ" };

        public static List<string> Check(int productId, JsonObject? product, JsonObject? content)
        {
            var problems = new List<string>();

            if (product is null)
            {
                problems.Add("The product document is missing.");
                return problems;
            }

            if (Text(product["metadata"]?["productId"]) != productId.ToString())
                problems.Add("The document is for a different product.");

            var core = product["product"] as JsonObject;
            var status = Text(core?["status"]);

            if (string.IsNullOrWhiteSpace(Text(core?["sku"]))) problems.Add("A product code is required.");
            if (string.IsNullOrWhiteSpace(Text(core?["name"]))) problems.Add("A name is required.");
            if (!Statuses.Contains(status)) problems.Add("The status is not one of the choices.");
            if (Text(core?["replacementSku"]) is { Length: > 0 } && status != "DISCONTINUED")
                problems.Add("Only a discontinued product names a replacement.");

            var identifiers = product["identifiers"];
            CheckDigits(problems, Text(identifiers?["upc"]), 12, "A UPC is 12 digits.");
            CheckDigits(problems, Text(identifiers?["ean"]), 13, "An EAN is 13 digits.");
            CheckDigits(problems, Text(identifiers?["caseGtin"]), 14, "A case GTIN is 14 digits.");

            CheckPrices(problems, "Home market", product["pricing"] as JsonObject);

            var countries = new HashSet<string>();

            foreach (var market in (product["marketPricing"] as JsonArray)?.OfType<JsonObject>() ?? Enumerable.Empty<JsonObject>())
            {
                var country = Text(market["country"]) ?? "";

                if (!Country.IsMatch(country))
                    problems.Add("A market needs a two-letter country code.");
                else if (!countries.Add(country))
                    problems.Add($"{country} is priced twice.");

                if (market.Count < 2)
                    problems.Add($"{country} has no price.");

                CheckPrices(problems, country, market);
            }

            var supply = product["supply"];
            var direct = supply?["directVendorShip"]?.GetValueKind() == System.Text.Json.JsonValueKind.True;

            if (direct && Text(product["brandId"]) is null && Text(supply?["vendorId"]) is null)
                problems.Add("A direct vendor ship product needs a brand or a vendor.");

            var logistics = product["logistics"];

            if (Text(logistics?["countryOfOrigin"]) is { } origin && !Country.IsMatch(origin))
                problems.Add("Country of origin must be a two-letter country code.");

            var hsCountries = new HashSet<string>();

            foreach (var hs in (logistics?["hsCodes"] as JsonArray)?.OfType<JsonObject>() ?? Enumerable.Empty<JsonObject>())
            {
                var country = Text(hs["country"]) ?? "";

                if (!Country.IsMatch(country) || !HsCode.IsMatch(Text(hs["code"]) ?? ""))
                    problems.Add("An HS code needs a country and 6 to 10 digits, with no dots.");
                else if (!hsCountries.Add(country))
                    problems.Add($"{country} has two HS codes.");
            }

            if (Text(product["returns"]?["defectiveDisposition"]) is { } disposition && !Dispositions.Contains(disposition))
                problems.Add("The defective disposition is not one of the choices.");

            if (content is not null)
                CheckContent(problems, productId, content);

            return problems;
        }

        private static void CheckContent(List<string> problems, int productId, JsonObject content)
        {
            if (Text(content["productId"]) != productId.ToString())
                problems.Add("The content is for a different product.");

            var locales = (content["locales"] as JsonArray)?.OfType<JsonObject>().ToList() ?? new List<JsonObject>();
            var published = content["visibility"]?["published"]?.GetValueKind() == System.Text.Json.JsonValueKind.True;
            var defaultLocale = Text(content["defaultLocale"]);
            var seen = new HashSet<string>();

            if (published && locales.Count == 0)
                problems.Add("A published product needs content in at least one language.");

            foreach (var locale in locales)
            {
                var code = Text(locale["locale"]) ?? "";

                if (!Locale.IsMatch(code))
                    problems.Add($"'{code}' is not a language code such as en or fr-CA.");
                else if (!seen.Add(code))
                    problems.Add($"{code} appears twice.");

                if (string.IsNullOrWhiteSpace(Text(locale["name"])))
                    problems.Add($"{code}: a name is required.");

                if (locale["translation"] is JsonObject translation)
                {
                    if (Text(translation["method"]) is not ("AI" or "HUMAN"))
                        problems.Add($"{code}: the translation method must be AI or HUMAN.");

                    if (code == defaultLocale)
                        problems.Add($"{code}: the default language is the source, so it cannot be a translation.");
                }
            }

            if (locales.Count > 0 && (defaultLocale is null || !seen.Contains(defaultLocale)))
                problems.Add("The default language must be one of the languages.");

            var primaries = (content["categories"] as JsonArray)?.OfType<JsonObject>()
                .Count(category => category["isPrimary"]?.GetValueKind() == System.Text.Json.JsonValueKind.True) ?? 0;

            if (primaries > 1)
                problems.Add("Only one category can be primary.");
        }

        private static void CheckPrices(List<string> problems, string where, JsonObject? prices)
        {
            if (prices is null)
                return;

            foreach (var name in PriceNames)
            {
                if (prices[name] is not JsonObject money)
                    continue;

                if (!Amount.IsMatch(Text(money["amount"]) ?? "") || !Currency.IsMatch(Text(money["currency"]) ?? ""))
                    problems.Add($"{where}: {name} needs an amount and a three-letter currency.");
            }

            if (prices["cartonPrice"] is not null)
            {
                var quantity = prices["cartonQuantity"];
                /* Read through the JSON text, so it works however the number was created. */
                var ok = quantity is not null
                         && quantity.GetValueKind() == System.Text.Json.JsonValueKind.Number
                         && decimal.TryParse(quantity.ToJsonString(), System.Globalization.NumberStyles.Float,
                                             System.Globalization.CultureInfo.InvariantCulture, out var units)
                         && units >= 2;

                if (!ok)
                    problems.Add($"{where}: a carton price needs a carton quantity of 2 or more.");
            }
        }

        private static void CheckDigits(List<string> problems, string? value, int length, string message)
        {
            if (value is not null && (value.Length != length || !value.All(char.IsAsciiDigit)))
                problems.Add(message);
        }

        private static string? Text(JsonNode? node)
        {
            if (node is null)
                return null;

            return node.GetValueKind() switch
            {
                System.Text.Json.JsonValueKind.String => node.GetValue<string>(),
                System.Text.Json.JsonValueKind.Number => node.ToJsonString(),
                _ => null
            };
        }
    }
}
