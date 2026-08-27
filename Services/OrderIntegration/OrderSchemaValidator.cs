using Json.Schema;
using ProInternal.Models.OrderIntegration;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProInternal.Services.OrderIntegration
{
    public sealed class OrderSchemaValidator : IOrderSchemaValidator
    {
        private readonly JsonSchema _orderSchema;

        private readonly JsonSerializerOptions _serializerOptions = new()
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        private readonly EvaluationOptions _evaluationOptions = new()
        {
            OutputFormat = OutputFormat.Hierarchical
        };

        public OrderSchemaValidator()
        {
            var schemaRoot = Path.Combine(AppContext.BaseDirectory,"Schemas","OrderIntegration","v1.0");

            if (!Directory.Exists(schemaRoot))
            {
                throw new DirectoryNotFoundException(
                    $"Order schema directory was not found: {schemaRoot}"
                );
            }

            var buildOptions = new BuildOptions
            {
                SchemaRegistry = new SchemaRegistry()
            };

            /*
             * Load every referenced schema into the same registry.
             * Dependencies are loaded before the root order schema.
             */

            LoadSchema(
                Path.Combine(schemaRoot, "common", "address.schema.json"),
                buildOptions
            );

            LoadSchema(
                Path.Combine(schemaRoot, "common", "money.schema.json"),
                buildOptions
            );

            LoadSchema(
                Path.Combine(schemaRoot, "orders", "order.enums.json"),
                buildOptions
            );

            LoadSchema(
                Path.Combine(schemaRoot, "workflow", "workflow.enums.json"),
                buildOptions
            );

            LoadSchema(
                Path.Combine(schemaRoot, "orders", "order-item.schema.json"),
                buildOptions
            );

            LoadSchema(Path.Combine(schemaRoot,"fulfillment","fulfillment.schema.json"),
                buildOptions
            );

            _orderSchema = LoadSchema(Path.Combine(schemaRoot, "orders", "order.schema.json"),
                buildOptions
            );
        }

        public OrderSchemaValidationResult Validate(CanonicalOrder order)
        {
            ArgumentNullException.ThrowIfNull(order);

            var orderJson = JsonSerializer.SerializeToElement(order, _serializerOptions);
            var evaluation = _orderSchema.Evaluate(orderJson,  _evaluationOptions);

            if (evaluation.IsValid)
            {
                return new OrderSchemaValidationResult(true, Array.Empty<string>());
            }
            var errors = new List<string>();
            CollectErrors(evaluation, errors);
            var distinctErrors = errors.Distinct(StringComparer.Ordinal).ToArray();
            return new OrderSchemaValidationResult(false,distinctErrors);
        }

        private static JsonSchema LoadSchema(
            string path,
            BuildOptions buildOptions
        )
        {
            if (!File.Exists(path))
            {
                throw new FileNotFoundException(
                    "Required order schema was not found.",
                    path
                );
            }

            return JsonSchema.FromFile(path, buildOptions);
        }

        private static void CollectErrors(
            EvaluationResults result,
            List<string> errors
        )
        {
            if (result.Errors is not null)
            {
                var path = result.InstanceLocation.ToString();

                if (string.IsNullOrWhiteSpace(path))
                    path = "/";

                foreach (var error in result.Errors.Values)
                {
                    errors.Add($"{path}: {error}");
                }
            }

            if (result.Details is null)
                return;

            foreach (var detail in result.Details)
            {
                CollectErrors(detail, errors);
            }
        }
    }
}