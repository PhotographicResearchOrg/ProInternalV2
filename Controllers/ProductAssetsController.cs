#nullable disable
using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Linq;
using ProInternal.Models.Products;
using ProInternal.Services;

namespace ProInternal.Controllers
{
    /*
     * Product Desk · Shopify & assets (read only).
     *
     *   GET api/products/{id}/assets
     *
     * Shopify: every ProductData column about Shopify (ShopifyProdID, ShopifyVariantID, ...) and the
     * product's dbo.productlastchanged feed (what was sent to Shopify, when, and Shopify's answer).
     * Assets: dbo.ProductImage with the sizes FolderScan found, dbo.UploadFile documents, video and
     * asset columns on ProductData, and the S3 files Connection lists (GetProductFiles).
     *
     * appsettings (all optional):
     *   "Assets":  { "ImageBaseUrl": "http://images.promaster.com/",       (what the Connection site uses)
     *                "FilesBaseUrl": "https://<members site>/" }            (turns UploadFile paths into links)
     *   "Shopify": { "AdminProductUrl": "https://admin.shopify.com/store/<store>/products/{id}" }
     */
    [Authorize]
    [ApiController]
    [Route("api/products")]
    public sealed class ProductAssetsController : ControllerBase
    {
        /* Where FolderScan writes UploadFile.FileLocation; replaced by Assets:FilesBaseUrl to make a link. */
        private const string MembersSiteRoot = @"D:\inetpub\wwwroot\PromasterMembers\";

        private readonly IProDataAccess _db;
        private readonly IConfiguration _config;
        private readonly ILogger<ProductAssetsController> _log;

        public ProductAssetsController(IProDataAccess db, IConfiguration config, ILogger<ProductAssetsController> log)
        {
            _db = db;
            _config = config;
            _log = log;
        }

        [HttpGet("{productId:int}/assets")]
        public ActionResult<ProductAssetsView> Get(int productId)
        {
            var view = _db.Product_Assets(productId);
            if (view == null) return NotFound(new { message = "That product doesn't exist." });

            view.ImageBaseUrl = _config["Assets:ImageBaseUrl"] ?? "http://images.promaster.com/";
            view.FilesBaseUrl = _config["Assets:FilesBaseUrl"];
            view.ShopifyAdminProductUrl = _config["Shopify:AdminProductUrl"];

            try
            {
                view.Files = _db.Product_S3Files(view.ProductCode);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "GetProductFiles failed for {ProductCode}", view.ProductCode);
                view.FilesError = "Couldn't list the S3 files (GetProductFiles).";
            }

            /* Shopify governance issues and taxonomy audit (the Marketing screens' procedures), for this product */
            if (long.TryParse(view.ProductCode, out var code))
            {
                try
                {
                    view.ShopifyIssues = _db.GetShopifyGovernanceIssues()?.Where(i => i.ProductCode == code).ToList() ?? new();
                    view.ShopifyTaxonomy = _db.GetShopifyTaxonomyAudit()?.Where(t => t.ProductCode == code).ToList() ?? new();
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Shopify governance/taxonomy read failed for {ProductCode}", view.ProductCode);
                    view.ShopifyError = "Couldn't read the Shopify governance issues or taxonomy audit.";
                }
            }

            var filesBase = view.FilesBaseUrl?.TrimEnd('/');
            foreach (var d in view.Documents)
            {
                if (string.IsNullOrWhiteSpace(filesBase) || string.IsNullOrWhiteSpace(d.FileLocation)) continue;
                var location = d.FileLocation.Trim();
                if (!location.StartsWith(MembersSiteRoot, StringComparison.OrdinalIgnoreCase)) continue;
                var segments = location.Substring(MembersSiteRoot.Length).Split('\\', StringSplitOptions.RemoveEmptyEntries);
                d.Link = $"{filesBase}/{string.Join("/", Array.ConvertAll(segments, Uri.EscapeDataString))}/{Uri.EscapeDataString(d.FileName ?? "")}";
            }

            return Ok(view);
        }
    }
}
