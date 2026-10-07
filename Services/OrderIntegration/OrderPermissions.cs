using Microsoft.Extensions.Configuration;
using System;
using System.Security.Claims;
using System.Text.Json;

namespace ProInternal.Services.OrderIntegration
{
    /*
     * The two order permissions, read from the "permissions" claim the
     * login token already carries (a list of PermissionName/RoutePath).
     *
     *   Orders.Review   reject, release, process, reopen, record a response
     *   Orders.Modify   change an order: lines, address, notes, holds
     *
     * Enforcement is OFF until you turn it on, so installing this does
     * not lock anyone out:
     *
     *   "Orders": { "EnforcePermissions": true }
     *
     * Create both permissions in Security Admin and grant them first.
     * A grant takes effect at the user's next login.
     */
    public static class OrderPermissions
    {
        public const string Review = "Orders.Review";
        public const string Modify = "Orders.Modify";

        public static bool IsAllowed(
            this ClaimsPrincipal user,
            IConfiguration configuration,
            string permission)
        {
            var enforce = string.Equals(
                configuration["Orders:EnforcePermissions"],
                "true",
                StringComparison.OrdinalIgnoreCase);

            return !enforce || user.HasPermission(permission);
        }

        public static bool HasPermission(this ClaimsPrincipal user, string name)
        {
            foreach (var claim in user.FindAll("permissions"))
            {
                try
                {
                    using var doc = JsonDocument.Parse(claim.Value);
                    var root = doc.RootElement;

                    if (root.ValueKind == JsonValueKind.Object && Matches(root, name))
                        return true;

                    if (root.ValueKind != JsonValueKind.Array)
                        continue;

                    foreach (var item in root.EnumerateArray())
                    {
                        if (Matches(item, name))
                            return true;
                    }
                }
                catch (JsonException)
                {
                    /* Unreadable claim: treated as no permission. */
                }
            }

            return false;
        }

        private static bool Matches(JsonElement item, string name)
        {
            return item.ValueKind == JsonValueKind.Object
                && item.TryGetProperty("PermissionName", out var value)
                && value.ValueKind == JsonValueKind.String
                && string.Equals(value.GetString(), name, StringComparison.OrdinalIgnoreCase);
        }
    }
}
