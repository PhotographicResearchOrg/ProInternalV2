using System;

namespace ProInternal.Models.Vendor
{
    public class VendorFileDto
    {
        public string FileName { get; set; } = "";
        public long SizeBytes { get; set; }
        public DateTime UploadedUtc { get; set; }
    }
}
