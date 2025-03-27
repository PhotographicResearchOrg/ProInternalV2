using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ProInternal
{

    public class AppConfigurations
    {
        public Jwt Jwt { get; set; }
        public string FilePath { get; set; }
        public string InvoiceLocation { get; set; }
    }


    public class Jwt
    {
        public string Issuer { get; set; }
        public string Secret { get; set; }
    }


    public class EmailAddress
    {
        public string Address { get; set; }
        public string Name { get; set; }
    }


}
