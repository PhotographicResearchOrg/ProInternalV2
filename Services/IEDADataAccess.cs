using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.EzPaySummary;
using ProInternal.Models.InstantRebates ;
using ProInternal.Models.Vendor;
using ProInternal.Models.WH;
using System;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;


namespace ProInternal.Services
{
    public interface IEDADataAccess
    {

        void RetireShipment(string tracking);
        void SetCreditEmailFlag(string invoiceNumber, bool include);
        void SaveSubscription(ShipmentSubscription sub);
        IEnumerable<ShipmentSubscription> GetSubscriptions(int userId);

        IEnumerable<ShipmentEventRecord> GetShipmentEvents(string trackingNumber);

        IEnumerable<ShipmentRecord> GetShipments();

        Task<PackingSlipData> GetPackingSlipData(int shippingErrorId);
        List<PanaRep> GetAllPanaReps();
        List<PanaAccount> GetAllPanaAccounts();

        Task<PanaRep> SavePanaRep(PanaRep rep);
        Task<PanaAccount> SavePanaAccount(PanaAccount account);
        Task<bool> DeletePanaRep(int id);
        Task<bool> DeletePanaAccount(string meca);
        Task<IEnumerable<EzPaySummary>> GetEzPaySummary(DateTime daDate);
        Task<IEnumerable<EzPayDetail>> GetEzPayDetail(DateTime daDate);
    }

}
