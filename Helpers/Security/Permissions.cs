using Microsoft.Extensions.Configuration;
using System;
using System.Security.Claims;
using System.Text.Json;

namespace ProInternal.Helpers.Security
{
    /*
     * How server-side permission checks behave, set in appsettings.json:
     *
     *   "Security": { "Mode": "Log" }
     *
     *   Off      no checks (only for an emergency rollback)
     *   Log      checks run; a call that would be refused is written to the
     *            log with the user, path and missing permission, then allowed
     *   Enforce  a call without a signed-in user gets 401, a call without the
     *            permission gets 403
     *
     * Start in Log, read the log for a week, grant what is missing in
     * Security Admin, then switch to Enforce. Checks marked AlwaysEnforce
     * (security admin) ignore this setting.
     */
    public enum PermissionMode
    {
        Off,
        Log,
        Enforce
    }

    public static class Permissions
    {
        /* Holders of this role pass every permission check. */
        public const string AdminRole = "PIV2_ADMIN";

        /* Security Admin: users, roles and permissions. */
        public const string SecurityAdmin = "Security.Admin";
        public const string SecurityAdminRoute = "/security-admin";

        public static PermissionMode Mode(IConfiguration configuration)
        {
            return Enum.TryParse<PermissionMode>(configuration["Security:Mode"], true, out var mode)
                ? mode
                : PermissionMode.Log;
        }

        /*
         * True when the token carries any of the names, matched against
         * either PermissionName ("Rebates.Activate") or RoutePath
         * ("/rebatesupport"), or the user holds the admin role.
         */
        public static bool HasAny(ClaimsPrincipal user, params string[] names)
        {
            if (user?.Identity?.IsAuthenticated != true)
                return false;

            if (user.IsInRole(AdminRole))
                return true;

            foreach (var claim in user.FindAll("permissions"))
            {
                try
                {
                    using var doc = JsonDocument.Parse(claim.Value);
                    var root = doc.RootElement;

                    if (root.ValueKind == JsonValueKind.Object && Matches(root, names))
                        return true;

                    if (root.ValueKind != JsonValueKind.Array)
                        continue;

                    foreach (var item in root.EnumerateArray())
                    {
                        if (Matches(item, names))
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

        /* The signed-in user's name for audit columns; never the literal "Web". */
        public static string UserName(ClaimsPrincipal user)
        {
            var name = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? user?.FindFirst("sub")?.Value
                ?? user?.Identity?.Name;

            return string.IsNullOrWhiteSpace(name) ? "unknown" : name;
        }

        private static bool Matches(JsonElement item, string[] names)
        {
            if (item.ValueKind != JsonValueKind.Object)
                return false;

            foreach (var field in new[] { "PermissionName", "permissionName", "RoutePath", "routePath" })
            {
                if (!item.TryGetProperty(field, out var value) || value.ValueKind != JsonValueKind.String)
                    continue;

                var held = value.GetString();
                foreach (var name in names)
                {
                    if (string.Equals(held, name, StringComparison.OrdinalIgnoreCase))
                        return true;
                }
            }

            return false;
        }
    }
}
