using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ProInternal.Models.Outstanding
{
    public class OutstandingAccount
    {
        public int AccountNumber { get; set; }
        public string AccountName { get; set; }
        public DateTime BillDate { get; set; }
        public DateTime? PaidDate { get; set; }
        public decimal? GrossOutstanding { get; set; }
        public decimal? DAYS30 { get; set; }
        public decimal?  DAYS60 { get; set; }
        public decimal? DAYS90 { get; set; }
        public decimal? InvoiceDateDue { get; set; }
        

    }

    public class OutstandingInvoice
    {
        public string  invoiceNumber { get; set; }
        public string invoiceDate { get; set; }
        public string dueDate { get; set; }
        public decimal? amount { get; set; }
        public decimal? balance { get; set; }
        public string status { get; set; }
        public string term { get; set; }
        public int? DaysUntilDue { get; set; }



    }




}
