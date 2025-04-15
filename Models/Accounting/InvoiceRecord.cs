using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ProInternal.Models.InvoiceRecord
{
    public class InvoiceRecord
    {
        public int Account { get; set; }
        public string AccountName { get; set; }
        public DateTime BillDate { get; set; }

        public DateTime? PaidDate { get; set; }

        public decimal Amount { get; set; }
    }
}
