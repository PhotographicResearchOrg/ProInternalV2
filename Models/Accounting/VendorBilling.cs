using System.ComponentModel.DataAnnotations;

namespace ProInternal.Models.Accounting
{

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
    }


    public class InvoiceExtractionPreviewDto
        {
            public string RawText { get; set; } = string.Empty;

            public string? MemberName { get; set; }
            public string? ShippingCompany { get; set; }
            public string? InvoiceNumber { get; set; }
            public string? PONumber { get; set; }
            public DateTime? InvoiceDate { get; set; }
            public DateTime? DueDate { get; set; }
            public DateTime? OrderDate { get; set; }
            public decimal? TotalAmount { get; set; }

            public int Confidence { get; private set; }
            public List<string> MissingFields { get; private set; } = new();

            public void CalculateConfidence()
            {
                int score = 0;

                if (!string.IsNullOrWhiteSpace(InvoiceNumber)) score += 20;
                if (!string.IsNullOrWhiteSpace(PONumber)) score += 15;
                if (InvoiceDate.HasValue) score += 15;
                if (DueDate.HasValue) score += 15;
                if (OrderDate.HasValue) score += 10;
                if (TotalAmount.HasValue) score += 25;

                if (InvoiceNumber == null) MissingFields.Add(nameof(InvoiceNumber));
                if (PONumber == null) MissingFields.Add(nameof(PONumber));
                if (!InvoiceDate.HasValue) MissingFields.Add(nameof(InvoiceDate));
                if (!DueDate.HasValue) MissingFields.Add(nameof(DueDate));
                if (!OrderDate.HasValue) MissingFields.Add(nameof(OrderDate));
                if (!TotalAmount.HasValue) MissingFields.Add(nameof(TotalAmount));

                Confidence = score;
            }
        }
    }