// ProductPricing.cs   NEW, beside ProductContractDataAccess.cs (same namespace)
//
// Market pricing for the Product Desk:
//   - the models for exchange rates, markets, conversion and the price history
//   - ProductCurrency: pull the ECB daily reference rates (a public XML file,
//     no key, no AI) and convert US prices into a market's currency.
//
// The ECB quotes every currency against the euro, so the dollar rate is a cross:
//   units of X per USD = (X per EUR) / (USD per EUR);   EUR per USD = 1 / (USD per EUR)

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Xml.Linq;

namespace ProInternal.Services.ProductContract
{
    // ---- exchange rates ----------------------------------------------------

    public sealed class ExchangeRateRow
    {
        public int ExchangeRateId { get; set; }
        public string Currency { get; set; } = "";
        public decimal UnitsPerUsd { get; set; }          // $1 buys this many units
        public DateTime RateDate { get; set; }            // the date the source published it
        public string Source { get; set; } = "";          // ECB | MANUAL
        public string? Status { get; set; }               // PENDING | ACCEPTED | REJECTED
        public string? Reason { get; set; }
        public DateTime? ExpiresOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTimeOffset? CreatedAt { get; set; }
        public string? DecidedBy { get; set; }
        public DateTimeOffset? DecidedAt { get; set; }
        public string? ClearedBy { get; set; }
        public DateTimeOffset? ClearedAt { get; set; }
        public string? ClearedReason { get; set; }

        /* Pending rows only: the rate this one would replace. */
        public decimal? CurrentUnitsPerUsd { get; set; }
        public DateTime? CurrentRateDate { get; set; }
        public string? CurrentSource { get; set; }
    }

    public sealed class ExchangeRateBoard
    {
        public List<ExchangeRateRow> Current { get; set; } = new();
        public List<ExchangeRateRow> Pending { get; set; } = new();
        public List<ExchangeRateRow> History { get; set; } = new();

        /* Set after a refresh. */
        public int? Added { get; set; }
        public DateTime? FeedDate { get; set; }
    }

    public sealed class PulledRate
    {
        public string Currency { get; set; } = "";
        public decimal UnitsPerUsd { get; set; }
        public DateTime RateDate { get; set; }
    }

    public sealed class DecideRatesRequest
    {
        public List<int> Ids { get; set; } = new();
        public bool Accept { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class OverrideRateRequest
    {
        public string Currency { get; set; } = "";
        public decimal UnitsPerUsd { get; set; }
        public string Reason { get; set; } = "";
        public DateTime? ExpiresOn { get; set; }
    }

    public sealed class ClearRateRequest
    {
        public string? Reason { get; set; }
    }

    /* What a rate procedure returns: refused with a message, or done. */
    public sealed class RateActionResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = "";
    }

    // ---- markets and conversion ----------------------------------------------

    public sealed class MarketRow
    {
        public string Country { get; set; } = "";
        public string Name { get; set; } = "";
        public string Currency { get; set; } = "";
        public string Locale { get; set; } = "";
        public bool IsHome { get; set; }
        public decimal UpliftPercent { get; set; }
        public decimal RoundTo { get; set; }
    }

    public sealed class MoneyValue
    {
        public string? Amount { get; set; }
        public string? Currency { get; set; }
    }

    public sealed class ConvertPricesRequest
    {
        /* The home-market prices to convert from, keyed memberPrice, cartonPrice, ... */
        public Dictionary<string, MoneyValue> Source { get; set; } = new();
        public List<string> Countries { get; set; } = new();
    }

    public sealed class ConvertedMarket
    {
        public string Country { get; set; } = "";
        public string Currency { get; set; } = "";
        public Dictionary<string, MoneyValue> Prices { get; set; } = new();
        public int? ExchangeRateId { get; set; }
        public decimal UnitsPerUsd { get; set; }
        public DateTime? RateDate { get; set; }
        public string? RateSource { get; set; }
        public decimal UpliftPercent { get; set; }
        public decimal RoundTo { get; set; }
    }

    public sealed class ConvertFailure
    {
        public string Country { get; set; } = "";
        public string Message { get; set; } = "";
    }

    public sealed class ConvertPricesResult
    {
        public List<ConvertedMarket> Results { get; set; } = new();
        public List<ConvertFailure> Failures { get; set; } = new();
    }

    // ---- how a product's market prices were made, and their history ----------

    public sealed class MarketPriceMeta
    {
        public string Country { get; set; } = "";
        public string? Method { get; set; }               // CONVERTED | MANUAL | null
        public int? ExchangeRateId { get; set; }
        public decimal? UnitsPerUsd { get; set; }
        public DateTime? RateDate { get; set; }
        public decimal? UpliftPercent { get; set; }
        public string? SourceHash { get; set; }
    }

    public sealed class PriceLogRow
    {
        public long LogId { get; set; }
        public string Country { get; set; } = "";
        public string PriceKey { get; set; } = "";
        public string? Currency { get; set; }
        public decimal? OldAmount { get; set; }
        public decimal? NewAmount { get; set; }
        public string Method { get; set; } = "";          // CONVERTED | MANUAL | REMOVED
        public int? ExchangeRateId { get; set; }
        public decimal? UnitsPerUsd { get; set; }
        public DateTime? RateDate { get; set; }
        public decimal? UpliftPercent { get; set; }
        public string? Reason { get; set; }
        public string ChangedBy { get; set; } = "";
        public DateTimeOffset ChangedAt { get; set; }
    }

    public sealed class ProductPricingAudit
    {
        public List<MarketPriceMeta> Markets { get; set; } = new();
        public List<PriceLogRow> History { get; set; } = new();
    }

    // ---- the rate pull and the arithmetic --------------------------------------

    public static class ProductCurrency
    {
        public const string EcbDailyUrl = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

        /* The selling prices a market carries, in the order the page shows them. */
        public static readonly string[] PriceKeys =
            { "memberPrice", "cartonPrice", "authorizedDealerPrice", "map", "consumerRetail", "dropShipCharge" };

        /* Currencies pulled beyond the market currencies: the ones vendor costs come in. */
        public static readonly string[] CostCurrencies = { "CAD", "CNY", "JPY", "KRW" };

        private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };

        public sealed class EcbPull
        {
            public DateTime RateDate { get; init; }
            public List<PulledRate> Rates { get; init; } = new();
        }

        /// <summary>
        /// Reads the ECB daily file. Returns every currency it lists (plus EUR), per US dollar.
        /// Throws InvalidOperationException with a message fit to show when it cannot.
        /// </summary>
        public static async Task<EcbPull> FetchEcbAsync(CancellationToken cancellationToken)
        {
            string xml;

            try
            {
                xml = await Http.GetStringAsync(EcbDailyUrl, cancellationToken);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                throw new InvalidOperationException("The ECB rate file could not be reached. Try again, or set the rate by hand.", ex);
            }

            XDocument doc;

            try
            {
                doc = XDocument.Parse(xml);
            }
            catch (System.Xml.XmlException ex)
            {
                throw new InvalidOperationException("The ECB rate file could not be read.", ex);
            }

            // <Cube><Cube time="2026-10-13"><Cube currency="USD" rate="1.0890"/>...
            var day = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "Cube" && e.Attribute("time") != null)
                      ?? throw new InvalidOperationException("The ECB rate file did not contain a rate date.");

            var rateDate = DateTime.ParseExact(day.Attribute("time")!.Value, "yyyy-MM-dd", CultureInfo.InvariantCulture);

            var perEur = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

            foreach (var cube in day.Elements().Where(e => e.Name.LocalName == "Cube"))
            {
                var currency = cube.Attribute("currency")?.Value.Trim().ToUpperInvariant();
                var rateText = cube.Attribute("rate")?.Value;

                if (currency is { Length: 3 } &&
                    decimal.TryParse(rateText, NumberStyles.Number, CultureInfo.InvariantCulture, out var rate) &&
                    rate > 0)
                {
                    perEur[currency] = rate;
                }
            }

            if (!perEur.TryGetValue("USD", out var usdPerEur))
                throw new InvalidOperationException("The ECB rate file has no US dollar rate.");

            var rates = new List<PulledRate>
            {
                new() { Currency = "EUR", UnitsPerUsd = Math.Round(1m / usdPerEur, 8), RateDate = rateDate }
            };

            foreach (var (currency, rate) in perEur)
            {
                if (currency == "USD") continue;
                rates.Add(new PulledRate { Currency = currency, UnitsPerUsd = Math.Round(rate / usdPerEur, 8), RateDate = rateDate });
            }

            return new EcbPull { RateDate = rateDate, Rates = rates };
        }

        /// <summary>
        /// US amount to market amount: times the rate, plus the uplift, rounded to the market's step
        /// (0.01 = to the cent, 1 = whole units). Halves round away from zero.
        /// </summary>
        public static decimal Convert(decimal usdAmount, decimal unitsPerUsd, decimal upliftPercent, decimal roundTo)
        {
            var step = roundTo > 0 ? roundTo : 0.01m;
            var raw = usdAmount * unitsPerUsd * (1m + upliftPercent / 100m);

            return Math.Round(raw / step, 0, MidpointRounding.AwayFromZero) * step;
        }

        public static string Format(decimal amount) => amount.ToString("0.00##", CultureInfo.InvariantCulture);

        /// <summary>
        /// Converts the home prices into each requested market at the rates now in force.
        /// A market with no accepted rate comes back as a failure, never with a guessed rate.
        /// </summary>
        public static ConvertPricesResult ConvertPrices(
            ConvertPricesRequest request, IReadOnlyList<MarketRow> markets, IReadOnlyList<ExchangeRateRow> currentRates)
        {
            var result = new ConvertPricesResult();
            var home = markets.FirstOrDefault(m => m.IsHome);
            var homeCountry = home?.Country ?? "US";
            var homeCurrency = home?.Currency ?? "USD";

            if (homeCurrency != "USD")
            {
                result.Failures.Add(new ConvertFailure { Country = homeCountry, Message = "Rates are kept per US dollar, so the home market must price in USD." });
                return result;
            }

            var source = new Dictionary<string, decimal>();

            foreach (var key in PriceKeys)
            {
                if (!request.Source.TryGetValue(key, out var money) || money is null || string.IsNullOrWhiteSpace(money.Amount))
                    continue;

                if (!string.Equals(money.Currency ?? homeCurrency, homeCurrency, StringComparison.OrdinalIgnoreCase))
                {
                    result.Failures.Add(new ConvertFailure { Country = homeCountry, Message = $"The home {key} is not in {homeCurrency}." });
                    return result;
                }

                if (decimal.TryParse(money.Amount, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount) && amount >= 0)
                    source[key] = amount;
            }

            if (source.Count == 0)
            {
                result.Failures.Add(new ConvertFailure { Country = homeCountry, Message = "There is no home price to convert from." });
                return result;
            }

            foreach (var country in request.Countries.Select(c => (c ?? "").Trim().ToUpperInvariant()).Distinct())
            {
                var market = markets.FirstOrDefault(m => m.Country == country);

                if (market is null)
                {
                    result.Failures.Add(new ConvertFailure { Country = country, Message = "Not a market PRO sells in." });
                    continue;
                }

                if (market.IsHome) continue;

                if (market.Currency == homeCurrency)
                {
                    result.Failures.Add(new ConvertFailure { Country = country, Message = $"{market.Name} prices in {homeCurrency}; there is nothing to convert." });
                    continue;
                }

                var rate = currentRates.FirstOrDefault(r => r.Currency == market.Currency);

                if (rate is null)
                {
                    result.Failures.Add(new ConvertFailure
                    {
                        Country = country,
                        Message = $"No accepted {market.Currency} rate. Refresh rates and accept one, or set one by hand."
                    });
                    continue;
                }

                var converted = new ConvertedMarket
                {
                    Country = country,
                    Currency = market.Currency,
                    ExchangeRateId = rate.ExchangeRateId,
                    UnitsPerUsd = rate.UnitsPerUsd,
                    RateDate = rate.RateDate,
                    RateSource = rate.Source,
                    UpliftPercent = market.UpliftPercent,
                    RoundTo = market.RoundTo
                };

                foreach (var (key, amount) in source)
                {
                    converted.Prices[key] = new MoneyValue
                    {
                        Amount = Format(Convert(amount, rate.UnitsPerUsd, market.UpliftPercent, market.RoundTo)),
                        Currency = market.Currency
                    };
                }

                result.Results.Add(converted);
            }

            return result;
        }
    }
}
