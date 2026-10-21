#nullable disable
using System;
using System.Linq;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ProInternal.Helpers.Security;
using ProInternal.Models.Products;
using ProInternal.Services;

namespace ProInternal.Controllers
{
    /*
     * Product Desk · product sheet: every field of a product on one page.
     *
     *   GET api/products/{id}/sheet         every ProductData column (and Computyme's from dbo.Product, read only),
     *                                       the B2B tech specs, and the last 100 changes
     *   PUT api/products/{id}/sheet         save changed ProductData columns (one transaction, logged)
     *   GET api/products/sheet/layout       this person's layout (groups and fields shown, order)
     *   PUT api/products/sheet/layout
     *
     * Saving needs Products.Edit, or the Product Desk route (/productedit or /products) in Security Admin,
     * so whoever can use the Product Desk today can save. Locks (Computyme until Product:SqlIsMaster,
     * Category Desk, Shopify sync, system columns) are enforced in piv2.ProductSheet_Save; refusals are 400.
     */
    [Authorize]
    [ApiController]
    [Route("api/products")]
    public sealed class ProductSheetController : ControllerBase
    {
        public const string EditPermission = "Products.Edit";

        private readonly IProDataAccess _db;
        private readonly IConfiguration _config;
        private readonly ILogger<ProductSheetController> _log;

        public ProductSheetController(IProDataAccess db, IConfiguration config, ILogger<ProductSheetController> log)
        {
            _db = db;
            _config = config;
            _log = log;
        }

        private bool SqlIsMaster => _config.GetValue<bool>("Product:SqlIsMaster");
        private string Actor => Permissions.UserName(User);

        [HttpGet("{productId:int}/sheet")]
        public ActionResult<ProductSheetView> Get(int productId)
        {
            var fields = _db.ProductSheet_Get(productId, SqlIsMaster);
            if (fields.Count == 0) return NotFound(new { message = "That product doesn't exist." });

            var view = new ProductSheetView
            {
                Fields = fields,
                SqlIsMaster = SqlIsMaster,
                CanEdit = Permissions.HasAny(User, EditPermission, "/productedit", "/products"),
                History = _db.ProductSheet_History(productId)
            };

            var code = fields.FirstOrDefault(f => string.Equals(f.ColumnName, "ProductCode", StringComparison.OrdinalIgnoreCase))?.Value?.Trim();
            if (!string.IsNullOrEmpty(code))
            {
                try { view.TechSpecs = _db.Product_TechSpecs(code); }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Tech specs read failed for {ProductCode}", code);
                    view.TechSpecsError = "Couldn't read the B2B tech specs.";
                }
            }
            return Ok(view);
        }

        [HttpPut("{productId:int}/sheet")]
        [RequirePermission(EditPermission, "/productedit", "/products")]
        public IActionResult Save(int productId, [FromBody] ProductSheetSaveRequest request)
        {
            var changes = request?.Changes?.Where(c => !string.IsNullOrWhiteSpace(c.Column)).ToList();
            if (changes == null || changes.Count == 0) return Ok(new { saved = 0 });

            var json = JsonSerializer.Serialize(changes.Select(c => new { column = c.Column.Trim(), value = c.Value }));
            try
            {
                var saved = _db.ProductSheet_Save(productId, json, Actor, SqlIsMaster);
                return Ok(new { saved });
            }
            catch (SqlException ex) when (ex.Number >= 50460 && ex.Number < 50470)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("sheet/layout")]
        public ActionResult<ProductSheetLayout> GetLayout() => new ProductSheetLayout { ViewJson = _db.ProductSheet_ViewGet(Actor) };

        [HttpPut("sheet/layout")]
        public IActionResult SetLayout([FromBody] ProductSheetLayout layout)
        {
            if (string.IsNullOrWhiteSpace(layout?.ViewJson) || layout.ViewJson.Length > 100_000)
                return BadRequest(new { message = "The layout is empty or too large." });
            try { JsonDocument.Parse(layout.ViewJson).Dispose(); }
            catch (JsonException) { return BadRequest(new { message = "The layout isn't valid JSON." }); }
            _db.ProductSheet_ViewSet(Actor, layout.ViewJson);
            return NoContent();
        }
    }
}
