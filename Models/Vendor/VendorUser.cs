namespace ProInternal.Models.Vendor
{
    public class VendorUser
    {
        public int Id { get; set; } // Assuming this is the primary key
        public int CompanyId { get; set; } // Company ID (foreign key)
       // User details
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Username { get; set; }
        public string Password { get; set; }
        public string Slug { get; set; }
    }

    public class VendorUserResponse
    {
        public int UserId { get; set; } // Assuming this is the primary key
 
        public string Status { get; set; }
    }


}
