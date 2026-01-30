using System.Drawing;

namespace ProInternal.Models.Accounting
{






    public class MemberDto
    {
        public string Account { get; set; } = "";
        public string Name { get; set; } = "";
        public string Address1 { get; set; } = "";
        public string? Address2 { get; set; }
        public string City { get; set; } = "";
        public string State { get; set; } = "";
        public string Zip { get; set; } = "";
    }


    public class EmailSettings
    {
        public string From { get; set; }
        public string GmailUser { get; set; }
        public string GmailAppPassword { get; set; }
        public string SmtpHost { get; set; }
        public int SmtpPort { get; set; }
        public bool UseSsl { get; set; }
    }

    public class AccountingFile
    {
        public string FileId { get; set; }          // SHA256
        public string StoredName { get; set; }      // {hash}.{ext}
        public string OriginalName { get; set; }
        public DateTime CreatedAt { get; set; }
    }


    public enum CreditSource
    {
        Standard = 1,
        VendorBilling = 2
    }

    public class CreditBatchRequestDto
    {
        public List<CreditRequestDto> OrderDetails { get; set; } = new();
    }


    public class CreditRequestDto   

    {

        public CreditSource Source { get; set; } = CreditSource.Standard;
        // Set in controller, NOT from UI
        public int BatchID { get; set; }

        public string PostingAccount { get; set; } = "1320";

        public Guid BatchGuid { get; set; }
        public List<string> FileIds { get; set; } = new();

        public string Account { get; set; }
        // Required
        public string ProID { get; set; }
        public decimal Amount { get; set; }
        public DateTime? OrderDate { get; set; }
        public string Description { get; set; } = null!;

        // Optional
        public string PO { get; set; } = "";
        public string? VendorInvoice { get; set; }

        // Files
        public List<string> FileNames { get; set; } = new();

        // Flags  FileIds: string[];
        public bool EZPay { get; set; }

        public int  Module { get; set; } = 1;

        public string VendorID { get; set; }

        public DateTime? BillDate { get; set; }
        public string Terms { get; set; }
        public string FutureBilling { get; set; }

        public DateTime? VendInvDate { get; set; }
        public DateTime? VendorDueDate { get; set; }

        public decimal Discount { get; set; }

    }





    public class InvoiceEmailRequest
    {
        public string InvoiceNumber { get; set; }
        public string To { get; set; }
        public string Note { get; set; }
    }


    public class AccountingCreditFileDto
    {
        public string FileId { get; set; }
        public string OriginalName { get; set; }
    }

    public class AccountingCreditDto
    {


        public List<AccountingCreditFileDto> Files { get; set; } = new();

        public string PostingAccount { get; set; }

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
        public string VendorId { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
        public string? Phone { get; set; }
        public string? Website { get; set; }

    }

}
