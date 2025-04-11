namespace ProInternal.Models.Vendor
{
    public class VendorStock
    {
        public string company { get; set; }
        public int vendorID { get; set; }
        public int AccountId { get; set; }
        public string CatalogNumber { get; set; }
        public int Quantity { get; set; }
        public string ProductCode { get; set; }
        public string ModelName { get; set; }
        public string Image { get; set; }
        public DateTime LoadedOn { get; set; }
        public string status { get; set; }
    }
}
