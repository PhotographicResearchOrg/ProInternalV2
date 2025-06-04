namespace ProInternal.Models.InstantRebates
{
    public class DeclinedIR
    {
        public int OrderID { get; set; }
        public int Status { get; set; }
        public DateTime? ProcessDate { get; set; }
        public double Total { get; set; }
        public string? RejectReason { get; set; }
        public int MemberID { get; set; }
        public int Quantity { get; set; }
        public string? Model { get; set; }
        public String? EMail { get; set; }

        public int vendorID { get; set; }
        public string? vendorName { get; set; }
        public string? vendorImage { get; set; }


        public string? MasterFileLoc { get; set; }

        // Single string, comma-delimited
        public string? AdditionalFiles { get; set; }


        public List<string> AdditionalFileList =>
        string.IsNullOrWhiteSpace(AdditionalFiles)
            ? new List<string>()
            : AdditionalFiles.Split('|').ToList();

    }



}
