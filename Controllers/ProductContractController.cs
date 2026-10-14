using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Services.ProductContract;
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
