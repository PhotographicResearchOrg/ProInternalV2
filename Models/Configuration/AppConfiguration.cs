using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;


namespace ProInternal.Models.Configuration
{
    public class AppConfiguration
    {
        public Jwt Jwt { get; set; }

        public string threshold { get; set; }
    }


    public class Jwt
    {
        public string Issuer { get; set; }
        public string Secret { get; set; }
    }


}
