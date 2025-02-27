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
    }
}