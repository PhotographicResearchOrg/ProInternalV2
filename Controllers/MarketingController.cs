using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Playwright;
using Microsoft.VisualBasic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PdfSharp.Snippets.Drawing;
using ProInternal.Models.Marketing ;
using ProInternal.Models.Accounts;
using ProInternal.Models.Auth;
using ProInternal.Models.Dashboard;
using ProInternal.Models.EzPaySummary;
using ProInternal.Models.InvoiceRecord;
using ProInternal.Models.Outstanding;
using ProInternal.Models.Patronage;
using ProInternal.Models.SendInvoicesRequest;
using ProInternal.Services;
using Spire.Pdf;
using Spire.Xls;
using System.Data;
using System.Drawing;
using System.Globalization;
using System.IO.Pipelines;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.RegularExpressions;


namespace ProInternal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MarketingController : ControllerBase
    {
        private IProDataAccess _proDataAccess;
        private IDRADataAccess _dradataAccess;
        private IEDADataAccess _edadataAccess;
        private IInvoiceExtractionService _invoiceExtractionService;

        public MarketingController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, IEDADataAccess edadataAccess, IInvoiceExtractionService invoiceExtractionService) 
        {
            _proDataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _edadataAccess = edadataAccess;
            _invoiceExtractionService = invoiceExtractionService;

        }


        [HttpGet("shopify-governance")]
        public IActionResult GetShopifyGovernance()
        {
            return Ok(
                _proDataAccess.GetShopifyGovernanceIssues()
            );
        }


        [HttpPost("shopify-governance-resolve")]
        public IActionResult ResolveGovernanceIssue(
    [FromBody] int id)
        {
            _proDataAccess.ResolveGovernanceIssue(id);

            return Ok();
        }


        [HttpGet("shopify-taxonomy-audit")]
        public IActionResult GetShopifyTaxonomyAudit()
        {
            return Ok(_proDataAccess.GetShopifyTaxonomyAudit());
        }


        [HttpPost("shopify-taxonomy-review")]
        public IActionResult ShopifyTaxonomyReview(
        [FromBody] ShopifyTaxonomyReviewRequest request)
        {
            _proDataAccess.ShopifyTaxonomyReview(
                request.Id,
                request.Disposition
            );

            return Ok();
        }



    }
}
