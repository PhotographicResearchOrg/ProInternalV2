#nullable disable
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using ProInternal.Helpers.Security;
using ProInternal.Services;

namespace ProInternal.Controllers
{
    /*
     * Home page: each person's choice of tiles (piv2.UserSetting, key 'home.tiles').
     *   GET    api/home/layout     { json: "..." | null }   null = the default set
     *   PUT    api/home/layout     { json: "..." }           save
     *   DELETE api/home/layout                               back to the default
     * Tiles only show for screens the person can open; that check is on the client, from Security Admin routes.
     */
    [Authorize]
    [ApiController]
    [Route("api/home")]
    public sealed class HomeController : ControllerBase
    {
        private const string TilesKey = "home.tiles";
        private readonly IProDataAccess _db;

        public HomeController(IProDataAccess db) { _db = db; }

        private string Actor => Permissions.UserName(User);

        public sealed class LayoutBody { public string Json { get; set; } }

        [HttpGet("layout")]
        public IActionResult GetLayout() => Ok(new { json = _db.UserSetting_Get(Actor, TilesKey) });

        [HttpPut("layout")]
        public IActionResult SaveLayout([FromBody] LayoutBody body)
        {
            if (string.IsNullOrWhiteSpace(body?.Json)) return BadRequest(new { message = "Nothing to save." });
            try { using var _ = JsonDocument.Parse(body.Json); }
            catch (JsonException) { return BadRequest(new { message = "That layout isn't valid." }); }
            if (body.Json.Length > 20000) return BadRequest(new { message = "That layout is too large." });
            try
            {
                _db.UserSetting_Set(Actor, TilesKey, body.Json);
                return Ok(new { saved = true });
            }
            catch (SqlException ex) when (ex.Number == 50540) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpDelete("layout")]
        public IActionResult ResetLayout()
        {
            _db.UserSetting_Set(Actor, TilesKey, null);
            return Ok(new { saved = true });
        }
    }
}
