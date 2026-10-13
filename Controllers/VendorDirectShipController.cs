using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Services;
using ProInternal.Services.OrderIntegration;
using ProInternal.Services.OrderIntegration.Adapters.Outbound.VendorDirect;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    /*
     * Direct vendor ship settings, for the vendor's own screen: how a
     * vendor's orders are delivered and costed, and which of its brands
     * ship everything direct. Sending orders is on the Order Toolbench.
     */
    [Authorize]
    [Route("api/vendor-direct-ship")]
    [ApiController]
    public class VendorDirectShipController : ControllerBase
    {
        private readonly IVendorDirectDataAccess _vendorDirect;
        private readonly OrderIntegrationService _orderIntegrationService;
        private readonly IConfiguration _configuration;

        public VendorDirectShipController(
            OrderIntegrationService orderIntegrationService,
            IConfiguration configuration,
            AwsSecretHelper secretHelper)
        {
            _orderIntegrationService = orderIntegrationService;
            _configuration = configuration;
            _vendorDirect = new VendorDirectDataAccess(configuration, secretHelper);
        }

        /* Changing how orders reach a vendor needs the same permission as changing an order. */
        private bool Denied()
        {
            return !User.IsAllowed(_configuration, OrderPermissions.Modify);
        }

        /* Every vendor, with its settings. Used to pick a vendor. */
        [HttpGet("vendors")]
        public async Task<ActionResult<IEnumerable<VendorDirectVendor>>> GetVendors(
            CancellationToken cancellationToken)
        {
            if (Denied())
                return Forbid();

            return Ok(await _vendorDirect.GetVendorDirectVendorsAsync(cancellationToken));
        }

        /* One vendor's settings and its brands. */
        [HttpGet("vendors/{vendorId:int}")]
        public async Task<ActionResult<VendorDirectShipPage>> GetVendor(
            int vendorId,
            CancellationToken cancellationToken)
        {
            if (Denied())
                return Forbid();

            var vendor = await _vendorDirect.GetVendorDirectVendorAsync(vendorId, cancellationToken);

            if (vendor is null)
                return NotFound("The vendor was not found.");

            var brands = await _vendorDirect.GetVendorDirectBrandsAsync(cancellationToken);

            return Ok(new VendorDirectShipPage
            {
                Vendor = vendor,
                Brands = brands.Where(brand => brand.VendorId == vendorId).ToList()
            });
        }

        [HttpPost("vendors/{vendorId:int}")]
        public async Task<ActionResult<VendorDirectResult>> SaveVendor(
            int vendorId,
            [FromBody] VendorDirectVendor vendor,
            CancellationToken cancellationToken)
        {
            if (Denied())
                return Forbid();

            vendor.VendorId = vendorId;

            var problem = OrderIntegrationService.CheckVendorSettings(vendor);

            if (problem is not null)
                return Ok(new VendorDirectResult(false, problem));

            var saved = await _vendorDirect.SaveVendorDirectVendorAsync(vendor, cancellationToken);

            return Ok(saved
                ? new VendorDirectResult(true, "Direct vendor ship settings saved.")
                : new VendorDirectResult(false, "The vendor was not found."));
        }

        /* Sends a marked test file the way this vendor's orders go. Uses the saved settings. */
        [HttpPost("vendors/{vendorId:int}/test")]
        public async Task<ActionResult<VendorDirectResult>> SendTest(
            int vendorId,
            CancellationToken cancellationToken)
        {
            if (Denied())
                return Forbid();

            return Ok(await _orderIntegrationService.SendVendorTestAsync(vendorId, cancellationToken));
        }

        /* Every brand, with the vendor it belongs to. */
        [HttpGet("brands")]
        public async Task<ActionResult<IEnumerable<VendorDirectBrand>>> GetBrands(
            CancellationToken cancellationToken)
        {
            if (Denied())
                return Forbid();

            return Ok(await _vendorDirect.GetVendorDirectBrandsAsync(cancellationToken));
        }

        /* Saves which vendor a brand belongs to, and whether all of it ships direct. */
        [HttpPost("brands/{brandId:int}")]
        public async Task<ActionResult<VendorDirectResult>> SaveBrand(
            int brandId,
            [FromBody] VendorDirectBrand brand,
            CancellationToken cancellationToken)
        {
            if (Denied())
                return Forbid();

            brand.BrandId = brandId;

            var saved = await _vendorDirect.SaveVendorDirectBrandAsync(brand, cancellationToken);

            return Ok(saved
                ? new VendorDirectResult(true, "Brand saved.")
                : new VendorDirectResult(false, "The brand or the vendor was not found."));
        }
    }

    public sealed class VendorDirectShipPage
    {
        public VendorDirectVendor Vendor { get; set; } = new();
        public List<VendorDirectBrand> Brands { get; set; } = new();
    }
}
