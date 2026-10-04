
using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;
using Newtonsoft.Json;
using System.Collections.Concurrent;


namespace ProInternal.Helpers
{
    public class AwsSecretHelper
    {
        private readonly IConfiguration _config;
        private readonly IAmazonSecretsManager _client;

        private readonly ConcurrentDictionary<string, string> _cache = new();
        private readonly ConcurrentDictionary<string, DateTime> _cacheTime = new();

        public AwsSecretHelper(IConfiguration config)
        {
            _config = config;
            var region = _config["AWS:Region"] ?? "us-east-1";
            _client = new AmazonSecretsManagerClient(Amazon.RegionEndpoint.GetBySystemName(region));
        }

        public async Task<string> GetConnectionString(string baseConn, bool forceRefresh = false)
        {
            // If connection string already has credentials, return it directly (development scenario)
            if (!baseConn.Contains("User ID=;") && !baseConn.Contains("Password=;"))
            {
                return baseConn;
            }

            if (!forceRefresh &&
                _cache.TryGetValue(baseConn, out var cachedConn) &&
                _cacheTime.TryGetValue(baseConn, out var cachedTime))
            {
                if ((DateTime.UtcNow - cachedTime).TotalMinutes < 5)
                    return cachedConn;
            }

            var secretName = _config["SECRET_NAME"];
            string connStr = baseConn;
            try {
                var response = await _client.GetSecretValueAsync(new GetSecretValueRequest {
                    SecretId = secretName
                });

                var creds = JsonConvert.DeserializeObject<Dictionary<string, string>>(response.SecretString);

                connStr = baseConn
                    .Replace("User ID=;", $"User ID={creds["username"]};")
                    .Replace("Password=;", $"Password={creds["password"]};");

                _cache[baseConn] = connStr;
                _cacheTime[baseConn] = DateTime.UtcNow;
            }
            catch(Exception ex) { }
            return connStr;
        }
    }
}
