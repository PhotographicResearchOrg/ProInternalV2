using System; 

namespace ProInternal.Models.Files
{
    public class FileSystemEntry
    {
        public string Name { get; set; } = "";
        public string RelativePath { get; set; } = "";
        public bool IsFolder { get; set; }
        public long SizeBytes { get; set; }
        public DateTime ModifiedUtc { get; set; }
    }
}