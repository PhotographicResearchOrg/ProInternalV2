using ProInternal.Models.Accounting;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Auth;
using ProInternal.Models.Accounts;
using ProInternal.Models.Products;
using Microsoft.AspNetCore.Identity;
using ProInternal.Helpers;
using Microsoft.Data.SqlClient;


namespace ProInternal.Services
{
    public class ProDataAccess : IProDataAccess
    {
        private string _connectionString { get; set; }
        public ProDataAccess(string connectionString)
        {
            _connectionString = connectionString;
        }

        #region QuarterlyRebates

        public List<QuarterlyRebate> GetQuarterRebateSummary()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<QuarterlyRebate>("StolenGoods_Get_Flat").ToList();
                return output;
            }
        }

        #endregion

        public List<QuarterlyDataSummary> getCurrentQuarterlyData()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<QuarterlyDataSummary>("QuarterlyGetRecentFileUpload").ToList();
                return output;
            }
        }


        public List<QuarterlyDataHistorical> getHistoricalQRData()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<QuarterlyDataHistorical>("GetQRHistorical").ToList();
                return output;
            }
        }

        public List<qrDetail> getQRBatchDetail(int batchID)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<qrDetail>("PullQRBatch @batchID", new { batchID = batchID }).ToList();
                return output;
            }
        }

        public List<qrDetail> getQRBatchVendorDetail(string StringBatchID)
        {

            string[] values = StringBatchID.Split(',');

            int IntbatchID = Convert.ToInt32(values[0]);
            int IntprogramID = Convert.ToInt32(values[1]);


            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<qrDetail>("PullQRVendorBatch @batchID, @programID", new { batchID = IntbatchID, programID = IntprogramID }).ToList();
                return output;
            }
        }
        


        public bool deleteQRUpload(int batchID)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                bool status = true;
                try
                {
                    connection.Execute("deleteBatch @batchID", new { batchID = batchID });                    
                }
                catch { status = false; }
                finally { }
                return status;
            }
        }


        public bool activate(int batchID)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                bool status = true;
                try
                {
                    connection.Execute("activateBatch @batchID", new { batchID = batchID });
                }
                catch { status = false; }
                finally { }
                return status;
            }
        }

       


        public QuarterlyRebates saveData(QuarterlyRebates data )
        {
            //ListtoDataTableConverter converter = new ListtoDataTableConverter();
            //DataTable Headers = converter.ToDataTable(data.ProgramList);


            DataTable Headers = new DataTable();

            Headers.Columns.Add(new DataColumn("ProgramName", typeof(string)));        
            foreach (var program in data.ProgramList)
            {
                DataRow row = Headers.NewRow();
                row["ProgramName"] = program.ToString();
                Headers.Rows.Add(row);
            }


            DataTable dt = new DataTable();
            dt = data.FileData;
            //Get quanitity of cols 
            int columns = dt.Columns.Count;
            int remainingCols = 0;
            remainingCols = 10 - columns;

            for (int i = 1; i <= remainingCols; i++)
            {
                dt.Columns.Add("Holder" + i.ToString() );            
            }


            //ProgramName
            //QuarterlyFileData

            var p = new DynamicParameters();
            p.Add("@QuarterlyFileData", data.FileData.AsTableValuedParameter("QuarterlyFileData"));
            p.Add("@Programs", Headers.AsTableValuedParameter("Programs"));

            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                try
                {
                    var output = connection.Query<string>("QuarterlyLoadFile", p, commandType: CommandType.StoredProcedure).FirstOrDefault();
                }
                catch(Exception e) { }
                finally { }
                QuarterlyRebates c = new QuarterlyRebates();
                return c;               
            }     
        }



        #region Metrics 

        public OrdersMetrics GetOrdersMetrics()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<OrdersMetrics>("InternalOrdersMetrics").FirstOrDefault(); 

                return output;
            }
        }

        public EDIMetrics GetEDIMetrics()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<EDIMetrics>("InternalEDISMetrics").FirstOrDefault();

                return output;
            }
        }


        public ShippingErrorMetrics getShippingErrorMetrics()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<ShippingErrorMetrics>("InternalShippingErrorMetrics").FirstOrDefault();

                return output;
            }
        }


        public CommecntsMetrics getCommentsrMetrics()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<CommecntsMetrics>("InternalCommentsMetrics").FirstOrDefault();
                return output;
            }
        }


        #endregion



        //InternalMapViolation
        //ProductMapViolation


        public List<Account> getAccounts()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<Account>("GetAccounts").ToList();

                return output;
            }
        }

        public List<Products> getProducts(string searchCriteria)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<Products>("InternalGetProducts", new {searchCriteria =  searchCriteria }).ToList();

                return output;
            }
        }
        


        public List<SpecialOrdersSummary> getOrdersSnapshot()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<SpecialOrdersSummary>("InternalOrdersSnapshot").ToList();

                return output;
            }
        }


        public User login(string username, string password)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.QueryMultiple("Auth_Login @username, @password", new { username = username, password = password });
                User user = null;
                try { user = output.Read<User>().FirstOrDefault(); }
                catch { }  
                return user;
            }
        }


    }
}
