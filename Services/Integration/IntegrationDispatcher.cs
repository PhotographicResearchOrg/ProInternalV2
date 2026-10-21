using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ProInternal.Models.Integration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.Integration
{
    /*
     * Sends one domain's messages to one destination. Each desk that
     * starts sending adds one of these, registered in Program.cs:
     *
     *   builder.Services.AddScoped<IIntegrationSender, ComputymeVendorSender>();
     *
     * The payload has already been validated against its contract when
     * it was queued. A sender delivers it and reports whether delivery
     * worked; the answer itself arrives later on the response endpoint,
     * carrying the message's CorrelationId.
     */
    public interface IIntegrationSender
    {
        string Domain { get; }
        string Destination { get; }
        Task<IntegrationSendResult> SendAsync(IntegrationOutgoing message, CancellationToken cancellationToken);
    }

    /*
     * Runs in the API process. Every cycle it marks overdue messages,
     * claims a batch of due messages, and hands each to its sender.
     *
     *   "Integration": { "DispatchSeconds": 30, "BatchSize": 25, "Enabled": true }
     *
     * A message whose destination has no sender yet stays QUEUED, with
     * the reason logged once per cycle; it goes out when the sender is
     * deployed. A failure on one message never stops the others.
     */
    public sealed class IntegrationDispatcher : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly IConfiguration _configuration;
        private readonly ILogger<IntegrationDispatcher> _logger;

        public IntegrationDispatcher(
            IServiceScopeFactory scopes,
            IConfiguration configuration,
            ILogger<IntegrationDispatcher> logger)
        {
            _scopes = scopes;
            _configuration = configuration;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_configuration.GetValue("Integration:Enabled", true))
            {
                _logger.LogInformation("Integration dispatcher is switched off (Integration:Enabled = false).");
                return;
            }

            var seconds = Math.Clamp(_configuration.GetValue("Integration:DispatchSeconds", 30), 5, 3600);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunOnceAsync(stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogError(ex, "Integration dispatch cycle failed; trying again next cycle.");
                }

                await PurgeIfDueAsync(stoppingToken);

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(seconds), stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }
        }

        private DateTime _lastPurgeUtc = DateTime.MinValue;

        /* Once a day: delete finished messages older than Integration:RetentionDays (0 turns it off). */
        private async Task PurgeIfDueAsync(CancellationToken cancellationToken)
        {
            var keepDays = _configuration.GetValue("Integration:RetentionDays", 180);
            if (keepDays <= 0 || DateTime.UtcNow - _lastPurgeUtc < TimeSpan.FromHours(24))
                return;

            _lastPurgeUtc = DateTime.UtcNow;
            try
            {
                using var scope = _scopes.CreateScope();
                var data = scope.ServiceProvider.GetRequiredService<IIntegrationDataAccess>();
                var deleted = await data.PurgeAsync(Math.Max(keepDays, 30));
                if (deleted > 0)
                    _logger.LogInformation("Integration retention removed {Count} finished message(s) older than {Days} days.", deleted, keepDays);
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Integration retention did not run; it will try again tomorrow.");
            }
        }

        /* One cycle. Also called from the desk's "Send now" action. */
        public async Task<int> RunOnceAsync(CancellationToken cancellationToken)
        {
            using var scope = _scopes.CreateScope();
            var data = scope.ServiceProvider.GetRequiredService<IIntegrationDataAccess>();
            var senders = scope.ServiceProvider.GetServices<IIntegrationSender>()
                .ToDictionary(s => Key(s.Domain, s.Destination), StringComparer.OrdinalIgnoreCase);

            var overdue = await data.MarkOverdueAsync();
            if (overdue > 0)
                _logger.LogWarning("{Count} integration message(s) are now OVERDUE.", overdue);

            var batch = Math.Clamp(_configuration.GetValue("Integration:BatchSize", 25), 1, 200);
            var claimed = await data.ClaimAsync(batch, leaseSeconds: 120);
            var sent = 0;
            var unsendable = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var message in claimed)
            {
                if (cancellationToken.IsCancellationRequested)
                    break;

                if (!senders.TryGetValue(Key(message.Domain, message.Destination), out var sender))
                {
                    /* Left QUEUED; the lease expires and it is picked up once a sender exists. */
                    unsendable.Add(Key(message.Domain, message.Destination));
                    continue;
                }

                try
                {
                    var result = await sender.SendAsync(message, cancellationToken);
                    if (result.Delivered)
                    {
                        await data.MarkSentAsync(message.MessageId);
                        sent++;
                    }
                    else
                    {
                        await data.MarkFailedAsync(message.MessageId, result.Error ?? "The sender reported a failure without a reason.");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Sending integration message {MessageId} failed.", message.MessageId);
                    await data.MarkFailedAsync(message.MessageId, ex.Message);
                }
            }

            foreach (var key in unsendable)
                _logger.LogInformation("No sender is deployed for {Key}; its messages stay queued.", key);

            return sent;
        }

        private static string Key(string domain, string destination) => $"{domain}|{destination}";
    }
}
