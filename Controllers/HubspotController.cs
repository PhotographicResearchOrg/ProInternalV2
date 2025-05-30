using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Text.Json;
using System.Net.Http;
using System.Net.Http.Headers;



namespace ProInternal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class HubspotController : ControllerBase
    {

        private readonly HttpClient _httpClient;

        public HubspotController(IHttpClientFactory httpClientFactory)
        {
            _httpClient = httpClientFactory.CreateClient();
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", "pat-na1-efbc6ede-97d2-4224-861f-d4205831bb7c");
        }


        [HttpGet("owners")]
        public async Task<IActionResult> GetOwners()
        {
            var response = await _httpClient.GetAsync("https://api.hubapi.com/crm/v3/owners/");
            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }


        [HttpGet("companies")]
        public async Task<IActionResult> GetCompanies()
        {
            var url = "https://api.hubapi.com/crm/v3/objects/companies?properties=name,hubspot_owner_id,account_number&limit=100";
            var response = await _httpClient.GetAsync(url);
            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }


        [HttpPatch("companies/{id}")]
        public async Task<IActionResult> UpdateCompanyOwner(string id, [FromBody] JsonElement payload)
        {
            var content = new StringContent(payload.ToString(), System.Text.Encoding.UTF8, "application/json");
            var response = await _httpClient.PatchAsync($"https://api.hubapi.com/crm/v3/objects/companies/{id}", content);
            return StatusCode((int)response.StatusCode);
        }

        [HttpDelete("companies/{id}")]
        public async Task<IActionResult> DeleteCompany(string id)
        {
            var response = await _httpClient.DeleteAsync($"https://api.hubapi.com/crm/v3/objects/companies/{id}");
            return StatusCode((int)response.StatusCode);
        }




    }
}
