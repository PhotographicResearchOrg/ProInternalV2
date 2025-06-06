using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ProInternal.Models.Configuration;
using ProInternal.Models.Auth;
using Newtonsoft.Json;


namespace ProInternal.Models.Auth
{
    public class JwtToken
    {
        public static string GetToken(LoginResponse user, AppConfigurations appConfig)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(appConfig.Jwt.Secret));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.User.Username),
        new Claim("userId", user.User.UserId.ToString()),
        new Claim("permissions", JsonConvert.SerializeObject(user.Permissions)),
        new Claim("userLastName", user.User.LastName ?? string.Empty)
    };

            // ✅ Safe addition: include each role as a ClaimTypes.Role entry
            if (user.Roles != null && user.Roles.Any())
            {
                claims.AddRange(user.Roles.Select(role => new Claim(ClaimTypes.Role, role)));
            }

            var token = new JwtSecurityToken(
                issuer: appConfig.Jwt.Issuer,
                audience: appConfig.Jwt.Issuer,
                claims: claims,
                expires: DateTime.Now.AddMinutes(120),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }



    }

}
