using Azure.Core;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Client;
using ProInternal.Services;

namespace ProInternal.Controllers
{

    [ApiController]
    [Route("api/[controller]")]

    public class PowerBIController : ControllerBase
    {

        private readonly PowerBIService _powerBIService;

        public PowerBIController(PowerBIService powerBIService)
        {
            _powerBIService = powerBIService;
        }

        [HttpGet]
        [Route("token")]
        public async Task<IActionResult> GetToken()
        {
            var (token, embedUrl, reportId) = await _powerBIService.GetEmbedConfigAsync();
            return Ok(new { token, embedUrl, reportId });
        }

    }
}
