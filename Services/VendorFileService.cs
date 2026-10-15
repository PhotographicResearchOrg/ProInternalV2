using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using ProInternal.Models.Vendor;
using ProInternal.Services.Files;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services
{
    /*
     * Vendor documents (contracts, price lists) in the shared S3 file library
     * (piv2.FileLibrary, bucket FileLibrary:Bucket):
     *   category VENDOR_CONTRACT or VENDOR_PRICE_LIST, owner = the vendor id.
     * The vendor card still works by file name; a name already in use for the
     * vendor gets " (2)", " (3)" ... Removing a file hides it; it stays in S3.
     */
    public class VendorFileService : IVendorFileService
    {
        public const string ContractsCategory = "contracts";
        public const string PriceListsCategory = "price-lists";

        private readonly IFileLibrary _files;
        private readonly ILogger<VendorFileService> _logger;

        public VendorFileService(IFileLibrary files, ILogger<VendorFileService> logger)
        {
            _files = files;
            _logger = logger;
        }

        public bool IsValidCategory(string category) =>
            category == ContractsCategory || category == PriceListsCategory;

        public string AuditSection(string category) =>
            category == ContractsCategory ? "Contracts" : "Price Lists";

        private static string LibraryCategory(string category) =>
            category == ContractsCategory ? "VENDOR_CONTRACT" : "VENDOR_PRICE_LIST";

        private static string Owner(int vendorId) => vendorId.ToString(CultureInfo.InvariantCulture);

        public async Task<List<VendorFileDto>> ListFilesAsync(int vendorId, string category)
        {
            var rows = await _files.ListAsync(LibraryCategory(category), Owner(vendorId), 500);
            return rows
                .Select(f => new VendorFileDto { FileId = f.FileId, FileName = f.FileName, SizeBytes = f.SizeBytes, UploadedUtc = f.UploadedAt, UploadedBy = f.UploadedBy })
                .OrderByDescending(f => f.UploadedUtc)
                .ToList();
        }

        public async Task<List<string>> SaveFilesAsync(int vendorId, string category, IEnumerable<IFormFile> files, string uploadedBy, CancellationToken ct)
        {
            var inUse = new HashSet<string>((await ListFilesAsync(vendorId, category)).Select(f => f.FileName), StringComparer.OrdinalIgnoreCase);
            var saved = new List<string>();

            foreach (var file in files)
            {
                ct.ThrowIfCancellationRequested();
                var name = CleanFileName(file.FileName);
                if (name.Length == 0 || file.Length == 0) continue;

                var unique = UniqueName(inUse, name);
                await using var source = file.OpenReadStream();
                var entry = await _files.StoreAsync(source, LibraryCategory(category), Owner(vendorId), unique,
                    string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType, uploadedBy);

                /* The same content already on file for this vendor is kept once, under its first name. */
                _logger.LogInformation("Vendor {VendorId} {Category} file {Name} stored as file {FileId}{Dup}",
                    vendorId, category, entry.FileName, entry.FileId, entry.IsDuplicate ? " (already on file)" : "");
                inUse.Add(entry.FileName);
                saved.Add(entry.FileName);
            }
            return saved;
        }

        public async Task<(Stream Content, string ContentType, string FileName)?> OpenAsync(int vendorId, string category, string fileName)
        {
            var entry = await FindAsync(vendorId, category, fileName);
            if (entry == null) return null;
            return (await _files.OpenAsync(entry.FileId), entry.ContentType, entry.FileName);
        }

        public async Task<bool> DeleteFileAsync(int vendorId, string category, string fileName, string removedBy)
        {
            var entry = await FindAsync(vendorId, category, fileName);
            return entry != null && await _files.RemoveAsync(entry.FileId, removedBy);
        }

        private async Task<VendorFileDto?> FindAsync(int vendorId, string category, string fileName)
        {
            var name = CleanFileName(fileName);
            if (name.Length == 0) return null;
            var match = (await ListFilesAsync(vendorId, category))
                .FirstOrDefault(f => string.Equals(f.FileName, name, StringComparison.OrdinalIgnoreCase));
            if (match == null) return null;
            var entry = await _files.GetAsync(match.FileId);
            return entry == null ? null : new VendorFileDto { FileId = entry.FileId, FileName = entry.FileName, SizeBytes = entry.SizeBytes, UploadedUtc = entry.UploadedAt, UploadedBy = entry.UploadedBy, ContentType = entry.ContentType };
        }

        private static string CleanFileName(string? raw)
        {
            var name = Path.GetFileName(raw ?? "");
            var invalid = Path.GetInvalidFileNameChars();
            name = new string(name.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
            return name.Trim().TrimEnd('.');
        }

        private static string UniqueName(HashSet<string> inUse, string fileName)
        {
            if (!inUse.Contains(fileName)) return fileName;
            var stem = Path.GetFileNameWithoutExtension(fileName);
            var ext = Path.GetExtension(fileName);
            for (var i = 2; ; i++)
            {
                var candidate = $"{stem} ({i}){ext}";
                if (!inUse.Contains(candidate)) return candidate;
            }
        }
    }
}
