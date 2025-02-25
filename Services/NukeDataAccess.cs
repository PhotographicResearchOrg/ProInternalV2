using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using ProInternal.Models.Dashboard;

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
            using (IDbConnection connection = new System.Data.SqlClient.SqlConnection(_connectionString))
            {
                var output = connection.Query<IRMetrics>("InternalIRMetrics").FirstOrDefault();

                return output;
            }
        }


        #endregion



    }
}