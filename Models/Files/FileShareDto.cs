namespace ProInternal.Models.Files
{
    public class FileShareDto
    {
        public int FileShareId { get; set; }
        public string DisplayName { get; set; } = "";
        public string UncPath { get; set; } = "";
        public bool IsActive { get; set; }
    }
}