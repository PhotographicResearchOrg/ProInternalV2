using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.Accounting;

[ApiController]
[Route("api/vendor-billing")]
public class VendorBillingController : ControllerBase
{
    private readonly IInvoiceExtractionService _extractor;
    private IProDataAccess _proDataAccess;
    private IUvicornDataAccess _Uvicorn;

    public VendorBillingController(
        IInvoiceExtractionService extractor,
        IProDataAccess proDataAccess,
        IDRADataAccess dradataAccess,
        IEDADataAccess edadataAccess,
        IUvicornDataAccess uvicornDataAccess
        )
    {
        _extractor = extractor;
        _proDataAccess = proDataAccess; 
        _Uvicorn = uvicornDataAccess;
    }

    


    [HttpGet("search/vendor")]
    public IActionResult SearchVendor([FromQuery] string term)
    {
        if (string.IsNullOrWhiteSpace(term))
            return Ok(Array.Empty<object>());

        var vendors = _proDataAccess.SearchVendors(term);

        return Ok(vendors);
    }


    [HttpGet("history")]
    public IActionResult GetVendorBillingHistory()
    {
        return Ok(_proDataAccess.GetVendorBillingHistory());
    }


    [HttpPost("vendor-learning")]
    public IActionResult SaveVendorLearning(
    [FromBody] VendorInvoiceLearningDto dto)
    {
        _proDataAccess.UpsertVendorInvoiceLearning(dto);
        return Ok();
    }


    [HttpPost("extract-preview")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ExtractPreview(
    [FromForm] IFormFile file,
    [FromQuery] int? vendorId)
    {
        if (file == null)
            return BadRequest("PDF required");

        //var dto = await _extractor.ExtractPreviewAsync(file);

        // 🔥 This already calls Python via uvicorn
       // var dto = await _Uvicorn.ExtractInvoicePreviewAsync(file);
        var dto = await _extractor.ExtractPreviewAsync(file);
        if (vendorId.HasValue)
        {
            dto = _extractor.ApplyVendorLearning(
                dto,
                dto.RawText,
                vendorId.Value
            );
        }

        return Ok(dto);
    }



}
