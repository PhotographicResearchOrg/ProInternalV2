#nullable disable
using System;
using System.Collections.Generic;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers.Security;
using ProInternal.Models.CategoryDesk;
using ProInternal.Services;

namespace ProInternal.Controllers
{
    /*
     * Category Desk: the product category tree the B2B WH page shows, product placement,
     * Uncategorized and Suspect queues, publish, history and revert.
     *
     * Permissions (Security Admin):
     *   Categories.View   route /categories: read everything, export
     *   Categories.Edit   publish and revert (also what the Product Desk needs to change a product's category)
     * The Product Desk routes (/products, /productedit) can read the tree, so its category picker works.
     *
     * Product:SqlIsMaster (appsettings, absent = false) is the same switch the Product Desk reads.
     * False: the top level (Computyme EGRP) is locked, and products stay inside their EGRP branch.
     *
     * Every rule is in the piv2.CategoryDesk_* procedures; a refusal (50480-50499) comes back as 400 with its message.
     */
    [ApiController]
    [Route("api/categorydesk")]
    public sealed class CategoryDeskController : ControllerBase
    {
        public const string ViewPermission = "Categories.View";
        public const string EditPermission = "Categories.Edit";
        public const string ScreenRoute = "/categories";
        public const string ProductDeskRoute = "/products";
        public const string ProductEditRoute = "/productedit";

        private readonly IProDataAccess _db;
        private readonly IConfiguration _configuration;

        public CategoryDeskController(IProDataAccess db, IConfiguration configuration)
        {
            _db = db;
            _configuration = configuration;
        }

        private bool SqlIsMaster => _configuration.GetValue<bool>("Product:SqlIsMaster");
        private string Actor => Permissions.UserName(User);

        private IActionResult Run<T>(Func<T> action)
        {
            try { return Ok(action()); }
            catch (SqlException ex) when (ex.Number >= 50480 && ex.Number < 50500)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ------------------------------------------------------------ read

        [HttpGet("tree")]
        [RequirePermission(ViewPermission, EditPermission, ScreenRoute, ProductDeskRoute, ProductEditRoute)]
        public ActionResult<CategoryTree> Tree()
        {
            var tree = _db.CategoryDesk_Tree(SqlIsMaster);
            tree.CanEdit = Permissions.HasAny(User, EditPermission);
            return tree;
        }

        [HttpGet("products")]
        [RequirePermission(ViewPermission, EditPermission, ScreenRoute)]
        public ActionResult<CategoryProductPage> Products([FromQuery] CategoryProductQuery query) =>
            _db.CategoryDesk_Products(query ?? new CategoryProductQuery());

        [HttpGet("filters")]
        [RequirePermission(ViewPermission, EditPermission, ScreenRoute)]
        public ActionResult<CategoryFilters> Filters() => _db.CategoryDesk_Filters();

        [HttpGet("history")]
        [RequirePermission(ViewPermission, EditPermission, ScreenRoute)]
        public ActionResult<List<PublishSummary>> History() => _db.CategoryDesk_History();

        [HttpGet("history/{publishId:int}")]
        [RequirePermission(ViewPermission, EditPermission, ScreenRoute)]
        public ActionResult<List<PublishItem>> PublishDetail(int publishId) => _db.CategoryDesk_PublishDetail(publishId);

        [HttpGet("history/{publishId:int}/revert-check")]
        [RequirePermission(ViewPermission, EditPermission, ScreenRoute)]
        public ActionResult<List<RevertConflict>> RevertCheck(int publishId) => _db.CategoryDesk_RevertCheck(publishId);

        // ------------------------------------------------------------ change

        [HttpPost("publish")]
        [RequirePermission(EditPermission)]
        public IActionResult Publish([FromBody] PublishRequest request)
        {
            if (request == null || request.Changes.ValueKind != JsonValueKind.Object)
                return BadRequest(new { message = "There is nothing to publish." });

            return Run(() => _db.CategoryDesk_Publish(
                request.Changes.GetRawText(), request.Comment, request.BaseVersion, SqlIsMaster, Actor));
        }

        [HttpPost("history/{publishId:int}/revert")]
        [RequirePermission(EditPermission)]
        public IActionResult Revert(int publishId, [FromBody] RevertRequest request) =>
            Run(() => _db.CategoryDesk_Revert(publishId, request?.SkipConflicts ?? true, SqlIsMaster, Actor));
    }
}
