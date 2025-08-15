using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ProInternal.Models.Accounting
{
    public class QuarterlyRebate
    {
        public string CheckDate { get; set; }
        public float Total { get; set; }
        public string? YearQuarter { get; set; }
        

    }

    public class QuarterlyDataSummary
    { 
        public string programName { get; set; }
        public Double totalAmount { get; set; }
        public DateTime? issueDate { get; set; }

        public int? batchID { get; set; }
        public int? programID { get; set; }


    }

    public class PaymentType
    {
        public string AccountNumber { get; set; }
        public string Dba { get; set; }
        public string PaymentTypeName { get; set; }  // rename if "PaymentType" as property name clashes with class name
    }





    public class QuarterlyDataHistorical
    {
        public string qrPeriod { get; set; }
        public Double totalAmount { get; set; }
        public DateTime? issueDate { get; set; }
        public int id { get; set; }
        public bool  active { get; set; }

    }


    public class qrDetail
    {
        public int batchID { get; set; }
        public string accountNumber { get; set; }
        public string QuarterlyRebateProgram { get; set; }
        public string DBA { get; set; }
        public Double totalAmount { get; set; }
        public DateTime? issueDate { get; set; }

    }

}
