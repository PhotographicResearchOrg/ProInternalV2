namespace ProInternal.Models.Dashboard
{
    public class Comment
    {
    public string comment { get; set; }
    public string authorname { get; set; }
    public string authoremail { get; set; }
    public DateTime? created { get; set; } 
    public DateTime? updated { get; set; }
    public string articleName { get; set; }
    public string excerpt { get; set; }
    public DateTime? articlePublishedAt { get; set; }
    public string avatarUrl { get; set; }


    }

}