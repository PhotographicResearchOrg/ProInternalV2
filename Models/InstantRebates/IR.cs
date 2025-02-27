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

}
