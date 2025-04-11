namespace ProInternal.Models.Dashboard
{
    public class GatedProducts
    {
        public int CompanyBrandExclusionID { get; set; }
        public int BrandID { get; set; }
        public int AccountNumber { get; set; }
        public int RosterID { get; set; }
        public string  DBA { get; set; }
        public string BrandName { get; set; }
        public string Country { get; set; }
        public string CountryCode { get; set; }


    }

    public class GatingAssignment
    {
        public string AccountNumber { get; set; }
        public List<string> BrandIds { get; set; }

    }


    public class CountryBrandBulkRequest
    {
        public string Country { get; set; }
        public List<int> BrandIds { get; set; }
    }



}
