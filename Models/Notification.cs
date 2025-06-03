namespace ProInternal.Models
{
    public class Notification
    {
        public int Id { get; set; }
        public string Message { get; set; }

        public string? Type { get; set; } // "info", "warning", "success", "error"
        public DateTime? Timestamp { get; set; }

        public string? Route { get; set; } // e.g., "/rebates/pending"

        public bool IsRead { get; set; } = false;
    }
}

