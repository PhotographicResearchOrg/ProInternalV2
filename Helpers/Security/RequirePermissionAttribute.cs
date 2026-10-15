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
     * Requires any one of the named permissions (PermissionName or
     * RoutePath) on a controller or action.
     *
     *   [RequirePermission("Rebates.Activate", "/rebatesupport")]
     *
     * Follows Security:Mode unless AlwaysEnforce is set. Actions marked
     * [AllowAnonymous] are skipped.
     */
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
    public sealed class RequirePermissionAttribute : Attribute, IAuthorizationFilter
    {
        public RequirePermissionAttribute(params string[] permissions)
        {
            Permissions = permissions ?? Array.Empty<string>();
        }

        public string[] Permissions { get; }

        public bool AlwaysEnforce { get; set; }

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            if (context.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any())
                return;

            var services = context.HttpContext.RequestServices;
            var configuration = services.GetRequiredService<IConfiguration>();
            var mode = AlwaysEnforce
                ? PermissionMode.Enforce
                : Security.Permissions.Mode(configuration);

            if (mode == PermissionMode.Off)
                return;

            var user = context.HttpContext.User;
            if (Security.Permissions.HasAny(user, Permissions))
                return;

            var signedIn = user?.Identity?.IsAuthenticated == true;
            var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("Security");

            logger.LogWarning(
                "{Outcome}: {User} {Method} {Path} needs one of [{Permissions}]",
                mode == PermissionMode.Enforce ? "Refused" : "Would refuse",
                signedIn ? Security.Permissions.UserName(user!) : "anonymous",
                context.HttpContext.Request.Method,
                context.HttpContext.Request.Path,
                string.Join(", ", Permissions));

            if (mode != PermissionMode.Enforce)
                return;

            context.Result = signedIn ? new ForbidResult() : new UnauthorizedResult();
        }
    }
}
