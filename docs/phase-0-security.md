# Phase 0: security

What this release changes, and the steps to deploy it safely.

## What changed

| Change | Where |
| --- | --- |
| Secrets load from AWS Secrets Manager (`AppSecretsName`) or environment variables. `appsettings.json` holds none. | `Helpers/Security/AppSecretsConfiguration.cs`, `Program.cs` |
| Startup stops with a clear message if `AppConfigurations:Jwt:Secret` is missing. | `Program.cs` |
| Every controller requires a signed-in user unless marked `[AllowAnonymous]`. | `Helpers/Security/SignedInUserFilter.cs` |
| `[RequirePermission(...)]` checks a permission name or route path from the token on the server. | `Helpers/Security/RequirePermissionAttribute.cs`, `Permissions.cs` |
| Security Admin endpoints (users, roles, permissions) are always enforced. Login stays open. | `Controllers/AuthController.cs` |
| Rebate IR commits record the signed-in user, not "Web". The upload controller is gated on `Rebates.Upload` or `/uploadrebates`. | `Controllers/RebateIrController.cs`, `Services/NukeDataAccess.cs` |
| `publish-output/` (build output, including a config file with a password) removed and ignored. | `.gitignore` |

`Security:Mode` controls everything except Security Admin:

| Mode | Effect |
| --- | --- |
| `Off` | No checks. Emergency rollback only. |
| `Log` (shipped) | A call that would be refused is logged under the `Security` category, then allowed. |
| `Enforce` | No signed-in user gets 401; missing permission gets 403. |

A user passes any permission check if their token carries the permission name or the screen's route path, or they hold the `PIV2_ADMIN` role.

## Before you deploy

1. Make the GitHub repo private.
2. Rotate every value that was committed. They are in git history, so removing them from the file is not enough:
   - dev RDS `SA` password and the `SQLII` `SA` password
   - `AppConfigurations:Jwt:Secret` (rotating signs everyone out once)
   - `Email:GmailAppPassword`
   - `OrderIntegration:ApiKey` (update the public webhook API that sends it at the same time)
   - `OrderIntegration:ResponseKeys:COMPUTYME` (give Computyme the new key)
   - `OrderIntegration:JobKey` (update whatever schedules the jobs)
   - the OpenAI key on the B2B `AISearch` and `fix/strapi5-article-likes` branches
3. Create the Secrets Manager secret `prod/piv2/app` (same region as `prod/sql/app-user`), a flat JSON object:

   ```json
   {
     "AppConfigurations:Jwt:Secret": "<new 64+ character random value>",
     "Email:GmailAppPassword": "<new>",
     "OrderIntegration:ApiKey": "<new>",
     "OrderIntegration:ResponseKeys:COMPUTYME": "<new>",
     "OrderIntegration:JobKey": "<new>",
     "ConnectionStrings:SQLII": "Server=SQLII.promasterAWS.com;Initial Catalog=PRO;User ID=<user>;Password=<new>;TrustServerCertificate=True;Connection Timeout=30;"
   }
   ```

4. Let the app server read it: add `secretsmanager:GetSecretValue` on `prod/piv2/app` to the role or user that already reads `prod/sql/app-user`.
5. Developer machines: leave `AppSecretsName` empty in a local override and set the same keys as environment variables, with `__` for `:` (for example `AppConfigurations__Jwt__Secret`).

## After you deploy

1. Sign in, open Security Admin, and confirm it still works for an admin.
2. Confirm a user without Security Admin gets 403 from `/api/Auth/users`.
3. Leave `Security:Mode` on `Log` for a week. Search the log for `Would refuse`; each line names the user, path and missing permission. Grant what is genuinely needed.
4. Switch `Security:Mode` to `Enforce` and restart.

## Rollback

Set `Security:Mode` to `Off` and restart. Security Admin stays enforced; to undo that, revert this release.

## Not in this release

- Password hashing. `PIV2_GetUserLoginData` receives the password in plain text, which suggests it is stored that way. Needs a plan with the owner of that procedure.
- Per-action permissions (View, Edit, Activate) for each existing screen. They arrive with each desk's rebuild.
- CORS still allows any origin; tighten it once the production hostnames are confirmed.
