namespace ProInternal.Models.Dashboard
{
    public class MapViolationResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public List<MapViolation> ExistingViolations { get; set; } = new List<MapViolation>();
    }

    public class MapViolation
    {
        public string AccountNumber { get; set; }
        public string ProductCode { get; set; }
        public int PenaltyDays { get; set; }
        public DateTime SubmittedOn { get; set; } // Include this to show when violations were submitted
    }
}
