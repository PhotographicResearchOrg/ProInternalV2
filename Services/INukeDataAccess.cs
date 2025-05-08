using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.InstantRebates ;
using System;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;

namespace ProInternal.Services
{
    public interface INukeDataAccess
    {
        IRMetrics GetIRMetrics();
        List<IR> GetInstantRebateBatches();
        bool activateIRBatch(int batchID);
        List<IR> getIRBatchDetail(int batchID);

        List<DeclinedIR> GetDeclinedInstantRebates();

        IEnumerable<RebateVendor> GetAllRebateVendors();

        // Returns all parent IR companies
        List<ParentIRCompany> GetAllParentIRCompanies();

        // Adds a new parent IR company
        int AddParentIRCompany(string name, string imageUrl);

        // Updates a parent IR company by ID
        void UpdateParentIRCompany(int id, string name,  string ImageUrl);

        // Deletes a parent IR company by ID
        void DeleteParentIRCompany(int id);



        // REBATE VENDOR MANAGEMENT
        int AddRebateVendor(RebateVendor vendor);

        void UpdateRebateVendor(int id, RebateVendor vendor);

        void DeleteRebateVendor(int id);





    }

}
