using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using ProInternal.Models.Dashboard;
using ProInternal.Models.InstantRebates;


namespace ProInternal.Services
{
    public class NukeDataAccess : INukeDataAccess
    {

        private string _connectionString { get; set; }

        public NukeDataAccess(string connectionString)
        {
            _connectionString = connectionString;
        }




        #region Metrics 

        public IRMetrics GetIRMetrics()
        {


            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {
                var output = connection.Query<IRMetrics>("InternalIRMetrics").FirstOrDefault();

                return output;
            }
        }


        #endregion

        public   List<IR> GetInstantRebateBatches()
        {
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {
                var output = connection.Query<IR>("GetInstantRebateBatches").ToList();
                return output;
            }

        }

        public List<DeclinedIR> GetDeclinedInstantRebates()
        {
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {
                var output = connection.Query<DeclinedIR>("GetIRDeclines").ToList();
                return output;
            }

        }


        public List<IR> getIRBatchDetail(int batchID)
        {
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {
                var output = connection.Query<IR>("getIRBatchDetail @batchID", new { batchID = batchID }).ToList();
                return output;
            }
        }


        public bool activateIRBatch(int batchID)
        {
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
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
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {
                var output = connection.Query<ParentIRCompany>("GetAllParentIRCompanies").ToList();
                return output;
            }
        }

        public int AddParentIRCompany(string name, string imageUrl)
        {
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {

                var parameters = new DynamicParameters();
                parameters.Add("@Name", name);
                parameters.Add("@ImageUrl", imageUrl);
                parameters.Add("@NewId", dbType: DbType.Int32, direction: ParameterDirection.Output);

                connection.Execute("AddParentIRCompany", parameters, commandType: CommandType.StoredProcedure);

                return parameters.Get<int>("@NewId");
            }
        }

        public void UpdateParentIRCompany(int id, string name, string imageUrl)
        {
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {
                connection.Execute("UpdateParentIRCompany", new { ID = id, Name = name, ImageUrl = imageUrl }, commandType: CommandType.StoredProcedure);
            }
        }

        public IEnumerable<RebateVendor> GetAllRebateVendors()
        {
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {
                return connection.Query<RebateVendor>("GetAllRebateVendors", commandType: CommandType.StoredProcedure);
            }
        }

        public void DeleteParentIRCompany(int id)
        {
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {
                connection.Execute("DeleteParentIRCompany", new { ID = id }, commandType: CommandType.StoredProcedure);
            }
        }

        public int AddRebateVendor(RebateVendor vendor)
        {
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
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
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
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
            using (IDbConnection connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString))
            {
                connection.Execute("DeleteRebateVendor", new { ID = id }, commandType: CommandType.StoredProcedure);
            }
        }












    }
}