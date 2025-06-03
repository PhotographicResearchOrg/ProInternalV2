using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Services;
using ProInternal.Models.Auth;
using ProInternal.Models.Dashboard;
using Microsoft.AspNetCore.Cors;
using Newtonsoft.Json.Linq;
using ProInternal.Models.Configuration;
using Newtonsoft.Json;
using Microsoft.AspNetCore.DataProtection;


namespace ProInternal.Controllers
{
    [Route("api/[controller]")]

    [ApiController]
    [AllowAnonymous]
    public class AuthController : ControllerBase
    {
        private IProDataAccess _proDataAccess;
        private AppConfigurations _appConfig;


        public AuthController(IProDataAccess proDataAccess, IOptions<AppConfigurations> appConfigurations )
        {
            _proDataAccess = proDataAccess;
            _appConfig = appConfigurations.Value;
        }


        [HttpPost("login")]
        public IActionResult Login([FromBody] AuthCredentials authCredentials)
        { 
            IActionResult response = Unauthorized();

            LoginResponse Login = this._proDataAccess.login(authCredentials.username, authCredentials.password);    
            
            if (Login.User == null)
            {
               return new JsonResult(new { error = "Invalid username or password" });
            }

            var token = JwtToken.GetToken(Login, _appConfig);
            var Perms = JsonConvert.SerializeObject(Login.Permissions);

           // catch { }
            return new JsonResult(new { token = token });
        }

    }
}
