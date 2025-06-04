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




    public class IRBatchDetail
    {
        public DateTime ProgramStartWeek { get; set; }
        public DateTime ProgramEndWeek { get; set; }
        public string VendorName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public int MemberID { get; set; }
        public decimal ReimbursementAmount { get; set; }
        public decimal Extended { get; set; }
        public DateTime Date { get; set; }
        public string Model { get; set; } = string.Empty;
        public int OrderID { get; set; }
        public decimal Total { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? RejectReason { get; set; }
        public string ComputymeProcessed { get; set; } = string.Empty; // e.g., 'Credit Issued'
        public string EmailComm { get; set; } = string.Empty;          // e.g., 'Email Sent'
    }



    public class IRBatchExport
    {
        public List<IR> Summary { get; set; } = new();
        public List<IRBatchDetail> Detail { get; set; } = new();
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
