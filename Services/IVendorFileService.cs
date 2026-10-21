using Microsoft.AspNetCore.Http;
using ProInternal.Models.Vendor;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services
{
    public interface IVendorFileService
    {
        // category is the URL slug: "contracts" or "price-lists"
        bool IsValidCategory(string category);

        // Section name used in the vendor audit log ("Contracts" / "Price Lists")
        string AuditSection(string category);

        Task<List<VendorFileDto>> ListFilesAsync(int vendorId, string category);

        // Returns the file names as stored (a name already in use gets " (2)", " (3)" ...).
        Task<List<string>> SaveFilesAsync(int vendorId, string category, IEnumerable<IFormFile> files, string uploadedBy, CancellationToken ct);

        // The newest file of that name; null when there is none.
        Task<(Stream Content, string ContentType, string FileName)?> OpenAsync(int vendorId, string category, string fileName);

        Task<bool> DeleteFileAsync(int vendorId, string category, string fileName, string removedBy);
    }
}
