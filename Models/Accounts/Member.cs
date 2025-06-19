namespace ProInternal.Models.Accounts
{
    public class Member
    {
        public string ImageUrl { get; set; }
        public string Dba { get; set; }
        public string LegalName { get; set; }
        public string AccountNumber { get; set; }
        public string Phone { get; set; }
        public string Fax { get; set; }
        public string Email { get; set; }
        public string Website { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Street { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Zip { get; set; }
        public string Country { get; set; }
    }

    public class MemberAddress
    {
        public string AddressType { get; set; }
        public string Street { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Zip { get; set; }
        public string Country { get; set; }
    }

}
