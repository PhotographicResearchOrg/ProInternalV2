using System.ComponentModel.DataAnnotations;

namespace ProInternal.Models.Accounting
{


    public class MemberMatchDto
    {
        public string AccountNumber { get; set; } = null!;
        public string? Company { get; set; }
        public string? DBA { get; set; }
    }


    public class VendorMatchDto
    {
        public string VendorId { get; set; }
        public string Name { get; set; }
    }


    public class VendorBillingBatchRequestDto
    {
        [Required]
        public List<VendorBillingRequestDto> OrderDetails { get; set; }
    }

    public class VendorBillingRequestDto
    {

        public bool EZPay { get; set; }
        public InvoiceExtractionPreviewDto? ExtractionPreview { get; set; }
        public string VendorInv { get; set; }         // 🔑 FIX #1
        public DateTime? VendInvDate { get; set; }    // 🔑 FIX #2
        public DateTime?  BillDate { get; set; }
        public string VendorID { get; set; }
        public string ProID { get; set; }
        public decimal Amount { get; set; }
        public DateTime? OrderDate { get; set; }
        public string Terms { get; set; }
        public string FutureBilling { get; set; }

        public DateTime? VendorDueDate { get; set; }
        public decimal Discount { get; set; }
        public string PO { get; set; }
        public List<string> FileNames { get; set; } = new();
        public string Description { get; set; }
    }




    public class VendorInvoiceLearningDto
    {
        public int Id { get; set; }           // optional for upsert
        public int VendorId { get; set; }
        public string FieldName { get; set; } = null!;
        public string Strategy { get; set; } = null!;
        public string Pattern { get; set; } = null!;
        public bool Active { get; set; } = true;
        public string ResolvedValue { get; set; } = null!;
        
    }

    public class VendorDto
    {
        public int VendorId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? BillingTerms { get; set; }
        public string? Address { get; set; }
    }

    public class InvoiceExtractionPreviewDto
    {
        // Raw context
        public string RawText { get; set; } = string.Empty;

        // AI-extracted invoice facts
        public string? InvoiceNumber { get; set; }
        public string? PONumber { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? OrderDate { get; set; }
        public decimal? TotalAmount { get; set; }

        // AI-extracted names (non-authoritative)
        public string? VendorName { get; set; }
        public string? MemberName { get; set; }
        public string? ShippingCompany { get; set; }

        // DB-resolved truth (IMPORTANT)
        public int? SuggestedVendorId { get; set; }
        public decimal VendorConfidence { get; set; }

        public int? SuggestedMemberId { get; set; }
        public decimal MemberConfidence { get; set; }

        // Confidence
        public int Confidence { get; private set; }
        public List<string> MissingFields { get; private set; } = new();

        public void CalculateConfidence()
        {
            MissingFields.Clear();
            int score = 0;

            if (!string.IsNullOrWhiteSpace(InvoiceNumber)) score += 20;
            else MissingFields.Add(nameof(InvoiceNumber));

            if (!string.IsNullOrWhiteSpace(PONumber)) score += 15;
            else MissingFields.Add(nameof(PONumber));

            if (InvoiceDate.HasValue) score += 15;
            else MissingFields.Add(nameof(InvoiceDate));

            if (DueDate.HasValue) score += 15;
            else MissingFields.Add(nameof(DueDate));

            if (OrderDate.HasValue) score += 10;
            else MissingFields.Add(nameof(OrderDate));

            if (TotalAmount.HasValue) score += 25;
            else MissingFields.Add(nameof(TotalAmount));

            Confidence = score;
        }
    }



}