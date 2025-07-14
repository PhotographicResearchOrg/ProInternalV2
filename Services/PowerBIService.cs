using Azure.Core;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Client;
using Microsoft.PowerBI.Api;
using Microsoft.PowerBI.Api.Models;
using Microsoft.Rest;


namespace ProInternal.Services
{
    public class PowerBIService : ControllerBase
    {
        private readonly string tenantId = "08245b1b-9f0e-4a49-ae9f-6c1c7989c585";

        private readonly string clientId = "8de215d6-e76c-40dd-b649-d000f43be449";
        //8de215d6-e76c-40dd-b649-d000f43be449


        private readonly string clientSecret = "RVw8Q~ao3HfVDb8dXyRfMW5h_x12I-n0duysEcr3";
        //Val:   RVw8Q~ao3HfVDb8dXyRfMW5h_x12I-n0duysEcr3 
        //Secret ID: a0f4c2a5-8612-49ad-94c3-19c749b813af

        private readonly string workspaceId = "bc3e91cc-620c-4813-af8d-38dd17f416da";

        private readonly string reportId = "e4f1f695-5beb-488e-923a-1976b9c2d4bf";
                                      

        private const string powerBiApiUrl = "https://api.powerbi.com/";
        private const string authorityUrl = "https://login.microsoftonline.com/";
        private readonly string[] scopes = new[] { "https://analysis.windows.net/powerbi/api/.default" };

        public async Task<(string embedToken, string embedUrl, string reportId)> GetEmbedConfigAsync()
        {

            try
            {


                var confidentialClient = ConfidentialClientApplicationBuilder
                    .Create(clientId)
                    .WithClientSecret(clientSecret)
                    .WithAuthority($"{authorityUrl}{tenantId}")
                    .Build();

                var authResult = await confidentialClient.AcquireTokenForClient(scopes).ExecuteAsync();


                var accessToken = authResult.AccessToken;
                //Console.WriteLine("Access Token: " + accessToken);

                var tokenCredentials = new TokenCredentials(authResult.AccessToken, "Bearer");

                using var pbiClient = new PowerBIClient(new Uri(powerBiApiUrl), tokenCredentials);


                var report = await pbiClient.Reports.GetReportInGroupAsync(Guid.Parse(workspaceId), Guid.Parse(reportId));

                var tokenRequest = new GenerateTokenRequestV2(
                 reports: new List<GenerateTokenRequestV2Report> { new(report.Id) },
                 datasets: new List<GenerateTokenRequestV2Dataset> { new(report.DatasetId) }
             );

                var embedTokenResponse = await pbiClient.EmbedToken.GenerateTokenAsync(tokenRequest);

                return (embedTokenResponse.Token, report.EmbedUrl, report.Id.ToString());

            }
                catch (HttpOperationException ex) {
                    //Console.WriteLine("Power BI API Call Failed");
                    //Console.WriteLine($"Status: {ex.Response.StatusCode}");
                    //Console.WriteLine($"Content: {ex.Response.Content}");
                    throw;
                }

            catch (Exception ex)
            {
                //Console.WriteLine("General Error:");
               // Console.WriteLine(ex.Message);
                throw;
            }


        }
    

    }
}
