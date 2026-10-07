using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ProInternal.Models.Vendor;
using ProInternal.Services;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class VendorCardController : ControllerBase
    {
        private readonly IProDataAccess _prodataAccess;
        private readonly IVendorFileService _vendorFiles;

        public VendorCardController(IProDataAccess proDataAccess, IVendorFileService vendorFiles)
        {
            _prodataAccess = proDataAccess;
            _vendorFiles = vendorFiles;
        }

        // The JWT's "sub" claim (the username) arrives as ClaimTypes.NameIdentifier
        // via ASP.NET Core's default inbound claim mapping -- see Models/Auth/JwtToken.cs.
        private string GetChangedBy()
        {
            return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "Unknown";
        }

        // Custom claim name, so it isn't remapped by the inbound claim map.
        private Guid? GetSessionId()
        {
            return Guid.TryParse(User.FindFirst(AuditActor.SessionIdClaim)?.Value, out var id) ? id : null;
        }

        private AuditActor GetAuditActor()
        {
            return new AuditActor(GetChangedBy(), GetSessionId());
        }

        [HttpPost]
        public IActionResult CreateVendor([FromBody] CreateVendorDto vendor)
        {
            if (!ValidateNewVendor(vendor)) return ValidationProblem(ModelState);

            var id = _prodataAccess.CreateVendor(vendor, GetAuditActor());
            if (id < 0)
            {
                ModelState.AddModelError(nameof(vendor.VendorId), $"Vendor number {vendor.VendorId} is already in use.");
                return ValidationProblem(ModelState);
            }
            return Ok(new { vendorId = id });
        }

        // Trims/normalizes the DTO in place, then applies the rules from
        // vendor.schema.json that data annotations can't express.
        private bool ValidateNewVendor(CreateVendorDto v)
        {
            static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
            static string? Upper(string? s) => Clean(s)?.ToUpperInvariant();

            v.Name = Clean(v.Name) ?? "";
            v.Status = Upper(v.Status) ?? "";
            v.LegalName = Clean(v.LegalName);
            v.ShortName = Clean(v.ShortName);
            v.Category = Upper(v.Category);
            v.OurAccountNumber = Clean(v.OurAccountNumber);
            v.WebsiteUrl = Clean(v.WebsiteUrl);
            v.Notes = Clean(v.Notes);
            v.ManagedBy = Clean(v.ManagedBy);
            v.AddressLine1 = Clean(v.AddressLine1);
            v.City = Clean(v.City);
            v.Region = Clean(v.Region);
            v.PostalCode = Clean(v.PostalCode);
            v.Country = Upper(v.Country);
            v.Phone = Clean(v.Phone);
            v.Currency = Upper(v.Currency) ?? "";
            v.PaymentTermsCode = Clean(v.PaymentTermsCode);
            v.SupplyModels = v.SupplyModels?.Select(Upper).Where(s => s != null).Select(s => s!).Distinct().ToList();
            v.ContactRole = Upper(v.ContactRole);
            v.ContactName = Clean(v.ContactName);
            v.ContactTitle = Clean(v.ContactTitle);
            v.ContactEmail = Clean(v.ContactEmail);
            v.ContactPhone = Clean(v.ContactPhone);

            if (v.Name.Length == 0)
                ModelState.AddModelError(nameof(v.Name), "Vendor name is required.");
            if (!VendorSchemaEnums.VendorStatus.Contains(v.Status))
                ModelState.AddModelError(nameof(v.Status), "Choose Active or Inactive.");
            if (!Regex.IsMatch(v.Currency, "^[A-Z]{3}$"))
                ModelState.AddModelError(nameof(v.Currency), "Use a 3-letter ISO 4217 code, e.g. USD.");
            if (v.Category != null && !Regex.IsMatch(v.Category, "^[A-Z][A-Z0-9_]*$"))
                ModelState.AddModelError(nameof(v.Category), "Use a category code: letters, digits and underscores, starting with a letter.");
            if (v.WebsiteUrl != null &&
                !(Uri.TryCreate(v.WebsiteUrl, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)))
                ModelState.AddModelError(nameof(v.WebsiteUrl), "Enter a full URL, e.g. https://example.com.");

            // An address, when given, needs line1, city and country.
            if (v.HasAddress)
            {
                if (v.AddressLine1 == null)
                    ModelState.AddModelError(nameof(v.AddressLine1), "Street is required when an address is entered.");
                if (v.City == null)
                    ModelState.AddModelError(nameof(v.City), "City is required when an address is entered.");
                else if (Regex.IsMatch(v.City, @",\s*[A-Za-z]{2}\s*$"))
                    ModelState.AddModelError(nameof(v.City), "Enter the state separately, not as \"City, ST\".");
                if (v.Country == null || !Regex.IsMatch(v.Country, "^[A-Z]{2}$"))
                    ModelState.AddModelError(nameof(v.Country), "Use a 2-letter country code, e.g. US.");
            }

            if (v.SupplyModels != null && v.SupplyModels.Any(m => !VendorSchemaEnums.SupplyModel.Contains(m)))
                ModelState.AddModelError(nameof(v.SupplyModels), "Choose Warehouse and/or Direct ship.");

            // A contact needs a role, a name, and an email or phone.
            if (v.HasContact)
            {
                if (v.ContactRole == null || !VendorSchemaEnums.ContactRole.Contains(v.ContactRole))
                    ModelState.AddModelError(nameof(v.ContactRole), "Choose the contact's role.");
                if (v.ContactName == null)
                    ModelState.AddModelError(nameof(v.ContactName), "Contact name is required.");
                if (v.ContactEmail == null && v.ContactPhone == null)
                    ModelState.AddModelError(nameof(v.ContactEmail), "Enter an email or a phone for the contact.");
                if (v.ContactEmail != null && !new EmailAddressAttribute().IsValid(v.ContactEmail))
                    ModelState.AddModelError(nameof(v.ContactEmail), "Enter a valid email address.");
            }

            return ModelState.IsValid;
        }

        [HttpGet("{vendorId}")]
        public IActionResult GetVendorCard(int vendorId)
        {
            var card = _prodataAccess.GetVendorCard(vendorId);
            if (card == null) return NotFound();
            return Ok(card);
        }

        [HttpPost("{vendorId}/toggle-active")]
        public IActionResult ToggleActive(int vendorId)
        {
            _prodataAccess.ToggleVendorActive(vendorId, GetAuditActor());
            return Ok();
        }

        [HttpGet("{vendorId}/terms")]
        public IActionResult GetTerms(int vendorId)
        {
            return Ok(_prodataAccess.GetVendorTerms(vendorId));
        }

        [HttpPut("{vendorId}/terms")]
        public IActionResult SaveTerms(int vendorId, [FromBody] VendorTermsDto terms)
        {
            terms.VendorId = vendorId;
            _prodataAccess.UpsertVendorTerms(terms, GetAuditActor());
            return Ok();
        }

        [HttpPost("{vendorId}/brands")]
        public IActionResult AddBrand(int vendorId, [FromBody] VendorBrandDto brand)
        {
            brand.VendorId = vendorId;
            var id = _prodataAccess.AddVendorBrand(brand, GetAuditActor());
            return Ok(new { vendorBrandId = id });
        }

        [HttpGet("{vendorId}/contacts")]
        public IActionResult GetContacts(int vendorId)
        {
            return Ok(_prodataAccess.GetVendorContacts(vendorId));
        }

        [HttpPost("{vendorId}/contact-groups")]
        public IActionResult AddContactGroup(int vendorId, [FromBody] VendorContactGroupDto group)
        {
            group.VendorId = vendorId;
            var id = _prodataAccess.AddVendorContactGroup(group, GetAuditActor());
            return Ok(new { vendorContactGroupId = id });
        }

        [HttpPost("{vendorId}/contacts")]
        public IActionResult AddContact(int vendorId, [FromBody] VendorContactDto contact)
        {
            var id = _prodataAccess.AddVendorContact(contact, GetAuditActor());
            return Ok(new { vendorContactId = id });
        }

        [HttpPut("contacts/{contactId}")]
        public IActionResult UpdateContact(int contactId, [FromBody] VendorContactDto contact)
        {
            contact.VendorContactId = contactId;
            _prodataAccess.UpdateVendorContact(contact, GetAuditActor());
            return Ok();
        }

        [HttpDelete("contacts/{contactId}")]
        public IActionResult DeleteContact(int contactId)
        {
            _prodataAccess.DeleteVendorContact(contactId);
            return Ok();
        }

        [HttpGet("{vendorId}/contracts")]
        public IActionResult GetContracts(int vendorId)
        {
            return Ok(_prodataAccess.GetVendorContracts(vendorId));
        }

        [HttpPost("{vendorId}/contracts")]
        public IActionResult AddContract(int vendorId, [FromBody] VendorContractDto contract)
        {
            contract.VendorId = vendorId;
            var id = _prodataAccess.AddVendorContract(contract, GetAuditActor());
            return Ok(new { vendorContractId = id });
        }

        [HttpPut("contracts/{contractId}")]
        public IActionResult UpdateContract(int contractId, [FromBody] VendorContractDto contract)
        {
            contract.VendorContractId = contractId;
            _prodataAccess.UpdateVendorContract(contract, GetAuditActor());
            return Ok();
        }

        [HttpGet("{vendorId}/price-lists")]
        public IActionResult GetPriceLists(int vendorId)
        {
            return Ok(_prodataAccess.GetVendorPriceLists(vendorId));
        }

        [HttpPost("{vendorId}/price-lists")]
        public IActionResult AddPriceList(int vendorId, [FromBody] VendorPriceListDto priceList)
        {
            priceList.VendorId = vendorId;
            var id = _prodataAccess.AddVendorPriceList(priceList, GetAuditActor());
            return Ok(new { vendorPriceListId = id });
        }

        // ---- Vendor files (contracts / price lists) ----
        // category is "contracts" or "price-lists"; files live on the share
        // configured under VendorFiles in appsettings, foldered by vendor id.

        [HttpGet("{vendorId}/files/{category}")]
        public IActionResult GetFiles(int vendorId, string category)
        {
            if (!_vendorFiles.IsValidCategory(category)) return NotFound();
            return Ok(_vendorFiles.ListFiles(vendorId, category));
        }

        [HttpPost("{vendorId}/files/{category}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadFiles(int vendorId, string category, [FromForm] List<IFormFile> files, CancellationToken ct)
        {
            if (!_vendorFiles.IsValidCategory(category)) return NotFound();
            // don't create folders for vendors that don't exist
            if (_prodataAccess.GetVendorCard(vendorId) == null) return NotFound();
            if (files == null || files.Count == 0) return BadRequest("No files uploaded.");

            var saved = await _vendorFiles.SaveFilesAsync(vendorId, category, files, ct);

            var actor = GetAuditActor();
            foreach (var name in saved)
                _prodataAccess.LogVendorChange(vendorId, _vendorFiles.AuditSection(category), "File", null, name, actor);

            return Ok(new { uploaded = saved });
        }

        [HttpGet("{vendorId}/files/{category}/download")]
        public IActionResult DownloadFile(int vendorId, string category, [FromQuery] string name)
        {
            if (!_vendorFiles.IsValidCategory(category)) return NotFound();

            try
            {
                var (full, contentType, fileName) = _vendorFiles.ResolveForDownload(vendorId, category, name);
                return PhysicalFile(full, contentType, fileName, enableRangeProcessing: true);
            }
            catch (FileNotFoundException)
            {
                return NotFound();
            }
        }

        [HttpDelete("{vendorId}/files/{category}")]
        public IActionResult DeleteFile(int vendorId, string category, [FromQuery] string name)
        {
            if (!_vendorFiles.IsValidCategory(category)) return NotFound();
            if (!_vendorFiles.DeleteFile(vendorId, category, name)) return NotFound();

            _prodataAccess.LogVendorChange(vendorId, _vendorFiles.AuditSection(category), "File", name, null, GetAuditActor());
            return Ok();
        }

        [HttpGet("{vendorId}/policies")]
        public IActionResult GetPolicies(int vendorId)
        {
            return Ok(_prodataAccess.GetVendorPolicies(vendorId));
        }

        [HttpPut("{vendorId}/policies/freight")]
        public IActionResult SaveFreightPolicy(int vendorId, [FromBody] VendorFreightPolicyDto policy)
        {
            policy.VendorId = vendorId;
            _prodataAccess.UpsertVendorFreightPolicy(policy, GetAuditActor());
            return Ok();
        }

        [HttpPut("{vendorId}/policies/shipping")]
        public IActionResult SaveShippingPolicy(int vendorId, [FromBody] VendorShippingPolicyDto policy)
        {
            policy.VendorId = vendorId;
            _prodataAccess.UpsertVendorShippingPolicy(policy, GetAuditActor());
            return Ok();
        }

        [HttpPut("{vendorId}/policies/returns")]
        public IActionResult SaveReturnPolicy(int vendorId, [FromBody] VendorReturnPolicyDto policy)
        {
            policy.VendorId = vendorId;
            _prodataAccess.UpsertVendorReturnPolicy(policy, GetAuditActor());
            return Ok();
        }

        [HttpGet("{vendorId}/rebates")]
        public IActionResult GetRebatePrograms(int vendorId)
        {
            return Ok(_prodataAccess.GetVendorRebatePrograms(vendorId));
        }

        [HttpPost("{vendorId}/rebates")]
        public IActionResult AddRebateProgram(int vendorId, [FromBody] VendorRebateProgramDto rebate)
        {
            rebate.VendorId = vendorId;
            var id = _prodataAccess.AddVendorRebateProgram(rebate, GetAuditActor());
            return Ok(new { vendorRebateProgramId = id });
        }

        [HttpPut("rebates/{rebateId}")]
        public IActionResult UpdateRebateProgram(int rebateId, [FromBody] VendorRebateProgramDto rebate)
        {
            rebate.VendorRebateProgramId = rebateId;
            _prodataAccess.UpdateVendorRebateProgram(rebate, GetAuditActor());
            return Ok();
        }

        // ---- Custom field definitions (global, shown on every vendor) ----

        [HttpGet("custom-field-definitions")]
        public IActionResult GetCustomFieldDefinitions()
        {
            return Ok(_prodataAccess.GetVendorCustomFieldDefinitions());
        }

        [HttpPost("custom-field-definitions")]
        public IActionResult AddCustomFieldDefinition([FromBody] VendorCustomFieldDefinitionDto definition)
        {
            if (!ValidateDefinition(definition)) return ValidationProblem(ModelState);

            var id = _prodataAccess.AddVendorCustomFieldDefinition(definition, GetChangedBy());
            if (id < 0)
            {
                ModelState.AddModelError(nameof(definition.Label), "A field with this label already exists in that section.");
                return ValidationProblem(ModelState);
            }
            return Ok(new { vendorCustomFieldDefinitionId = id });
        }

        [HttpPut("custom-field-definitions/{definitionId}")]
        public IActionResult UpdateCustomFieldDefinition(int definitionId, [FromBody] VendorCustomFieldDefinitionDto definition)
        {
            definition.VendorCustomFieldDefinitionId = definitionId;
            if (!ValidateDefinition(definition)) return ValidationProblem(ModelState);

            var result = _prodataAccess.UpdateVendorCustomFieldDefinition(definition);
            if (result == 0) return NotFound();
            if (result < 0)
            {
                ModelState.AddModelError(nameof(definition.Label), "A field with this label already exists in that section.");
                return ValidationProblem(ModelState);
            }
            return Ok();
        }

        [HttpDelete("custom-field-definitions/{definitionId}")]
        public IActionResult DeleteCustomFieldDefinition(int definitionId)
        {
            _prodataAccess.DeleteVendorCustomFieldDefinition(definitionId);
            return Ok();
        }

        // ---- Custom field values (per vendor) ----

        [HttpGet("{vendorId}/custom-fields")]
        public IActionResult GetCustomFields(int vendorId)
        {
            return Ok(_prodataAccess.GetVendorCustomFields(vendorId));
        }

        [HttpPut("{vendorId}/custom-fields/{definitionId}")]
        public IActionResult SaveCustomFieldValue(int vendorId, int definitionId, [FromBody] VendorCustomFieldValueDto body)
        {
            var field = _prodataAccess.GetVendorCustomFields(vendorId)
                .FirstOrDefault(f => f.VendorCustomFieldDefinitionId == definitionId);
            if (field == null) return NotFound();

            if (!TryNormalizeCustomFieldValue(field.DataType, body.Value, out var normalized))
            {
                ModelState.AddModelError(nameof(body.Value), $"\"{field.Label}\" must be a valid {field.DataType.ToLowerInvariant()}.");
                return ValidationProblem(ModelState);
            }

            _prodataAccess.SaveVendorCustomFieldValue(vendorId, definitionId, normalized, GetAuditActor());
            return Ok();
        }

        private bool ValidateDefinition(VendorCustomFieldDefinitionDto definition)
        {
            definition.Label = definition.Label?.Trim() ?? "";
            if (definition.Label.Length == 0)
                ModelState.AddModelError(nameof(definition.Label), "Label is required.");
            if (!VendorCustomFieldOptions.Sections.Contains(definition.Section))
                ModelState.AddModelError(nameof(definition.Section), "Choose a valid section.");
            if (!VendorCustomFieldOptions.DataTypes.Contains(definition.DataType))
                ModelState.AddModelError(nameof(definition.DataType), "Choose a valid type.");
            return ModelState.IsValid;
        }

        // Stores numbers, dates and booleans in a canonical string form so
        // the value column stays sortable/reportable regardless of the
        // client's locale. Blank always means "clear the value".
        private static bool TryNormalizeCustomFieldValue(string dataType, string? raw, out string? normalized)
        {
            normalized = null;
            var value = raw?.Trim();
            if (string.IsNullOrEmpty(value)) return true;

            switch (dataType)
            {
                case "Number":
                    if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var num)) return false;
                    normalized = num.ToString(CultureInfo.InvariantCulture);
                    return true;
                case "Date":
                    if (!DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)) return false;
                    normalized = date.ToString("yyyy-MM-dd");
                    return true;
                case "Boolean":
                    if (!bool.TryParse(value, out var flag)) return false;
                    normalized = flag ? "true" : "false";
                    return true;
                default:
                    normalized = value;
                    return true;
            }
        }

        [HttpGet("{vendorId}/audit-log")]
        public IActionResult GetAuditLog(int vendorId, [FromQuery] int take = 20)
        {
            var entries = _prodataAccess.GetEntityAuditLog("Vendor", vendorId, take);

            var sessionId = GetSessionId();
            if (sessionId.HasValue)
            {
                foreach (var entry in entries)
                    entry.IsCurrentSession = entry.SessionId == sessionId;
            }

            return Ok(entries);
        }
    }
}
