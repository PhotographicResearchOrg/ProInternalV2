namespace ProInternal.Models.InstantRebates
{
    public class IR
    {

        public string? IRDesc { get; set; }
        public string? ModelNumber { get; set; }
        public int BatchID { get; set; }
        public int Units { get; set; }
        public string? VendorName { get; set; }
        public int VendorID { get; set; }
        public DateTime? ProgramStart { get; set; }
        public DateTime? ProgramEnd { get; set; }
        public int IrType { get; set; }
        public string? IrtypeName { get; set; }
        public Boolean Expired { get; set; }

    }

    public class ParentIRCompany
    {
        public int ID { get; set; }
        public string CompanyName { get; set; }
        public bool Active { get; set; }
        public string? ImageUrl { get; set; }
    }



    public class RebateVendor
    {
        public int Id { get; set; }
        public string VendorName { get; set; }
        public string ParentCompany { get; set; }
        public string? Apmstid { get; set; }
        public bool Active { get; set; }
        public bool IsInstantRebate { get; set; }
        public bool IsPriceProtection { get; set; }     
        public string ImageUrl { get; set; }
        public int? ParentCompanyId { get; set; }
    }




}
