using Dapper;
using Microsoft.Data.SqlClient;
using ProInternal.Helpers;
using ProInternal.Models.Dashboard;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;

namespace ProInternal.Services
{
    public class DRADataAccess : BaseDataAccess, IDRADataAccess
    {
        public DRADataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config, helper, "DRAConnectionString")
        {
        }


        #region Metrics 

        public SARSMetrics GetSARSMetrics()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<SARSMetrics>("InternalSARSMetrics").FirstOrDefault();

                return output;
            }
        }

        #endregion


    }
}