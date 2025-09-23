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


    public class RebateIRRowDto
    {
        // Legacy columns
        public string? VendorBrand { get; set; }           // "Vendor / Brand"
        public string? ProductDescription { get; set; }    // "Product Description" (alias of ModelName)
        public string? ProCodePrimary { get; set; }        // "PRO Code_(Primary)"
        public decimal? InstantRebate { get; set; }        // "Instant Rebate"
        public decimal? MemberReimbursement { get; set; }  // "Member_Reimbursement"
        public decimal? MAP { get; set; }                  // "MAP"
        public DateTime? StartDate { get; set; }           // "Start Date"
        public DateTime? EndDate { get; set; }             // "End Date"
        public string? StackProduct { get; set; }        // RESOLVED DESCRIPTION (after lookup)
        public string? StackProductCode { get; set; }    // OPTIONAL: raw code(s) from sheet
        public int? RebateType { get; set; }               // "Rebate Type"
        public string? Notes { get; set; }                 // "Notes"
        public string? Stack { get; set; }                 // "Stack" (CSV of associated products)
        public int? DispositionModelID { get; set; }       // "disposition"

        // Keep your previous fields for compatibility (optional)
        public string? ProductCode { get; set; }           // original ProductCode
        public string? ModelName { get; set; }             // original ModelName
        public string? IRDescription { get; set; }         // if you still want normalized description
        public int PreviewId { get; set; }
        public string? ProposedModelName { get; set; }
    }

    public  class CommitRequest
    {
        public List<int> PreviewIds { get; set; } = new();
        public bool DryRun { get; set; } = false;           // validate only
        public bool OverwriteDuplicates { get; set; } = false;
    }

    public  class CommitRowResult
    {
        public int PreviewId { get; set; }
        public string Status { get; set; } = "Inserted";    // Inserted/Updated/Skipped/Error
        public string? Message { get; set; }
    }

    public  class CommitResult
    {
        public int Inserted { get; set; }
        public int Updated { get; set; }
        public int Skipped { get; set; }
        public int Errors { get; set; }
        public List<CommitRowResult> Rows { get; set; } = new();
    }

}
