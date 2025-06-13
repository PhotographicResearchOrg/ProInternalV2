namespace ProInternal.Models.Accounts
{
    public class Vendor
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Street { get; set; }
        public string CityState { get; set; }
        public string Zip { get; set; }
        public string Phone { get; set; }
        public string ShortName { get; set; }
        public string OnWeb { get; set; }  // "Yes"/"No"

    }

}
