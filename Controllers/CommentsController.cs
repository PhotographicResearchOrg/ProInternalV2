using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using ProInternal.Helpers;
using ProInternal.Models.Dashboard;
using ProInternal.Services;
using System.Security.Cryptography;
using System.Text;



namespace ProInternal.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CommentsController : ControllerBase
    {
        private readonly AwsSecretHelper _secretHelper;
        private readonly IConfiguration _configuration;

        public CommentsController(IConfiguration configuration, AwsSecretHelper secretHelper)
        {
            _configuration = configuration;
            _secretHelper = secretHelper;
        }

        [HttpGet("monitor")]
        public async Task<IActionResult> GetMonitoredComments()
        {
            var comments = new List<Comment>();
            var baseConn = _configuration.GetConnectionString("SQLII");
            var connStr = await _secretHelper.GetConnectionString(baseConn);




            using (var conn = new SqlConnection(connStr))
            {
                await conn.OpenAsync();
                var cmd = new SqlCommand("SELECT TOP 5 comment, author_name, avatarUrl, author_email, created_at, updated_at, article_name, excerpt, published_at FROM AuditComments", conn);
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        var email = reader["author_email"].ToString();

                        comments.Add(new Comment
                        {
                            comment = reader["comment"].ToString(),
                            authorname = reader["author_name"].ToString(),
                            avatarUrl =  GetGravatarUrl(email),
                            created = reader["created_at"] as DateTime?,
                            updated = reader["updated_at"] as DateTime?,
                            articleName = reader["article_name"].ToString(),
                            excerpt = reader["excerpt"].ToString(),
                            articlePublishedAt = reader["published_at"] as DateTime?,
                            authoremail = reader["author_email"].ToString()
                        });
                    }
                }
            }

            return Ok(comments);
        }


        string GetGravatarUrl(string email, int size = 50)
        {
            using (var md5 = MD5.Create())
            {
                var emailBytes = Encoding.UTF8.GetBytes(email.Trim().ToLower());
                var hashBytes = md5.ComputeHash(emailBytes);
                var sb = new StringBuilder();
                foreach (var b in hashBytes)
                {
                    sb.Append(b.ToString("x2"));
                }
                return $"https://www.gravatar.com/avatar/{sb}?s={size}&d=identicon";
            }
        }

    }

}
