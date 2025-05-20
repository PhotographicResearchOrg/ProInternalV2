using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace ProInternal.Models.EzPaySummary
{
    public class EzPaySummary
    {
        public string account { get; set; }
        public decimal ezpay { get; set; }
        public decimal ezpayNet { get; set; }
        public decimal gross { get; set; }
        public decimal discount { get; set; }
        public decimal net { get; set; }
        public string company { get; set; }
        public string autoPay { get; set; }
    }

    public class EzPayDetail
    {
        public string invoice { get; set; }
        public string date { get; set; }
        public string vendor { get; set; }
        public string vendorInvoice { get; set; }
        public string account { get; set; }
        public string Name { get; set; }
        public decimal gross { get; set; }
        public decimal discount { get; set; }
        public decimal net { get; set; }
        public decimal ezpay { get; set; }
        public decimal ezpayNet { get; set; }
        public string receipt { get; set; }
    }
}