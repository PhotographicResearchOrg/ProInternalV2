using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;

namespace ProInternal.Helpers.Security
{
    /*
     * Rebate Desk security by drawer, managed in Security Administration.
     *
     *   [RequireDrawer("Claims")]                                     read: RebateDesk.Claims.View or .Edit
     *   [RequireDrawer("Claims", Edit = true, Legacy = new[] { "Rebates.Accounting" })]
     *                                                                 act: RebateDesk.Claims.Edit
     *
     * A user who holds any RebateDesk.* permission is checked drawer by drawer. A user who holds
     * none is checked the old way: the Legacy names (and the controller's own check), so nobody
     * loses access the day this ships. Always names pass in every case (e.g. "/BRMdash" for the
     * BRM dashboard). PIV2_ADMIN passes. Follows Security:Mode (Off / Log / Enforce).
     */
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
    public sealed class RequireDrawerAttribute : Attribute, IAuthorizationFilter
    {
        public const string Prefix = "RebateDesk.";

        public RequireDrawerAttribute(params string[] areas)
        {
            Areas = areas ?? Array.Empty<string>();
        }

        public string[] Areas { get; }
        public bool Edit { get; set; }
        public string[] Legacy { get; set; } = Array.Empty<string>();
        public string[] Always { get; set; } = Array.Empty<string>();

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            if (context.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any())
                return;

            var services = context.HttpContext.RequestServices;
            var mode = Permissions.Mode(services.GetRequiredService<IConfiguration>());
            if (mode == PermissionMode.Off)
                return;

            var user = context.HttpContext.User;
            if (Always.Length > 0 && Permissions.HasAny(user, Always))
                return;

            string[] needed;
            if (Permissions.HasPrefix(user, Prefix))
                needed = Areas.SelectMany(a => Edit
                        ? new[] { $"{Prefix}{a}.Edit" }
                        : new[] { $"{Prefix}{a}.View", $"{Prefix}{a}.Edit" })
                    .ToArray();
            else if (Legacy.Length > 0)
                needed = Legacy;
            else
                return;   // no drawer permissions and no legacy rule here: the controller's own check decides

            if (Permissions.HasAny(user, needed))
                return;

            var signedIn = user?.Identity?.IsAuthenticated == true;
            services.GetRequiredService<ILoggerFactory>().CreateLogger("Security").LogWarning(
                "{Outcome}: {User} {Method} {Path} needs one of [{Permissions}]",
                mode == PermissionMode.Enforce ? "Refused" : "Would refuse",
                signedIn ? Permissions.UserName(user!) : "anonymous",
                context.HttpContext.Request.Method,
                context.HttpContext.Request.Path,
                string.Join(", ", needed));

            if (mode != PermissionMode.Enforce)
                return;

            context.Result = signedIn ? new ForbidResult() : new UnauthorizedResult();
        }
    }
}
