namespace ProInternal
{
    public class VendorFileOptions
    {
        public const string SectionName = "VendorFiles";

        // Root "VendorFiles" folder; each vendor gets a subfolder named by its vendor id.
        public string RootPath { get; set; } = "";
        public string ContractsFolder { get; set; } = "Contracts";
        public string PriceListsFolder { get; set; } = "Price Lists";
    }
}
