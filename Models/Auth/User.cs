using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace ProInternal.Models.Auth
{
    public class User
    {
        public int UserId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Username { get; set; }
        public string Password { get; set; }
        public int CompanyId { get; set; }
        public int AddressId { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string SecretQuestion { get; set; }
        public string SecretAnswer { get; set; }
        public bool IsActive { get; set; }
        public DateTime LastLogin { get; set; }
        public DateTime EnterDate { get; set; }
        public DateTime UpdateDate { get; set; }
        public int IsOwner { get; set; }
        public bool SharePhoto { get; set; }
        public IEnumerable<int> Roles { get; set; }
        public string Role { get; set; }
        public string RoleNames { get; set; }   
        public int CartId { get; set; }
        public string AccountNumber { get; set; }
        public int Permissions { get; set; }
        public string status { get; set; }

    }
    public class Permission
    {
        public string Permissions { get; set; }
    }

    public class LoginResponse
    {
        public string Token { get; set; }
        public User User { get; set; }

        // Add these:
        public List<string> Roles { get; set; } = new List<string>();
        public List<string> Permissions { get; set; } = new List<string>();

        public List<string> ExtraPermissions { get; set; } = new List<string>();

    }

    public class UserShort
    {
        public int UserId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
    }


    public class AssignRoleRequest
    {
        public int UserId { get; set; }
        public List<string> Roles { get; set; }
    }


    public class ExtraPermissionsRequest
    {
        public int UserId { get; set; }
        public List<string> Permissions { get; set; }
    }



    public class RoleDto
    {
        public string RoleName { get; set; }
        public string RoleDescription { get; set; }
    }

    public class PermissionDto
    {
        public string PermissionName { get; set; }
        public string Description { get; set; }

        public string RoutePath { get; set; }
    }


    public class RenameRoleRequest
    {
        public string OldName { get; set; }
        public string NewName { get; set; }
    }


    public class PermissionRequest
    {
        public string PermissionName { get; set; }

        public string? Description { get; set; }  // Nullable (optional)

        public string? RoutePath { get; set; } // ✅ Add this

    }

    public class RenamePermissionRequest
    {
        public string OldName { get; set; }
        public string NewName { get; set; }
        public string Description { get; set; }
    }


    public class AssignPermissionRequest
    {
        [JsonPropertyName("role")]
        public string Role { get; set; }

        [JsonPropertyName("permission")]
        public List<string> Permission { get; set; }
    }

    public class UserWithRoles
    {
        public int UserId { get; set; }
        public string Email { get; set; }
        public string Username { get; set; }
        public string FullName { get; set; }
        public string status { get; set; } = "";
        public List<string> Roles { get; set; } = new();
        public List<string> ExtraPermissions { get; set; } = new List<string>();
    }






}
