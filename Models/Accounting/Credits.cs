namespace ProInternal.Models.Accounting
{


    public class CreditBatchRequestDto
    {
        public List<CreditRequestDto> OrderDetails { get; set; } = new();
    }


    public class CreditRequestDto
    {
        // Set in controller, NOT from UI
        public int BatchID { get; set; }

        

        public string Account { get; set; }
        // Required
        public string ProID { get; set; }
        public decimal Amount { get; set; }
        public DateTime OrderDate { get; set; }
        public string Description { get; set; } = null!;

        // Optional
        public string PO { get; set; } = "";
        public string? VendorInvoice { get; set; }

        // Files
        public List<string> FileNames { get; set; } = new();

        // Flags
        public bool EZPay { get; set; }

        public int  Module { get; set; } = 1;
    }



    public class VendorBillingRequestDto
    {

        public string VendorInv { get; set; }         // 🔑 FIX #1
        public DateTime? VendInvDate { get; set; }    // 🔑 FIX #2

        public string VendorID { get; set; }
        public string ProID { get; set; }
        public decimal Amount { get; set; }
        public DateTime OrderDate { get; set; }
        public string Terms { get; set; }
        public string FutureBilling { get; set; }
        public string VendorInvoice { get; set; }
        public DateTime? VendorInvoiceDate { get; set; }
        public DateTime? VendorDueDate { get; set; }
        public decimal Discount { get; set; }
        public string PO { get; set; }
        public List<string> FileNames { get; set; } = new();
        public string Description { get; set; }
    }

    public class AccountingCreditDto
    {
        public int ID { get; set; }
        public int BatchID { get; set; }
        public string Module { get; set; }          // "1" = Credit, "2" = Vendor Billing

        public int PROID { get; set; }
        public string Account { get; set; }

        public decimal Amount { get; set; }
        public DateTime Date { get; set; }

        public string Description { get; set; }
        public string FileName { get; set; }
        public string InvoiceNumber { get; set; }
        public string Status { get; set; }

        public string PO { get; set; }
        public string VendorPO { get; set; }

        public int? VendorID { get; set; }
        public string Terms { get; set; }
        public string FutureBilling { get; set; }
        public string VendorInv { get; set; }

        public DateTime? VendInvDate { get; set; }
        public DateTime? VendorDueDate { get; set; }

        public decimal? Discount { get; set; }

        public string UserEntered { get; set; }
    }

    public class MemberLookupDto
    {
        public string ID { get; set; }     // ARMST.ID
        public string HNAME { get; set; }  // ARMST.HNAME
    }

    public class VendorLookupDto
    {
        public string ID { get; set; }     // APMST.ID
        public string NAME { get; set; }   // APMST.NAME
    }

}
