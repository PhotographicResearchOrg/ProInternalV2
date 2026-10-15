using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ProInternal.Models.Integration;
using ProInternal.Services.Integration;
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    /*
     * Where a receiving system answers about a message PRO sent it, for
     * every domain except orders (they keep api/OrderIntegration/responses).
     *
     *   POST api/integration/responses/{destination}
     *   header x-integration-key: Integration:ResponseKeys:{DESTINATION}
     *   body   one integration response (Schemas/Integration/v1.0)
     *
     * {destination} must match the message's destination, so one system
     * cannot answer for a message sent to another.
     *
     *   200  APPLIED or DUPLICATE (the same answer again changes nothing)
     *   400  not a contract response; nothing changed
     *   401  missing or wrong key
     *   404  no message with that correlationId was sent to this destination
     */
    [AllowAnonymous]
    [ApiController]
    [Route("api/integration/responses")]
    public sealed class IntegrationResponseController : ControllerBase
    {
        private const string KeyHeader = "x-integration-key";
        private const int MaximumBodyBytes = 1024 * 1024;

        private static readonly JsonSerializerOptions ReadOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        private readonly IIntegrationDataAccess _data;
        private readonly IntegrationResponseValidator _validator;
        private readonly IConfiguration _configuration;
        private readonly ILogger<IntegrationResponseController> _logger;

        public IntegrationResponseController(
            IIntegrationDataAccess data,
            IntegrationResponseValidator validator,
            IConfiguration configuration,
            ILogger<IntegrationResponseController> logger)
        {
            _data = data;
            _validator = validator;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpPost("{destination}")]
        [RequestSizeLimit(MaximumBodyBytes)]
        public async Task<IActionResult> Receive(string destination)
        {
            destination = (destination ?? "").Trim().ToUpperInvariant();

            if (!KeyMatches(destination, Request.Headers[KeyHeader].ToString()))
                return Unauthorized(new { error = "Missing or wrong x-integration-key for this destination." });

            string body;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
                body = await reader.ReadToEndAsync();

            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(body);
            }
            catch (JsonException)
            {
                return BadRequest(new { outcome = "INVALID_RESPONSE", errors = new[] { "The body is not JSON." } });
            }

            using (document)
            {
                var validation = _validator.Validate(document.RootElement);
                if (!validation.IsValid)
                    return BadRequest(new { outcome = "INVALID_RESPONSE", errors = validation.Errors });

                var response = document.RootElement.Deserialize<IntegrationResponseDocument>(ReadOptions)!;
                var applied = await _data.ApplyResponseAsync(destination, response, body);

                if (applied.Outcome == "NOT_FOUND")
                {
                    return NotFound(new
                    {
                        outcome = "MESSAGE_NOT_FOUND",
                        error = $"No message {response.CorrelationId} was sent to {destination}."
                    });
                }

                _logger.LogInformation(
                    "Integration response {Outcome} for message {MessageId} from {Destination}: {Status}",
                    applied.Outcome, applied.MessageId, destination, applied.Status);

                return Ok(new { outcome = applied.Outcome, messageId = applied.MessageId, status = applied.Status });
            }
        }

        /* Constant-time comparison; an unset key never matches. */
        private bool KeyMatches(string destination, string supplied)
        {
            var expected = _configuration[$"Integration:ResponseKeys:{destination}"];
            if (string.IsNullOrEmpty(expected) || string.IsNullOrEmpty(supplied))
                return false;

            var a = Encoding.UTF8.GetBytes(expected);
            var b = Encoding.UTF8.GetBytes(supplied);
            return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
        }
    }
}
