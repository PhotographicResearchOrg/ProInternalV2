using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Text.Json;

namespace ProInternal.Helpers.Security
{
    /*
     * Loads the app's secrets from one AWS Secrets Manager secret into
     * configuration, so nothing secret lives in appsettings.json or git.
     *
     *   appsettings.json:   "AppSecretsName": "prod/piv2/app"
     *
     * The secret is a flat JSON object whose keys are configuration paths:
     *
     *   {
     *     "AppConfigurations:Jwt:Secret": "...",
     *     "Email:GmailAppPassword": "...",
     *     "OrderIntegration:ApiKey": "...",
     *     "OrderIntegration:ResponseKeys:COMPUTYME": "...",
     *     "OrderIntegration:JobKey": "...",
     *     "ConnectionStrings:SQLII": "Server=...;User ID=...;Password=...;"
     *   }
     *
     * Leave AppSecretsName empty on a developer machine and set the same
     * keys as environment variables instead (":" becomes "__"), e.g.
     *   AppConfigurations__Jwt__Secret=...
     * Environment variables are read after this source, so they win.
     */
    public static class AppSecretsConfiguration
    {
        public static IConfigurationBuilder AddAppSecrets(this ConfigurationManager configuration)
        {
            var secretName = configuration["AppSecretsName"];
            if (string.IsNullOrWhiteSpace(secretName))
                return configuration;

            using var client = new AmazonSecretsManagerClient();
            var response = client
                .GetSecretValueAsync(new GetSecretValueRequest { SecretId = secretName })
                .GetAwaiter()
                .GetResult();

            var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            using (var doc = JsonDocument.Parse(response.SecretString))
            {
                foreach (var property in doc.RootElement.EnumerateObject())
                {
                    values[property.Name] = property.Value.ValueKind == JsonValueKind.String
                        ? property.Value.GetString()
                        : property.Value.GetRawText();
                }
            }

            configuration.AddInMemoryCollection(values);
            configuration.AddEnvironmentVariables();
            return configuration;
        }

        /* Stops startup with a clear message instead of running with an empty key. */
        public static void RequireSecret(this IConfiguration configuration, string key)
        {
            if (string.IsNullOrWhiteSpace(configuration[key]))
            {
                throw new InvalidOperationException(
                    $"Configuration value '{key}' is missing. Put it in the Secrets Manager " +
                    "secret named by AppSecretsName, or set it as an environment variable " +
                    $"({key.Replace(":", "__")}).");
            }
        }
    }
}
