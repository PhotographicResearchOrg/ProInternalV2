using Microsoft.AspNetCore.Http;
using ProInternal.Models.Vendor;
using System.Collections.Generic;
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

        List<VendorFileDto> ListFiles(int vendorId, string category);

        // Returns the file names as actually saved (renamed on collision).
        Task<List<string>> SaveFilesAsync(int vendorId, string category, IEnumerable<IFormFile> files, CancellationToken ct);

        (string FullPath, string ContentType, string FileName) ResolveForDownload(int vendorId, string category, string fileName);

        bool DeleteFile(int vendorId, string category, string fileName);
    }
}
