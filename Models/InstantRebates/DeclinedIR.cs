namespace ProInternal.Models.InstantRebates
{
    public class DeclinedIR
    {
        public int OrderID { get; set; }
        public DateTime? ProcessDate { get; set; }
        public double Total { get; set; }
        public string? RejectReason { get; set; }
        public int MemberID { get; set; }
        public int Quantity { get; set; }
        public string? Model { get; set; }
        public String? EMail { get; set; }
      
    }

}
