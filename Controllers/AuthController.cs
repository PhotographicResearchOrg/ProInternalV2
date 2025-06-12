using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Services;
using ProInternal.Models.Auth;
using ProInternal.Models.Dashboard;
using Microsoft.AspNetCore.Cors;
using Newtonsoft.Json.Linq;
using ProInternal.Models.Configuration;
using Newtonsoft.Json;
using Microsoft.AspNetCore.DataProtection;


namespace ProInternal.Controllers
{
    [Route("api/[controller]")]

    [ApiController]
    [AllowAnonymous]
    public class AuthController : ControllerBase
    {
        private IProDataAccess _proDataAccess;
        private AppConfigurations _appConfig;


        public AuthController(IProDataAccess proDataAccess, IOptions<AppConfigurations> appConfigurations )
        {
            _proDataAccess = proDataAccess;
            _appConfig = appConfigurations.Value;
        }


        [HttpGet("user/{userId}/extra-permissions")]
        public IActionResult GetExtraPermissions(int userId)
        {
            var result = _proDataAccess.GetUserExtraPermissions(userId);
            return Ok(result);
        }



        [HttpPost("extra-permissions")]
        public IActionResult AddExtraPermissions([FromBody] ExtraPermissionsRequest req)
        {
            _proDataAccess.SaveUserExtraPermission(req.UserId, req.Permissions);

            return Ok();

         }


        [HttpDelete("user/{userId}/extra-permissions/{permission}")]
        public IActionResult RemoveExtraPermission(int userId, string permission)
        {
            _proDataAccess.RemoveUserExtraPermission(userId, permission);

            return Ok();
        }


        [HttpGet("users")]
        public IActionResult GetUsers()
        {
            var users = _proDataAccess.GetUsersWithRoles(); // Adjust method name to match your DAL


            // Populate extra permissions
            foreach (var user in users)
            {
               user.ExtraPermissions = _proDataAccess.GetUserExtraPermissions(user.UserId);
            }

            return Ok(users);
        }

        [HttpGet("roles")]
        public ActionResult<List<RoleDto>> GetRoles()
        {
            var roles = _proDataAccess.GetAllRoles(); // Returns list of strings like ["PIV2_ADMIN", ...]
            return Ok(roles);
        }


        [HttpPost("assign-role")]
        public IActionResult AssignRoleToUser([FromBody] AssignRoleRequest req)
        {
            //Remove 
            //_proDataAccess.AssignRoleToUser(req.UserId, req.Roles);
            _proDataAccess.ReplaceUserRoles(req.UserId, req.Roles);

            return Ok();
        }



        [HttpPost("remove-role")]
        public IActionResult RemoveRoleFromUser([FromBody] AssignRoleRequest req)
        {
            foreach (var role in req.Roles)
            {
                _proDataAccess.RemoveRoleFromUser(req.UserId, role);
            }


            return Ok();
        }





        [HttpGet("user-roles/{userId}")]
        public IActionResult GetUserRoles(int userId)
        {
            var roles = _proDataAccess.GetUserRoles(userId);
            return Ok(roles);
        }


        [HttpPost("assign-permission")]
        public IActionResult AssignPermissionToRole([FromBody] AssignPermissionRequest req)
        {
            _proDataAccess.AssignPermissionToRole(req.Role, req.Permission);
            return Ok();
        }

        [HttpPost("remove-permission")]
        public IActionResult RemovePermissionFromRole([FromBody] AssignPermissionRequest req)
        {
            _proDataAccess.RemovePermissionFromRole(req.Role, req.Permission);
            return Ok();
        }



        [HttpPost("create-role")]
        public IActionResult CreateRole([FromBody] RoleDto role)
        {
            _proDataAccess.CreateRole(role.RoleName, role.RoleDescription);
            return Ok();
        }

        [HttpPost("rename-role")]
        public IActionResult RenameRole([FromBody] RenameRoleRequest request)
        {
            _proDataAccess.RenameRole(request.OldName, request.NewName);
            return Ok();
        }

        [HttpPost("delete-role")]
        public IActionResult DeleteRole([FromBody] string roleName)
        {
            _proDataAccess.DeleteRole(roleName);
            return Ok();
        }





        [HttpGet("user-permissions/{userId}")]
        public IActionResult GetUserPermissions(int userId)
        {
            var permissions = _proDataAccess.GetUserPermissions(userId);
            return Ok(permissions);
        }



        [HttpGet("permissions")]
        public IActionResult GetAllPermissions()
        {
            var permissions = _proDataAccess.GetAllPermissions();
            return Ok(permissions);
        }




        [HttpGet("role-permissions/{roleName}")]
        public IActionResult GetPermissionsByRole(string roleName)
        {
            var permissions = _proDataAccess.GetPermissionsByRole(roleName);
            return Ok(permissions);
        }



        [HttpPost("permissionscreate")]
        public IActionResult CreatePermission([FromBody] PermissionRequest request)
        {
            _proDataAccess.CreatePermission(request.PermissionName, request.Description, request.RoutePath);
            return Ok();
        }


        [HttpPost("permissionsrename")]
        public IActionResult RenamePermission([FromBody] RenamePermissionRequest request)
        {
        
            _proDataAccess.RenamePermission(request.OldName, request.NewName, request.Description);
            return Ok();
        }




        [HttpPost("permissionsdelete")]
        public IActionResult DeletePermission([FromBody] PermissionRequest request)
        {
            _proDataAccess.DeletePermission(request.PermissionName);
            return Ok();
        }



        [HttpPost("user/{userId}/disable")]
        public IActionResult DisableUser(int userId)
        {
            _proDataAccess.DisableUser(userId);
            return Ok();
        }

        [HttpPost("user/{userId}/delete")]
        public IActionResult DeleteUser(int userId)
        {
            _proDataAccess.DeleteUser(userId);
            return Ok();
        }

        [HttpPost("user/{userId}/enable")]
        public IActionResult EnableUser(int userId)
        {
            _proDataAccess.EnableUser(userId);
            return Ok();
        }










        [HttpPost("login")]
        public IActionResult Login([FromBody] AuthCredentials authCredentials)
        {
            if (string.IsNullOrWhiteSpace(authCredentials.username) || string.IsNullOrWhiteSpace(authCredentials.password))
            {
                return BadRequest(new { error = "Username and password are required." });
            }

            var loginResult = _proDataAccess.login(authCredentials.username, authCredentials.password);

            if (loginResult?.User == null)
            {
                return Unauthorized(new { error = "Invalid username or password." });
            }

            var token = JwtToken.GetToken(loginResult, _appConfig);

            return Ok(new
            {
                token,
                user = new
                {
                    id = loginResult.User.UserId,
                    name = $"{loginResult.User.FirstName} {loginResult.User.LastName}",
                    email = loginResult.User.Email,
                    username = loginResult.User.Username
                },
                roles = loginResult.Roles,
                permissions = loginResult.Permissions,
                extraPermissions = loginResult.ExtraPermissions 
            });
        }








    }
}
