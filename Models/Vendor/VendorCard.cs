using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ProInternal.Models.Vendor
{
    public class VendorCardDto
    {
        public int VendorId { get; set; }
        public string Name { get; set; }
        public string? LegalName { get; set; }
        public string? AccountNumber { get; set; }
        public string? RepName { get; set; }
        public bool IsActive { get; set; }
        public bool OnWeb { get; set; }
        public List<string> Brands { get; set; } = new();
        public VendorTermsDto Terms { get; set; }
        public VendorStatsDto Stats { get; set; }
    }

    // Vocabularies from Schemas/OrderIntegration/v1.0/vendors/vendor.enums.json
    // that the create-vendor form uses.
    public static class VendorSchemaEnums
    {
        public static readonly string[] VendorStatus = { "ACTIVE", "INACTIVE" };
        public static readonly string[] SupplyModel = { "WAREHOUSE", "DIRECT_SHIP" };
        public static readonly string[] ContactRole =
            { "SALES", "ORDERS", "ACCOUNTS_RECEIVABLE", "RETURNS", "EDI", "PROGRAMS", "PRODUCT", "EXECUTIVE", "OTHER" };
    }

    // New vendor, shaped after the canonical vendor contract
    // (vendor.schema.json). Required there: vendorId, vendor.name,
    // vendor.status, terms.currency. VendorId is optional here -- the next
    // free id is assigned when omitted. Flat rather than nested so validation
    // errors key straight onto form fields. Lengths match the target columns
    // (dbo.Vendor for name/address/phone/website, dbo.VendorProfile,
    // dbo.VendorTerms, dbo.VendorCardContact).
    public class CreateVendorDto
    {
        [Range(1, int.MaxValue)]
        public int? VendorId { get; set; }

        // ---- vendor ----
        [Required, StringLength(200)]
        public string Name { get; set; }

        [Required]
        public string Status { get; set; }

        [StringLength(200)] public string? LegalName { get; set; }
        [StringLength(100)] public string? ShortName { get; set; }
        [StringLength(50)] public string? Category { get; set; }
        [StringLength(50)] public string? OurAccountNumber { get; set; }
        [StringLength(100)] public string? WebsiteUrl { get; set; }
        [StringLength(2000)] public string? Notes { get; set; }

        // audit.managedBy -- the PRO employee who owns the relationship
        [StringLength(150)] public string? ManagedBy { get; set; }

        // ---- MAIN address ----
        [StringLength(100)] public string? AddressLine1 { get; set; }
        [StringLength(50)] public string? City { get; set; }
        [StringLength(50)] public string? Region { get; set; }
        [StringLength(50)] public string? PostalCode { get; set; }
        [StringLength(2)] public string? Country { get; set; }
        [StringLength(50)] public string? Phone { get; set; }

        // ---- terms ----
        [Required]
        public string Currency { get; set; }

        [StringLength(100)] public string? PaymentTermsCode { get; set; }

        [Range(0, 999999999999.99)] public decimal? CreditLimit { get; set; }
        [Range(0, 999999999999.99)] public decimal? MinimumOrder { get; set; }

        // ---- supply ----
        public List<string>? SupplyModels { get; set; }

        // ---- primary contact (optional; one role) ----
        public string? ContactRole { get; set; }
        [StringLength(150)] public string? ContactName { get; set; }
        [StringLength(150)] public string? ContactTitle { get; set; }
        [StringLength(200)] public string? ContactEmail { get; set; }
        [StringLength(50)] public string? ContactPhone { get; set; }

        public bool HasAddress =>
            AddressLine1 != null || City != null || Region != null || PostalCode != null;

        public bool HasContact =>
            ContactRole != null || ContactName != null || ContactTitle != null || ContactEmail != null || ContactPhone != null;
    }

    public class VendorStatsDto
    {
        public int ActiveContracts { get; set; }
        public int PriceListCount { get; set; }
        public int ContactCount { get; set; }
        public DateTime? LastChangeAt { get; set; }
    }

    // All the descriptive fields below are optional (nullable columns in
    // dbo.VendorTerms) -- only marking a field non-nullable here forces
    // ASP.NET Core's [ApiController] automatic "required" validation on it,
    // which is why these are all `string?`.
    public class VendorTermsDto
    {
        public int VendorId { get; set; }
        public decimal? ProDiscountPct { get; set; }
        public decimal? MemberDiscountPct { get; set; }
        public string? PaymentTerms { get; set; }
        public string? TermsBasis { get; set; }
        public string? EarlyPayDiscountText { get; set; }
        public decimal? CreditLimit { get; set; }
        public string? Currency { get; set; }
        public string? TaxStatus { get; set; }
        public string? RemitMethod { get; set; }
        public decimal? MinimumOrder { get; set; }
        public string? FobPoint { get; set; }
        public decimal? DefaultMarkup { get; set; }
        public string? VolumeRebateText { get; set; }
        public int? PriceProtectionDays { get; set; }
        public bool DropShipEnabled { get; set; }
        public string? PrimaryCategory { get; set; }
        public string? CountryOfOrigin { get; set; }
    }

    public class VendorBrandDto
    {
        public int VendorBrandId { get; set; }
        public int VendorId { get; set; }
        public string BrandName { get; set; }
        public int SortOrder { get; set; }
    }

    public class VendorContactGroupDto
    {
        public int VendorContactGroupId { get; set; }
        public int VendorId { get; set; }
        public string GroupName { get; set; }
        public int SortOrder { get; set; }
        public List<VendorContactDto> People { get; set; } = new();
    }

    public class VendorContactDto
    {
        public int VendorContactId { get; set; }
        public int VendorContactGroupId { get; set; }
        public string Name { get; set; }
        public string? Title { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public bool IsPrimary { get; set; }
    }

    public class VendorContractDto
    {
        public int VendorContractId { get; set; }
        public int VendorId { get; set; }
        public string Name { get; set; }
        public string? ContractType { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? ValueText { get; set; }
        public string Status { get; set; }
    }

    public class VendorPriceListDto
    {
        public int VendorPriceListId { get; set; }
        public int VendorId { get; set; }
        public string Name { get; set; }
        public DateTime? EffectiveDate { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public int SkuCount { get; set; }
        public string Currency { get; set; }
        public string Status { get; set; }
    }

    public class VendorFreightPolicyDto
    {
        public int VendorId { get; set; }
        public string? FreightTerms { get; set; }
        public string? FobPoint { get; set; }
        public string? Carrier { get; set; }
        public decimal? PrepaidThreshold { get; set; }
        public string? FuelSurcharge { get; set; }
        public string? LeadTimeText { get; set; }
    }

    public class VendorShippingPolicyDto
    {
        public int VendorId { get; set; }
        public decimal? FreeFreightThreshold { get; set; }
        public string? AppliesTo { get; set; }
        public decimal? ProTierOverride { get; set; }
        public string? Excludes { get; set; }
        public bool StacksWithPromos { get; set; }
    }

    public class VendorReturnPolicyDto
    {
        public int VendorId { get; set; }
        public int? ReturnWindowDays { get; set; }
        public decimal? RestockingFeePct { get; set; }
        public bool RmaRequired { get; set; }
        public string? ReturnFreightText { get; set; }
        public string? DefectiveHandlingText { get; set; }
        public string? NonReturnableText { get; set; }
    }

    public class VendorPoliciesDto
    {
        public VendorFreightPolicyDto Freight { get; set; }
        public VendorShippingPolicyDto Shipping { get; set; }
        public VendorReturnPolicyDto Returns { get; set; }
    }

    public class VendorRebateProgramDto
    {
        public int VendorRebateProgramId { get; set; }
        public int VendorId { get; set; }
        public string Name { get; set; }
        public string? Code { get; set; }
        public string? AmountText { get; set; }
        public string Eligibility { get; set; }
        public string? ScopeText { get; set; }
        public string? WindowText { get; set; }
        public string? Funding { get; set; }
        public string? ClaimMethod { get; set; }
        public string Status { get; set; }
        public bool IsWebVisible { get; set; }
        public decimal BudgetAmount { get; set; }
        public decimal RebatedAmount { get; set; }
        public int RedemptionCount { get; set; }
    }

    // Custom fields are defined once (VendorCustomFieldDefinitionDto) and
    // shown on every vendor under the chosen Section; each vendor then has
    // its own value (VendorCustomFieldDto). Section is a vendor-card nav id.
    public static class VendorCustomFieldOptions
    {
        public static readonly string[] Sections = { "terms", "contacts", "contracts", "pricelists", "policies", "rebates" };
        public static readonly string[] DataTypes = { "Text", "Number", "Date", "Boolean" };
    }

    public class VendorCustomFieldDefinitionDto
    {
        public int VendorCustomFieldDefinitionId { get; set; }

        [Required, StringLength(50)]
        public string Section { get; set; }

        [Required, StringLength(150)]
        public string Label { get; set; }

        [Required, StringLength(30)]
        public string DataType { get; set; }

        public bool IsPublishable { get; set; }
        public int SortOrder { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? CreatedBy { get; set; }
        public int UsageCount { get; set; }
    }

    public class VendorCustomFieldDto
    {
        public int VendorCustomFieldDefinitionId { get; set; }
        public int VendorId { get; set; }
        public string Section { get; set; }
        public string Label { get; set; }
        public string DataType { get; set; }
        public bool IsPublishable { get; set; }
        public int SortOrder { get; set; }
        public string? Value { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }

    public class VendorCustomFieldValueDto
    {
        [StringLength(500)]
        public string? Value { get; set; }
    }

    public class VendorAuditLogEntryDto
    {
        public long EntityAuditLogId { get; set; }
        public string EntityType { get; set; }
        public int EntityId { get; set; }
        public string? Section { get; set; }
        public string? FieldName { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public string? ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
        public Guid? SessionId { get; set; }

        // Set by VendorCardController: true when SessionId matches the caller's JWT.
        public bool IsCurrentSession { get; set; }
    }

    // Who made an audited change: the username plus the login session
    // (JWT "sessionId" claim, see Models/Auth/JwtToken.cs). SessionId is
    // null for tokens issued before the claim was added.
    public class AuditActor
    {
        public const string SessionIdClaim = "sessionId";

        public string ChangedBy { get; }
        public Guid? SessionId { get; }

        public AuditActor(string changedBy, Guid? sessionId)
        {
            ChangedBy = changedBy;
            SessionId = sessionId;
        }
    }
}
