using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using System.Data;
using System.Data.SqlClient;


namespace ProInternal.Services
{
    public abstract class BaseDataAccess
    {
        protected readonly IConfiguration _config;
        protected readonly AwsSecretHelper _helper;
        protected readonly string _connName;

        private string _connectionString;

        protected BaseDataAccess(IConfiguration config, AwsSecretHelper helper, string connName)
        {
            _config = config;
            _helper = helper;
            _connName = connName;

            _connectionString = BuildConnectionString();
        }

        private string BuildConnectionString(bool forceRefresh = false)
        {
            var baseConn = _config.GetConnectionString(_connName);

            return _helper
                .GetConnectionString(baseConn, forceRefresh)
                .GetAwaiter()
                .GetResult();
        }

        protected SqlConnection GetConnection()
        {
            try
            {
                var conn = new SqlConnection(_connectionString);
                conn.Open();
                return conn;
            }
            catch (SqlException ex) when (ex.Number == 18456)
            {
                // 🔥 rotation happened

                _connectionString = BuildConnectionString(true);

                SqlConnection.ClearAllPools();

                var conn = new SqlConnection(_connectionString);
                conn.Open();
                return conn;
            }
        }
    }
}
