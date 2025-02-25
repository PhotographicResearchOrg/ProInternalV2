namespace ProInternal.Models.Dashboard
{
    public class OrdersMetrics
    {
        public int openOrders       { get; set; }
        public int onHoldOrders     { get; set; }
        public int specialsOrders   { get; set; }
        public int dropShipOrders   { get; set; }
        public DateTime lastRunTime { get; set; }
        public DateTime OldestOnHold { get; set; }
        public int threshold { get; set; }


    }

    public class SARSMetrics
    {
        public int TotalInQueue { get; set; }
        public int PROHoldInQueue { get; set; }
        public int MemCreditsInQueue { get; set; }
        public DateTime oldestInQueue { get; set; }

        
    }


    public class EDIMetrics
    {
        public int openEDIOrders { get; set; }
        public int EDIAlertThreshold { get; set; }
        public DateTime oldestInQueue { get; set; }

    }




    public class IRMetrics
    {
        public int IRSInQueue { get; set; }
        public int Threshold { get; set; }
        public DateTime oldestInQueue { get; set; }

    }

    public class ShippingErrorMetrics
    {
        public int openShippingErrors { get; set; }
        public int Threshold { get; set; }
        public DateTime oldestInQueue { get; set; }
    }


    public class CommecntsMetrics
    {
        public int unresponded { get; set; }
        public DateTime recentCommentDate { get; set; }
    }
}
