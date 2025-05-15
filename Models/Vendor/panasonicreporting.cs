namespace ProInternal.Models.Vendor
{
    public class PanaRep
    {
        public int? Id { get; set; }
        public string RepName { get; set; }
        public string Email { get; set; }
    }

    public class PanaAccount
    {
        public string Meca { get; set; }
        public int? AccountNumber { get; set; }
        public string AccountName { get; set; }
        public int? RepId { get; set; }
        public int? ID { get; set; }
    }
}
