using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace ProInternal.Helpers.Security
{
    /*
     * Registered for every controller: a call must come from a signed-in
     * user unless the action or controller is marked [AllowAnonymous]
     * (login, integration endpoints that check their own key).
     *
     * Follows Security:Mode, so in Log mode an anonymous call is written
     * to the log and still allowed.
     */
    public sealed class SignedInUserFilter : IAuthorizationFilter
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<SignedInUserFilter> _logger;

        public SignedInUserFilter(IConfiguration configuration, ILogger<SignedInUserFilter> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            if (context.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any())
                return;

            if (context.HttpContext.User?.Identity?.IsAuthenticated == true)
                return;

            var mode = Permissions.Mode(_configuration);
            if (mode == PermissionMode.Off)
                return;

            _logger.LogWarning(
                "{Outcome}: anonymous {Method} {Path}",
                mode == PermissionMode.Enforce ? "Refused" : "Would refuse",
                context.HttpContext.Request.Method,
                context.HttpContext.Request.Path);

            if (mode == PermissionMode.Enforce)
                context.Result = new UnauthorizedResult();
        }
    }
}
