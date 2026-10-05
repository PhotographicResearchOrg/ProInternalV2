using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProInternal.Helpers;
using ProInternal.Models.Vendor;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services
{
    // Stores vendor documents on the share configured under "VendorFiles":
    //   <RootPath>\<vendor id>\Contracts\...
    //   <RootPath>\<vendor id>\Price Lists\...
    // Every path is resolved through SafePath so names can't escape the root.
    public class VendorFileService : IVendorFileService
    {
        public const string ContractsCategory = "contracts";
        public const string PriceListsCategory = "price-lists";

        private readonly VendorFileOptions _options;
        private readonly ILogger<VendorFileService> _logger;

        public VendorFileService(IOptions<VendorFileOptions> options, ILogger<VendorFileService> logger)
        {
            _options = options.Value;
            _logger = logger;
        }

        public bool IsValidCategory(string category) =>
            category == ContractsCategory || category == PriceListsCategory;

        public string AuditSection(string category) =>
            category == ContractsCategory ? "Contracts" : "Price Lists";

        public List<VendorFileDto> ListFiles(int vendorId, string category)
        {
            var dir = new DirectoryInfo(CategoryFolder(vendorId, category));
            if (!dir.Exists) return new List<VendorFileDto>();

            return dir.EnumerateFiles()
                .Select(f => new VendorFileDto { FileName = f.Name, SizeBytes = f.Length, UploadedUtc = f.LastWriteTimeUtc })
                .OrderByDescending(f => f.UploadedUtc)
                .ToList();
        }

        public async Task<List<string>> SaveFilesAsync(int vendorId, string category, IEnumerable<IFormFile> files, CancellationToken ct)
        {
            var folder = CategoryFolder(vendorId, category);
            Directory.CreateDirectory(folder);

            var saved = new List<string>();
            foreach (var file in files)
            {
                var name = CleanFileName(file.FileName);
                if (name.Length == 0) continue;

                var dest = UniquePath(folder, name);
                await using (var target = new FileStream(dest, FileMode.CreateNew, FileAccess.Write, FileShare.None, 1 << 20, FileOptions.Asynchronous))
                await using (var source = file.OpenReadStream())
                {
                    await source.CopyToAsync(target, ct);
                }

                _logger.LogInformation("Vendor file upload {Dest} ({Bytes} bytes)", dest, file.Length);
                saved.Add(Path.GetFileName(dest));
            }
            return saved;
        }

        public (string FullPath, string ContentType, string FileName) ResolveForDownload(int vendorId, string category, string fileName)
        {
            var full = FilePath(vendorId, category, fileName);
            if (!File.Exists(full)) throw new FileNotFoundException(fileName);
            return (full, MimeTypes.GetMimeType(full), Path.GetFileName(full));
        }

        public bool DeleteFile(int vendorId, string category, string fileName)
        {
            var full = FilePath(vendorId, category, fileName);
            if (!File.Exists(full)) return false;

            File.Delete(full);
            _logger.LogInformation("Vendor file deleted {Path}", full);
            return true;
        }

        // ---- path helpers ----

        private string CategoryFolder(int vendorId, string category)
        {
            if (string.IsNullOrWhiteSpace(_options.RootPath))
                throw new InvalidOperationException("VendorFiles:RootPath is not configured.");

            var sub = category == ContractsCategory ? _options.ContractsFolder : _options.PriceListsFolder;
            return SafePath.Resolve(_options.RootPath, Path.Combine(vendorId.ToString(CultureInfo.InvariantCulture), sub));
        }

        private string FilePath(int vendorId, string category, string fileName)
        {
            var name = CleanFileName(fileName);
            if (name.Length == 0) throw new FileNotFoundException(fileName);

            var folder = CategoryFolder(vendorId, category);
            return SafePath.Resolve(folder, name);
        }

        // Swap out characters Windows won't allow in a file name and trim trailing dots.
        private static string CleanFileName(string? raw)
        {
            var name = Path.GetFileName(raw ?? "");
            var invalid = Path.GetInvalidFileNameChars();
            name = new string(name.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
            return name.Trim().TrimEnd('.');
        }

        private static string UniquePath(string folder, string fileName)
        {
            var path = Path.Combine(folder, fileName);
            if (!File.Exists(path)) return path;

            var stem = Path.GetFileNameWithoutExtension(fileName);
            var ext = Path.GetExtension(fileName);
            for (var i = 2; ; i++)
            {
                path = Path.Combine(folder, $"{stem} ({i}){ext}");
                if (!File.Exists(path)) return path;
            }
        }
    }
}
