using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProInternal.Services;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{

    [Route("api/[controller]")]
    [ApiController]
    public class UvicornController : ControllerBase
    {
        private readonly IUvicornDataAccess _dal;
        private readonly ILogger<UvicornController> _logger;

        public UvicornController(IUvicornDataAccess dal, ILogger<UvicornController> logger)
        {
            _dal = dal;
            _logger = logger;
        }

        [HttpGet("process-batch")]
        public async Task<IActionResult> ProcessBatch(CancellationToken ct)
        {
            var resp = await _dal.ProcessBatchAsync(ct);
            var contentType = resp.Content.Headers.ContentType?.ToString() ?? "application/json";
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Uvicorn batch failed: {Status} {Body}", resp.StatusCode, body);

            return new ContentResult
            {
                StatusCode = (int)resp.StatusCode,
                ContentType = contentType,
                Content = body
            };
        }




        [HttpGet("po-sync")]                                                    
        public async Task<IActionResult> PoSync(CancellationToken ct)
        {
            var resp = await _dal.PoSyncAsync(ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("PO Sync failed: {Status} {Body}", resp.StatusCode, body);

            return new ContentResult
            {
                StatusCode = (int)resp.StatusCode,
                ContentType = resp.Content.Headers.ContentType?.ToString() ?? "application/json",
                Content = body
            };
        }


        [HttpGet("manuals")]
        public async Task<IActionResult> ManualsSync([FromQuery] string? emails, CancellationToken ct)
        {
            var resp = await _dal.ManualsSyncAsync(emails, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Manuals Sync failed: {Status} {Body}", resp.StatusCode, body);

            return new ContentResult
            {
                StatusCode = (int)resp.StatusCode,
                ContentType = resp.Content.Headers.ContentType?.ToString() ?? "application/json",
                Content = body
            };
        }

        [HttpGet("process")]
        public async Task<IActionResult> Process([FromQuery(Name = "invoice_number")] string invoiceNumber, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(invoiceNumber))
                return BadRequest(new { message = "invoice_number is required" });

            var resp = await _dal.ProcessInvoiceAsync(invoiceNumber, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Uvicorn single-invoice failed: {Status} {Body}", resp.StatusCode, body);

            return new ContentResult
            {
                StatusCode = (int)resp.StatusCode,
                ContentType = resp.Content.Headers.ContentType?.ToString() ?? "application/json",
                Content = body
            };
        }


        [HttpGet("shopify-sync")]
        public async Task<IActionResult> ShopifySync(CancellationToken ct)
        {
            var resp = await _dal.SyncShopifyOldAsync(ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Shopify legacy sync failed: {Status} {Body}", resp.StatusCode, body);

            return new ContentResult
            {
                StatusCode = (int)resp.StatusCode,
                ContentType = resp.Content.Headers.ContentType?.ToString() ?? "application/json",
                Content = body
            };
        }

        [HttpGet("shopify-newproducts")]
        public async Task<IActionResult> ShopifyNewProducts(CancellationToken ct)
        {
            var resp = await _dal.SyncShopifyNewAsync(ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Shopify new product sync failed: {Status} {Body}", resp.StatusCode, body);

            return new ContentResult
            {
                StatusCode = (int)resp.StatusCode,
                ContentType = resp.Content.Headers.ContentType?.ToString() ?? "application/json",
                Content = body
            };
        }





    }
}