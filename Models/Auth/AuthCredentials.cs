namespace ProInternal.Models.Auth
{
    public class AuthCredentials
    {
        public string username { get; set; }
        public string password { get; set; }
    }

    public class Jwt
    {
        public string Issuer { get; set; }
        public string Secret { get; set; }
    }


}
