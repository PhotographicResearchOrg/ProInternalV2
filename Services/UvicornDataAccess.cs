using Microsoft.Extensions.Logging;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services
{
    public class UvicornDataAccess : IUvicornDataAccess
    {
        private readonly HttpClient _http;
        private readonly ILogger<UvicornDataAccess> _logger;

        // This HttpClient is the one you registered in Program.cs (typed client).
        public UvicornDataAccess(HttpClient http, ILogger<UvicornDataAccess> logger)
        {
            _http = http;
            _logger = logger;
        }
        public Task<HttpResponseMessage> ProcessBatchAsync(CancellationToken ct)
        {
            // Calls: http://10.0.1.216:8000/api/invoices/process-batch
            return _http.GetAsync("api/invoices/process-batch", ct);
        }
        public Task<HttpResponseMessage> ProcessInvoiceAsync(string invoiceNumber, CancellationToken ct)
        {
            var q = WebUtility.UrlEncode(invoiceNumber);
            return _http.GetAsync($"api/invoices/process?invoice_number={q}", ct);
        }
        public Task<HttpResponseMessage> ManualsSyncAsync(string? emails, CancellationToken ct)
        {
            var url = "api/manuals/sync";

            if (!string.IsNullOrWhiteSpace(emails))
            {
                var encoded = WebUtility.UrlEncode(emails);
                url += $"?emails={encoded}";
            }

            return _http.GetAsync(url, ct);
        }

        public Task<HttpResponseMessage> SyncShopifyOldAsync(CancellationToken ct)
        {
            return _http.GetAsync("api/shopify-sync", ct);
        }

        public Task<HttpResponseMessage> SyncShopifyNewAsync(CancellationToken ct)
        {
            return _http.GetAsync("api/shopify-newproducts", ct);
        }

        public Task<HttpResponseMessage> PoSyncAsync(CancellationToken ct)          // NEW
       => _http.GetAsync("api/po-sync", ct);

    }
}
