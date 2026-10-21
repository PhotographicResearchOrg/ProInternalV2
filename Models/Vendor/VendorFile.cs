using System;

namespace ProInternal.Models.Vendor
{
    public class VendorFileDto
    {
        public long FileId { get; set; }
        public string FileName { get; set; } = "";
        public long SizeBytes { get; set; }
        public DateTime UploadedUtc { get; set; }
        public string UploadedBy { get; set; } = "";
        [System.Text.Json.Serialization.JsonIgnore]
        public string ContentType { get; set; } = "";
    }
}
