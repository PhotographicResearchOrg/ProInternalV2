using Microsoft.AspNetCore.Http;
using ProInternal.Models.Accounting;
using System.Threading.Tasks;

namespace ProInternal.Services
{
    public interface IInvoiceExtractionService
    {
        Task<InvoiceExtractionPreviewDto> ExtractPreviewAsync(IFormFile file);
        InvoiceExtractionPreviewDto ApplyVendorLearning(InvoiceExtractionPreviewDto dto, string rawText, int vendorId
        );
        void DetectAndSaveVendorLearning(
        InvoiceExtractionPreviewDto extracted,
        VendorBillingRequestDto final,
        int vendorId,
        string rawText
    );

    }
}
