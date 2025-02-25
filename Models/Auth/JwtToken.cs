using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ProInternal.Models.Configuration;






namespace ProInternal.Models.Auth
{
    public class JwtToken
    {
        public static string GetToken(User user, AppConfiguration appConfig)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(appConfig.Jwt.Secret));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(appConfig.Jwt.Issuer,       
            appConfig.Jwt.Issuer,
            expires: DateTime.Now.AddMinutes(120),
            signingCredentials: credentials);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }


        public static void ResetCartId(int cartId, HttpContext context, AppConfiguration appConfig)
        {
            ClaimsPrincipal principal = context.User;
            var userName = principal?.Claims?.SingleOrDefault(p => p.Type == "UserName")?.Value;
            var email = principal?.Claims?.SingleOrDefault(p => p.Type == "Email")?.Value;
            var name = principal?.Claims?.SingleOrDefault(p => p.Type == "Name")?.Value;
            var companyId = principal?.Claims?.SingleOrDefault(p => p.Type == "CompanyId")?.Value;
            var accountNumber = principal?.Claims?.SingleOrDefault(p => p.Type == "AccountNumber")?.Value;
            var userId = principal?.Claims?.SingleOrDefault(p => p.Type == "UserId")?.Value;
            var memberType = principal?.Claims?.SingleOrDefault(p => p.Type == "MemberType")?.Value;
            var permissions = principal?.Claims?.SingleOrDefault(p => p.Type == "Permissions")?.Value;
            var vendors = principal?.Claims?.SingleOrDefault(p => p.Type == "Vendors")?.Value;



            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(appConfig.Jwt.Secret));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(appConfig.Jwt.Issuer,
                appConfig.Jwt.Issuer,
                expires: DateTime.Now.AddMinutes(120),
                signingCredentials: credentials);
            string newToken = new JwtSecurityTokenHandler().WriteToken(token);
            context.Response.Headers.Add("New-Token", newToken);
        }


 

    }

}
