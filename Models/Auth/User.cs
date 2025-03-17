using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
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


    }

    public class UserShort
    {
        public int UserId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
    }


}
