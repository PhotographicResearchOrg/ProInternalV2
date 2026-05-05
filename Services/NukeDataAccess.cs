using Dapper;
using Microsoft.AspNetCore.Mvc;
using ProInternal.Helpers;
using ProInternal.Models.Dashboard;
using ProInternal.Models.InstantRebates;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;


namespace ProInternal.Services
{

    public class NukeDataAccess : BaseDataAccess, INukeDataAccess
    {
        public NukeDataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config, helper, "NukeConnectionString")
        {
        }





        public int? GetDispositionModelId(string modelName)
        {
            using (IDbConnection connection = GetConnection())
            {
                return connection.QueryFirstOrDefault<int?>(
                    "PIV2GetDispositionModelId",
                    new { ModelName = modelName },
                    commandType: CommandType.StoredProcedure
                );
            }
        }

        public string? GetStackForModel(int modelId)
        {
            using (IDbConnection connection = GetConnection())
            {
                // Returns the aggregated stack string (or null if none)
                var stack = connection.QueryFirstOrDefault<string?>(
                    "PIV2GetStackForModel",
                    new { DispositionModelID = modelId },
                    commandType: CommandType.StoredProcedure
                );
                return string.IsNullOrWhiteSpace(stack) ? null : stack;
            }
        }

        public int UpdatePreviewProposedName(int previewId, string proposed)
        {
            using (IDbConnection connection = GetConnection())
            {
                var rows = connection.Execute(
                    "PIV2UpdateRebateIRPreviewProposedName",
                    new { PreviewId = previewId, ProposedModelName = proposed },
                    commandType: CommandType.StoredProcedure
                );
                return rows; // 1 on success
            }
        }



        public int InsertRebatePreviewRow(RebateIRRowDto row, DateTime expireDate)
        {
            using (IDbConnection connection = GetConnection())
            {
                var previewId = connection.QuerySingle<int>(
                    "PIV2InsertRebateIRPreviewRow",
                    new
                    {
                        // Legacy-visible columns
                        VendorBrand = row.VendorBrand,
                        ProductDescription = row.ProductDescription ?? row.ModelName,
                        ProCodePrimary = row.ProCodePrimary ?? row.ProductCode,
                        InstantRebate = row.InstantRebate,
                        MemberReimbursement = row.MemberReimbursement,
                        MAP = row.MAP,
                        StartDate = row.StartDate,
                        EndDate = row.EndDate,
                        StackProduct = row.StackProduct,
                        RebateType = row.RebateType,
                        Notes = row.Notes,
                        Stack = row.Stack,
                        DispositionModelID = row.DispositionModelID,
                        ProposedModelName = row.ProposedModelName,

                        // Compat / extra
                        ProductCode = row.ProductCode,
                        ModelName = row.ModelName,
                        IRDescription = row.IRDescription,

                        // Required
                        ExpireDate = expireDate
                    },
                    commandType: CommandType.StoredProcedure
                );

                return previewId;
            }
        }



        public CommitResult CommitRebateIRPreviewRows(CommitRequest req, string? committedBy = null)
        {
            using var conn =  GetConnection(); 
            conn.Open();
            using var tx = conn.BeginTransaction();

            var results = conn.Query<CommitRowResult>(
                "PIV2CommitRebateIRPreviewRows",
                new
                {
                    PreviewIdsCsv = string.Join(",", req.PreviewIds.Distinct()),
                    DryRun = req.DryRun,
                    Overwrite = req.OverwriteDuplicates,
                    MarkCommitted = !req.DryRun,                 // <-- tell SP to update rows only on real commit
                    CommittedBy = committedBy ?? "Web"         // <-- who did it
                },
                commandType: CommandType.StoredProcedure,
                transaction: tx
            ).ToList();

            if (!req.DryRun)
                tx.Commit();  // SP will have updated the rows inside the same tx

            // Tally results (handles “Simulated-*” too)
            int inserted = 0, updated = 0, skipped = 0, errors = 0;
            foreach (var r in results)
            {
                var s = (r.Status ?? "").ToLowerInvariant();
                if (s.StartsWith("error")) errors++;
                else if (s.Contains("update")) updated++;
                else if (s.StartsWith("skipped")) skipped++;
                else if (s.Contains("insert")) inserted++;
                else skipped++;
            }

            return new CommitResult
            {
                Inserted = inserted,
                Updated = updated,
                Skipped = skipped,
                Errors = errors,
                Rows = results
            };
        }





        #region Metrics 

        public IRMetrics GetIRMetrics()
        {


            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<IRMetrics>("InternalIRMetrics").FirstOrDefault();

                return output;
            }
        }


        #endregion

        public   List<IR> GetInstantRebateBatches()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<IR>("GetInstantRebateBatches").ToList();
                return output;
            }

        }

        public List<DeclinedIR> GetDeclinedInstantRebates()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<DeclinedIR>("GetIRDeclines").ToList();
                return output;
            }
        }

        public void ResubmitOrderToQueue(int orderId)
        {
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute("ResubmitRebateOrder",
                    new { orderId = orderId },
                    commandType: CommandType.StoredProcedure);
            }
        }


        public void ConfirmDecline(int orderId)
        {
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute("ConfirmDecline",
                    new { orderId = orderId },
                    commandType: CommandType.StoredProcedure);
            }
        }





        public IRBatchExport getIRBatchDetail(int batchID)
        {
            using (IDbConnection connection = GetConnection())
            {
                using (var output = connection.QueryMultiple("getIRBatchDetail @batchID", new { batchID }, commandType: CommandType.Text))
                {
                    var summary = output.Read<IR>().ToList();
                    var detail = output.Read<IRBatchDetail>().ToList();

                    return new IRBatchExport
                    {
                        Summary = summary,
                        Detail = detail
                    };
                }
            }
        }



        public bool activateIRBatch(int batchID)
        {
            using (IDbConnection connection = GetConnection())
            {
                bool status = true;
                try
                {
                    connection.Execute("activateIRBatch @batchID", new { batchID = batchID });
                }
                catch { status = false; }
                finally { }
                return status;
            }
        }




        public List<ParentIRCompany> GetAllParentIRCompanies()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<ParentIRCompany>("GetAllParentIRCompanies").ToList();
                return output;
            }
        }

        public int AddParentIRCompany(string name, string imageUrl)
        {
            using (IDbConnection connection = GetConnection())
            {

                var parameters = new DynamicParameters();
                parameters.Add("@Name", name);
                parameters.Add("@ImageUrl", imageUrl);
                parameters.Add("@NewId", dbType: DbType.Int32, direction: ParameterDirection.Output);

                connection.Execute("AddParentIRCompany", parameters, commandType: CommandType.StoredProcedure);

                return parameters.Get<int>("@NewId");
            }
        }



        public void DeleteRebateProofFile(int orderId, string filename)
        {
            using (IDbConnection connection = GetConnection())
            {
                var parameters = new DynamicParameters();
                parameters.Add("@OrderId", orderId);
                parameters.Add("@FileName", filename);

                connection.Execute("DeleteRebateProofFile", parameters, commandType: CommandType.StoredProcedure);
            }

         }

        public void InsertAdditionalFile(int orderId, string filename)
        {
            var p = new DynamicParameters();
            p.Add("@OrderId", orderId);
            p.Add("@FileName", filename);
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute("InsertRebateAdditionalFile", p, commandType: CommandType.StoredProcedure);
            }
        }
        public void MarkAsHasAdditionalFiles(int orderId)
        {
            var p = new DynamicParameters();
            p.Add("@OrderId", orderId);
  
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute("MarkAsHasAdditionalFiles", p, commandType: CommandType.StoredProcedure);
            }
        }



        public void UpdateParentIRCompany(int id, string name, string imageUrl)
        {
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute("UpdateParentIRCompany", new { ID = id, Name = name, ImageUrl = imageUrl }, commandType: CommandType.StoredProcedure);
            }
        }

        public IEnumerable<RebateVendor> GetAllRebateVendors()
        {
            using (IDbConnection connection = GetConnection())
            {
                return connection.Query<RebateVendor>("GetAllRebateVendors", commandType: CommandType.StoredProcedure);
            }
        }

        public void DeleteParentIRCompany(int id)
        {
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute("DeleteParentIRCompany", new { ID = id }, commandType: CommandType.StoredProcedure);
            }
        }

        public int AddRebateVendor(RebateVendor vendor)
        {
            using (IDbConnection connection = GetConnection())
            {
                return connection.QuerySingle<int>("InsertRebateVendor", new
                {
                    vendor.VendorName,
                    vendor.Active,
                    IsPriceProtection = vendor.IsPriceProtection,
                    ImageUrl = vendor.ImageUrl,
                    ParentCompany = vendor.ParentCompany,
                    vendor.Apmstid,
                    ParentCompanyId = vendor.ParentCompanyId
                }, commandType: CommandType.StoredProcedure);
            }
        }


        public void UpdateRebateVendor(int Id,RebateVendor vendor)
        {
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute("UpdateRebateVendor", new
                {
                    vendor.Id,
                    vendor.VendorName,
                    vendor.Active,
                    IsPriceProtection = vendor.IsPriceProtection,
                    ImageUrl = vendor.ImageUrl,
                    ParentCompany = vendor.ParentCompany,
                    vendor.Apmstid,
                    ParentCompanyId = vendor.ParentCompanyId
                }, commandType: CommandType.StoredProcedure);
            }
        }


        public void DeleteRebateVendor(int id)
        {
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute("DeleteRebateVendor", new { ID = id }, commandType: CommandType.StoredProcedure);
            }
        }












    }
}