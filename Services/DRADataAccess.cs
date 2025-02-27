using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using ProInternal.Models.Dashboard;
using Microsoft.Data.SqlClient;

namespace ProInternal.Services
{
    public class DRADataAccess : IDRADataAccess
    {

        private string _connectionString { get; set; }

        public DRADataAccess(string connectionString)
        {
            _connectionString = connectionString;
        }



        #region Metrics 

        public SARSMetrics GetSARSMetrics()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<SARSMetrics>("InternalSARSMetrics").FirstOrDefault();

                return output;
            }
        }

        #endregion


    }
}