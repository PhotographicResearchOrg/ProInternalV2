using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using ProInternal.Services;
using ProInternal.Models.Auth;
using ProInternal.Models.Dashboard;
using Microsoft.AspNetCore.Cors;
using Newtonsoft.Json.Linq;
using ProInternal.Models.Configuration;


namespace ProInternal.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
 
    public class AuthController : ControllerBase
    {
        private IProDataAccess _proDataAccess;
        private AppConfiguration _appConfig;

        public AuthController(IProDataAccess proDataAccess, AppConfiguration appConfigurations)
        {
            _proDataAccess = proDataAccess;
            _appConfig = appConfigurations;
        }


        [HttpPost]
        public IActionResult Login([FromBody] AuthCredentials authCredentials)
        {
     
            IActionResult response = Unauthorized();

            var user = this._proDataAccess.login(authCredentials.username, authCredentials.password);
             
            if (user == null)
            {
                return new JsonResult(new { error = "Invalid username or password" });
            }


            var token = JwtToken.GetToken(user, _appConfig);


            try
            {

                var cookieOptions = new Microsoft.AspNetCore.Http.CookieOptions();
                cookieOptions.Expires = DateTime.Now.AddDays(1);
                cookieOptions.Path = "/";
                cookieOptions.Domain = ".PROINTERNAL.COM";
                Response.Cookies.Append("ProSession", user.Username, cookieOptions);
            }
            catch { }

            return new JsonResult(new { token = token });
        }



    }
}
