using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.InstantRebates ;
using System;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
using Microsoft.AspNetCore.Mvc;

namespace ProInternal.Services
{
    public interface INukeDataAccess
    {
        IRMetrics GetIRMetrics();
        List<IR> GetInstantRebateBatches();
        bool activateIRBatch(int batchID);
        IRBatchExport getIRBatchDetail(int batchID);

        void ConfirmDecline(int OrderId);
        void ResubmitOrderToQueue(int orderId);

        void InsertAdditionalFile(int orderId, string filename);

        void MarkAsHasAdditionalFiles(int orderId);
        void DeleteRebateProofFile(int orderId, string filename);
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

        CommitResult CommitRebateIRPreviewRows(CommitRequest req, string? committedBy = null);

        int  UpdatePreviewProposedName(int previewId, string proposed);

        public int? GetDispositionModelId(string modelName);

        int InsertRebatePreviewRow(RebateIRRowDto row, DateTime expireDate);

        public string GetStackForModel(int modelId);



    }

}
