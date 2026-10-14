using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Services.ProductContract;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    /* The product page: read one product as its two contract documents, and save them. */
    [Authorize]
    [Route("api/products")]
    [ApiController]
    public class ProductContractController : ControllerBase
    {
        private readonly IProductContractDataAccess _products;
        private readonly IConfiguration _configuration;

        /* One Bedrock client for the app; it is thread-safe and costly to create. */
        private static IProductTranslationService? _translator;
        private static readonly object TranslatorLock = new();

        public ProductContractController(IConfiguration configuration, AwsSecretHelper secretHelper)
        {
            /* Created here, so nothing has to be added to the service registrations. */
            _products = new ProductContractDataAccess(configuration, secretHelper);
            _configuration = configuration;
        }

        private IProductTranslationService Translator
        {
            get
            {
                if (_translator is null)
                {
                    lock (TranslatorLock)
                    {
                        _translator ??= new BedrockProductTranslationService(_configuration);
                    }
                }

                return _translator;
            }
        }

        /*
         * False until Computyme takes product updates from PRO. While false,
         * prices, UPC, case quantities and status are read from Computyme's
         * feed and a save does not change them.
         */
        private bool SqlIsMaster => _configuration.GetValue<bool>("Product:SqlIsMaster");

        [HttpGet("{productId:int}/contract")]
        public async Task<ActionResult<ProductPageData>> Get(int productId, CancellationToken cancellationToken)
        {
            var data = await _products.GetAsync(productId, SqlIsMaster, cancellationToken);

            return data is null
                ? NotFound("The product was not found.")
                : Ok(data);
        }

        [HttpPost("{productId:int}/contract")]
        public async Task<ActionResult<ProductSaveResult>> Save(
            int productId,
            [FromBody] ProductSaveRequest request,
            CancellationToken cancellationToken)
        {
            // Any signed-in user can save for now. To restrict it, add the check your
            // other controllers use, e.g.
            //   if (!User.IsAllowed(_configuration, ProductPermissions.Modify)) return Forbid();

            var updatedBy = CurrentUserName();

            if (string.IsNullOrWhiteSpace(updatedBy))
            {
                // Lists claim NAMES only (no values), so the right one can be picked.
                return Unauthorized("Unable to identify the current user. Token claims: "
                    + string.Join(", ", User.Claims.Select(c => c.Type).Distinct()));
            }

            var problems = ProductRuleCheck.Check(productId, request.Product, request.Content);

            if (problems.Count > 0)
            {
                return Ok(new ProductSaveResult
                {
                    Success = false,
                    Message = "The product was not saved.",
                    Problems = problems
                });
            }

            return Ok(await _products.SaveAsync(productId, request, updatedBy, SqlIsMaster, cancellationToken));
        }

        /*
         * Translates one language's content into others with Bedrock.
         * Nothing is saved: the page shows the result marked "AI, not
         * reviewed", and the normal save stores it.
         */
        [HttpPost("{productId:int}/contract/translate")]
        public async Task<ActionResult<ProductTranslateResult>> Translate(
            int productId,
            [FromBody] ProductTranslateRequest request,
            CancellationToken cancellationToken)
        {
            if (request.Source is null || request.Targets.Count == 0)
                return BadRequest("Send the source language's content and at least one language to translate into.");

            if (string.IsNullOrWhiteSpace(Str(request.Source["name"])))
                return BadRequest("The source language needs a name before it can be translated.");

            /* Every brand name is protected, not only this product's: descriptions mention others. */
            var brands = await _products.GetBrandsAsync(cancellationToken);
            request.DoNotTranslate.AddRange(brands.Select(b => b.Name ?? "").Where(n => n.Length > 1));
            request.DoNotTranslate.Add("ProMaster");

            var result = await Translator.TranslateAsync(request, cancellationToken);

            /* Every language failed the same way (e.g. no permission): say so plainly. */
            if (result.Results.Count == 0 && result.Failures.Count > 0)
                return StatusCode(502, result.Failures[0].Message);

            return Ok(result);
        }

        private static string? Str(System.Text.Json.Nodes.JsonNode? node) =>
            node is System.Text.Json.Nodes.JsonValue v && v.TryGetValue<string>(out var s) ? s : null;

        [HttpGet("contract/brands")]
        public async Task<ActionResult<IEnumerable<ProductBrandOption>>> GetBrands(CancellationToken cancellationToken)
        {
            return Ok(await _products.GetBrandsAsync(cancellationToken));
        }

        // ---------------------------------------------------------------
        // Market pricing. Rates are pulled from the ECB only when someone
        // clicks Refresh, and are used only once someone accepts them. A
        // rate set by hand needs a reason. Accepting and setting rates use
        // the same permission as saving a product; to narrow it, add the
        // check to the three rate POSTs.
        // ---------------------------------------------------------------

        [HttpGet("contract/exchange-rates")]
        public async Task<ActionResult<ExchangeRateBoard>> GetExchangeRates(CancellationToken cancellationToken)
        {
            return Ok(await _products.GetExchangeRatesAsync(cancellationToken));
        }

        /* Pull the ECB file now. New rates come back PENDING: nothing changes until someone accepts. */
        [HttpPost("contract/exchange-rates/refresh")]
        public async Task<ActionResult<ExchangeRateBoard>> RefreshExchangeRates(CancellationToken cancellationToken)
        {
            var user = CurrentUserName();
            if (string.IsNullOrWhiteSpace(user)) return Unauthorized("Unable to identify the current user.");

            ProductCurrency.EcbPull pull;

            try
            {
                pull = await ProductCurrency.FetchEcbAsync(cancellationToken);
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(502, ex.Message);
            }

            /* Only the currencies PRO prices or buys in: the market currencies plus the usual cost currencies. */
            var wanted = (await _products.GetMarketsAsync(cancellationToken))
                .Select(m => m.Currency)
                .Concat(ProductCurrency.CostCurrencies)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var added = await _products.AddPulledRatesAsync(
                pull.Rates.Where(r => wanted.Contains(r.Currency)), user, cancellationToken);

            var board = await _products.GetExchangeRatesAsync(cancellationToken);
            board.Added = added;
            board.FeedDate = pull.RateDate;
            return Ok(board);
        }

        [HttpPost("contract/exchange-rates/decide")]
        public async Task<ActionResult<ExchangeRateBoard>> DecideExchangeRates(
            [FromBody] DecideRatesRequest request, CancellationToken cancellationToken)
        {
            var user = CurrentUserName();
            if (string.IsNullOrWhiteSpace(user)) return Unauthorized("Unable to identify the current user.");
            if (request?.Ids is null || request.Ids.Count == 0) return BadRequest("Choose at least one rate.");

            await _products.DecideExchangeRatesAsync(request.Ids, request.Accept, request.Reason, user, cancellationToken);
            return Ok(await _products.GetExchangeRatesAsync(cancellationToken));
        }

        /* A rate typed by a person: used straight away, needs a reason. */
        [HttpPost("contract/exchange-rates/override")]
        public async Task<ActionResult<ExchangeRateBoard>> OverrideExchangeRate(
            [FromBody] OverrideRateRequest request, CancellationToken cancellationToken)
        {
            var user = CurrentUserName();
            if (string.IsNullOrWhiteSpace(user)) return Unauthorized("Unable to identify the current user.");
            if (request is null) return BadRequest("No rate was sent.");

            var result = await _products.OverrideExchangeRateAsync(request, user, cancellationToken);
            if (!result.Success) return BadRequest(result.Message);

            return Ok(await _products.GetExchangeRatesAsync(cancellationToken));
        }

        /* Withdraw a manual rate early: the last accepted ECB rate applies again. */
        [HttpPost("contract/exchange-rates/{exchangeRateId:int}/clear")]
        public async Task<ActionResult<ExchangeRateBoard>> ClearExchangeRate(
            int exchangeRateId, [FromBody] ClearRateRequest? request, CancellationToken cancellationToken)
        {
            var user = CurrentUserName();
            if (string.IsNullOrWhiteSpace(user)) return Unauthorized("Unable to identify the current user.");

            var result = await _products.ClearExchangeRateAsync(exchangeRateId, request?.Reason, user, cancellationToken);
            if (!result.Success) return BadRequest(result.Message);

            return Ok(await _products.GetExchangeRatesAsync(cancellationToken));
        }

        [HttpGet("contract/markets")]
        public async Task<ActionResult<IEnumerable<MarketRow>>> GetMarkets(CancellationToken cancellationToken)
        {
            return Ok(await _products.GetMarketsAsync(cancellationToken));
        }

        /*
         * Converts the home prices sent into the markets asked for, at the
         * accepted rates plus each market's uplift and rounding. Saves
         * nothing: the page fills the form and the normal save stores it.
         */
        [HttpPost("contract/convert-prices")]
        public async Task<ActionResult<ConvertPricesResult>> ConvertPrices(
            [FromBody] ConvertPricesRequest request, CancellationToken cancellationToken)
        {
            if (request is null || request.Countries.Count == 0) return BadRequest("Choose at least one market.");

            var markets = await _products.GetMarketsAsync(cancellationToken);
            var rates = (await _products.GetExchangeRatesAsync(cancellationToken)).Current;

            return Ok(ProductCurrency.ConvertPrices(request, markets, rates));
        }

        /* How each market was priced, and every market price change. */
        [HttpGet("{productId:int}/contract/pricing-audit")]
        public async Task<ActionResult<ProductPricingAudit>> GetPricingAudit(int productId, CancellationToken cancellationToken)
        {
            return Ok(await _products.GetPricingAuditAsync(productId, cancellationToken));
        }

        /* The signed-in user's name, whichever claim the login token carries it in. */
        private string? CurrentUserName()
        {
            if (!string.IsNullOrWhiteSpace(User.Identity?.Name))
                return User.Identity!.Name;

            string[] claimTypes =
            {
                ClaimTypes.Name, "name", "unique_name", "username", "Username", "preferred_username",
                ClaimTypes.Email, "email", ClaimTypes.NameIdentifier, "sub", "UserId", "userId"
            };

            foreach (var type in claimTypes)
            {
                var value = User.FindFirstValue(type);
                if (!string.IsNullOrWhiteSpace(value))
                    return value;
            }

            return null;
        }
    }
}
