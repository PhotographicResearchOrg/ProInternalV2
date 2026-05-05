
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
            _client = new AmazonSecretsManagerClient();
        }

        public async Task<string> GetConnectionString(string baseConn, bool forceRefresh = false)
        {
            if (!forceRefresh &&
                _cache.TryGetValue(baseConn, out var cachedConn) &&
                _cacheTime.TryGetValue(baseConn, out var cachedTime))
            {
                if ((DateTime.UtcNow - cachedTime).TotalMinutes < 5)
                    return cachedConn;
            }

            var secretName = _config["SECRET_NAME"];

            var response = await _client.GetSecretValueAsync(new GetSecretValueRequest
            {
                SecretId = secretName
            });

            var creds = JsonConvert.DeserializeObject<Dictionary<string, string>>(response.SecretString);

            var connStr = baseConn
                .Replace("User ID=;", $"User ID={creds["username"]};")
                .Replace("Password=;", $"Password={creds["password"]};");

            _cache[baseConn] = connStr;
            _cacheTime[baseConn] = DateTime.UtcNow;

            return connStr;
        }
    }
}
