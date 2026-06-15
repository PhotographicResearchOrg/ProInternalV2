namespace ProInternal.Models.Vendor
{
    public class SellThroughComplianceDto
    {
        public int Account { get; set; }

        public string MemberName { get; set; }

        public int MissingWeekCount { get; set; }

        public string MissingWeeks { get; set; }

        public DateTime? LastSubmission { get; set; }

        public string ContactName { get; set; }

        public string ContactEmail { get; set; }

        public string BRMName { get; set; }

        public string BRMEmail { get; set; }

        public string Status { get; set; }

    }


    public class SellThroughSubmissionAuditDto
    {
        public DateTime WeekEnding { get; set; }

        public string FileName { get; set; }

        public string SentToBRMEmail { get; set; }

        public string SentBy { get; set; }

        public DateTime SentDate { get; set; }

        public string Comments { get; set; }
    }


    public class SellThroughRequestEmailRequest
    {
        public int Account { get; set; }

        public string DealerName { get; set; }

        public string ContactEmail { get; set; }

        public string WeekEnding { get; set; }

        public string RequestedBy { get; set; }
    }

    public class SellThroughSubmissionRequest
    {
        public int Account { get; set; }

        public string DealerName { get; set; }

        public string BRMName { get; set; }

        public string BRMEmail { get; set; }

        public string Weeks { get; set; }

        public string Comments { get; set; }
    }


    public class SellThroughRequestAuditDto
    {
        public DateTime WeekEnding { get; set; }

        public string ContactEmail { get; set; }

        public string RequestedBy { get; set; }

        public DateTime RequestedDate { get; set; }
    }


    public class SellThroughExportRequest
    {
        public List<string> Weeks { get; set; }

        public List<int> Accounts { get; set; }

        public string EmailTo { get; set; }

        public string Comments { get; set; }
    }

    public class SellThroughExportDto
    {
        public int Account { get; set; }

        public string DBA { get; set; }

        public DateTime WeekEnding { get; set; }

        public string ProductCode { get; set; }

        public int Sales { get; set; }

        public int Inventory { get; set; }
    }

    public class SellThroughExportEmailRequest
    {
        public string EmailTo { get; set; }

        public string Comments { get; set; }

        public string FileName { get; set; }

        public string Base64File { get; set; }

        public List<string> Weeks { get; set; }

        public List<string> Dealers { get; set; }

        public List<SellThroughMissingDealerDto>
            MissingDealers
        {
            get;
            set;
        }

    }


    public class SellThroughMissingDealerDto
    {
        public int Account { get; set; }

        public string MemberName { get; set; }

        public string MissingWeeks { get; set; }
    }
}
