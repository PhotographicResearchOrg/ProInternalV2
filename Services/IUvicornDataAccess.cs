using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.InstantRebates ;
using System;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
using ProInternal.Models.Vendor;
using ProInternal.Models.EzPaySummary;


namespace ProInternal.Services
{
    public interface IUvicornDataAccess
    {
        Task<HttpResponseMessage> ProcessBatchAsync(CancellationToken ct);
        Task<HttpResponseMessage> ProcessInvoiceAsync(string invoiceNumber, CancellationToken ct); // NEW
        Task<HttpResponseMessage> PoSyncAsync(CancellationToken ct);                // NEW
        Task<HttpResponseMessage> ManualsSyncAsync(string? emails, CancellationToken ct);

        Task<HttpResponseMessage> SyncShopifyOldAsync(CancellationToken ct);
        Task<HttpResponseMessage> SyncShopifyNewAsync(CancellationToken ct);
   
    }

}
