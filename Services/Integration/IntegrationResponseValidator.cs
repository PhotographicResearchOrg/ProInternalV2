using Json.Schema;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace ProInternal.Services.Integration
{
    public sealed record IntegrationValidationResult(bool IsValid, IReadOnlyList<string> Errors);

    /*
     * Checks a posted answer against
     * Schemas/Integration/v1.0/integration-response.schema.json.
     * The schema allows no field it does not define.
     */
    public sealed class IntegrationResponseValidator
    {
        private readonly JsonSchema _schema;

        private readonly EvaluationOptions _evaluationOptions = new()
        {
            OutputFormat = OutputFormat.Hierarchical
        };

        public IntegrationResponseValidator()
        {
            var path = Path.Combine(
                AppContext.BaseDirectory, "Schemas", "Integration", "v1.0", "integration-response.schema.json");

            if (!File.Exists(path))
                throw new FileNotFoundException("The integration response schema was not found.", path);

            _schema = JsonSchema.FromFile(path, new BuildOptions { SchemaRegistry = new SchemaRegistry() });
        }

        public IntegrationValidationResult Validate(JsonElement document)
        {
            var evaluation = _schema.Evaluate(document, _evaluationOptions);
            if (evaluation.IsValid)
                return new IntegrationValidationResult(true, Array.Empty<string>());

            var errors = new List<string>();
            Collect(evaluation, errors);
            return new IntegrationValidationResult(false, errors.Distinct(StringComparer.Ordinal).ToArray());
        }

        private static void Collect(EvaluationResults result, List<string> errors)
        {
            if (result.Errors is not null)
            {
                var path = result.InstanceLocation.ToString();
                if (string.IsNullOrWhiteSpace(path))
                    path = "/";

                foreach (var error in result.Errors.Values)
                    errors.Add($"{path}: {error}");
            }

            if (result.Details is null)
                return;

            foreach (var detail in result.Details)
                Collect(detail, errors);
        }
    }
}
