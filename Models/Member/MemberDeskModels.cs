#nullable disable   // optional fields: without this, [ApiController] treats every non-nullable string as required and returns 400
using System;
using System.Collections.Generic;

namespace ProInternal.Models.Member
{
    // ---------- list ----------
    public class MemberListItem
    {
        public int RosterId { get; set; }
        public string AccountNumber { get; set; }
        public string Name { get; set; }
        public string LegalName { get; set; }
        public int? MemberType { get; set; }
        public string AccountRole { get; set; }
        public string Status { get; set; }
        public bool PortalEnabled { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Country { get; set; }
        public string ParentAccountNumber { get; set; }
        public bool OnCreditHold { get; set; }
    }

    // ---------- detail ----------
    public class MemberHeader
    {
        public int RosterId { get; set; }
        public string AccountNumber { get; set; }
        public string Name { get; set; }
        public string LegalName { get; set; }
        public int? MemberType { get; set; }
        public string AccountRole { get; set; }
        public string Status { get; set; }
        public bool PortalEnabled { get; set; }
        public DateTime? JoinDate { get; set; }
        public string Phone { get; set; }
        public string Fax { get; set; }
        public string Email { get; set; }
        public string Website { get; set; }
        public string ParentAccountNumber { get; set; }
        public string ParentName { get; set; }
        public bool BillToParent { get; set; }
        public string PreviousAccountNumber { get; set; }
        public bool HasCustomCatalog { get; set; }
        public int? PaymentMethod { get; set; }
        public int? DefaultPaymentMethod { get; set; }
        public string PaymentMethodReason { get; set; }
        public string AuthorizeNetCustomerProfileId { get; set; }
        public string PriceCountry { get; set; }
        public string CurrencyCode { get; set; }
        public string LanguageCode { get; set; }
        public string FulfillmentCenter { get; set; }
        public bool MarkupExempt { get; set; }
        public string MarkupExemptReason { get; set; }
        public string DuesFrequency { get; set; }
        public string InstantRebateOverride { get; set; }
        public string PatronagePayoutMethod { get; set; }
        public string Terms { get; set; }

        // Computyme-owned until Member:SqlIsMaster = true
        public bool SqlIsMaster { get; set; }
        public decimal? CreditLimit { get; set; }
        public DateTime? CreditHoldSince { get; set; }
        public string CreditHoldReason { get; set; }
        public bool EzPayAllowed { get; set; }
        public bool DuesEnrolled { get; set; }
        public string ComputymeDues { get; set; }
        public int? ShippingZone { get; set; }
        public bool AirDuringPeak { get; set; }
        public string ComputymeName { get; set; }
        public string ComputymeType { get; set; }

        public bool HoldEveryOrder { get; set; }
        public string HoldEveryOrderReason { get; set; }

        public int? BillToAddressId { get; set; }
        public string Address1 { get; set; }
        public string Address2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Zip { get; set; }
        public string Country { get; set; }

        public DateTime? EnterDate { get; set; }
        public DateTime? UpdateDate { get; set; }
        public string UpdatedBy { get; set; }
    }

    public class MemberLocation
    {
        public int AddressId { get; set; }
        public int? AddressTypeId { get; set; }
        public string AddressTypeName { get; set; }
        public string Address1 { get; set; }
        public string Address2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Zip { get; set; }
        public string Country { get; set; }
        public string CompanyName { get; set; }
        public bool IsPrimary { get; set; }
        public bool IsActive { get; set; }
        public bool IsBillTo { get; set; }
        public int? ComputymeShipTo { get; set; }
        public bool IsDefaultShipTo { get; set; }
    }

    public class MemberContact
    {
        public string Role { get; set; }
        public int UserId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
    }

    public class MemberGrant
    {
        public int MemberAuthorizationId { get; set; }
        public string Code { get; set; }
        public string Name { get; set; }
        public string Status { get; set; }
        public string Description { get; set; }
        public bool UnlocksAuthorizedPrice { get; set; }
        public DateTime GrantedOn { get; set; }
        public string GrantedBy { get; set; }
        public string Reason { get; set; }
        public int? EvidenceDocumentId { get; set; }
    }

    public class MemberBrandExclusion
    {
        public int BrandId { get; set; }
        public string BrandName { get; set; }
        public string Source { get; set; }
        public string RuleCodes { get; set; }
    }

    public class MemberGroupExclusion
    {
        public int GroupId { get; set; }
        public string GroupName { get; set; }
    }

    public class MemberMapViolation
    {
        public int ViolationId { get; set; }
        public string ProductCode { get; set; }
        public string ModelName { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public DateTime? RecordedAt { get; set; }
        public int PenaltyDays { get; set; }
        public bool IsActive { get; set; }
        public string Note { get; set; }
        public int? EvidenceDocumentId { get; set; }
        public string CreatedBy { get; set; }
    }

    public class MemberDocument
    {
        public int DocumentId { get; set; }
        public string DocumentType { get; set; }
        public string Title { get; set; }
        public string FileName { get; set; }
        public string ContentType { get; set; }
        public long? SizeBytes { get; set; }
        public DateTime UploadedAt { get; set; }
        public string UploadedBy { get; set; }
        public DateTime? ExpiresOn { get; set; }
        public string ReviewStatus { get; set; }
        public string ReviewedBy { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string ReviewNote { get; set; }
    }

    public class MemberDocumentFile
    {
        public int DocumentId { get; set; }
        public string AccountNumber { get; set; }
        public string FileName { get; set; }
        public string StorageKey { get; set; }
        public string ContentType { get; set; }
    }

    public class MemberRelated
    {
        public string Relation { get; set; }   // CHILD | PREVIOUS | NEXT
        public string AccountNumber { get; set; }
        public string Name { get; set; }
    }

    public class MemberDetail
    {
        public MemberHeader Header { get; set; }
        public List<MemberLocation> Locations { get; set; } = new();
        public List<MemberContact> Contacts { get; set; } = new();
        public List<MemberGrant> Grants { get; set; } = new();
        public List<MemberBrandExclusion> BrandExclusions { get; set; } = new();
        public List<MemberGroupExclusion> GroupExclusions { get; set; } = new();
        public List<MemberMapViolation> MapViolations { get; set; } = new();
        public List<MemberDocument> Documents { get; set; } = new();
        public List<MemberRelated> Related { get; set; } = new();
        public List<MemberAccessLogEntry> AccessLog { get; set; } = new();
        public MemberBrm Brm { get; set; }          // from dbo.GetBRM (HubSpot owner); null when none
    }

    public class MemberBrm
    {
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
    }

    // ---------- writes ----------
    public class MemberSaveRequest
    {
        public string Name { get; set; }
        public string LegalName { get; set; }
        public string Status { get; set; }
        public bool PortalEnabled { get; set; }
        public DateTime? JoinDate { get; set; }
        public string Phone { get; set; }
        public string Fax { get; set; }
        public string Email { get; set; }
        public string Website { get; set; }
        public string AccountRole { get; set; }
        public string ParentAccountNumber { get; set; }
        public bool BillToParent { get; set; }
        public string PreviousAccountNumber { get; set; }
        public int PaymentMethod { get; set; }
        public int? DefaultPaymentMethod { get; set; }
        public string PaymentMethodReason { get; set; }
        public string PriceCountry { get; set; }
        public string CurrencyCode { get; set; }
        public string LanguageCode { get; set; }
        public string FulfillmentCenter { get; set; }
        public bool MarkupExempt { get; set; }
        public string MarkupExemptReason { get; set; }
        public string DuesFrequency { get; set; }
        public string InstantRebateOverride { get; set; }
        public string PatronagePayoutMethod { get; set; }
        // Computyme-owned: ignored by the database until Member:SqlIsMaster = true
        public decimal? CreditLimit { get; set; }
        public DateTime? CreditHoldSince { get; set; }
        public string CreditHoldReason { get; set; }
        public bool? EzPayAllowed { get; set; }
        public bool? DuesEnrolled { get; set; }
        public int? ShippingZone { get; set; }
        public bool? AirDuringPeak { get; set; }
    }

    public class AccessRule
    {
        public int? AuthorizationId { get; set; }
        public string Code { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string BusinessReason { get; set; }
        public string Status { get; set; }
        public int? BrandId { get; set; }
        public string BrandName { get; set; }
        public int? VendorId { get; set; }
        public bool UnlocksAuthorizedPrice { get; set; }
        public string SegmentType { get; set; }
        public string MemberTypes { get; set; }
        public bool RequiresCustomCatalog { get; set; }
        public bool RequiresPortalEnabled { get; set; }
        public string ReviewStatus { get; set; }
        public string ApprovedBy { get; set; }
        public DateTime? ApprovedOn { get; set; }
        public DateTime? ReviewBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string UpdatedBy { get; set; }
        public int MembersInSegment { get; set; }
        public int MembersGranted { get; set; }
        public int MembersExcluded { get; set; }
    }

    public class AccessRuleMember
    {
        public string AccountNumber { get; set; }
        public string Name { get; set; }
        public int? MemberType { get; set; }
        public string Standing { get; set; }   // GRANTED | EXCLUDED
        public DateTime? GrantedOn { get; set; }
        public string GrantedBy { get; set; }
        public string Reason { get; set; }
    }

    public class GrantRequest
    {
        public string Code { get; set; }
        public string Reason { get; set; }
        public int? EvidenceDocumentId { get; set; }
    }

    public class DocumentReviewRequest
    {
        public string Status { get; set; }
        public string Note { get; set; }
    }

    public class MapViolationRequest
    {
        public string ProductCode { get; set; }
        public DateTime StartDate { get; set; }
        public int PenaltyDays { get; set; } = 30;
        public string Note { get; set; }
        public int? EvidenceDocumentId { get; set; }
    }

    public class MapViolationEndRequest
    {
        public DateTime EndDate { get; set; }
        public string Note { get; set; }
    }

    // ---------- access history ----------
    public class MemberAccessLogEntry
    {
        public long LogId { get; set; }
        public DateTime LoggedAt { get; set; }     // UTC
        public string Action { get; set; }
        public int? BrandId { get; set; }
        public string BrandName { get; set; }
        public string RuleCode { get; set; }
        public string Detail { get; set; }
        public string ChangedBy { get; set; }
    }

    // ---------- MAP product lookup ----------
    public class ProductLookupItem
    {
        public string ProductCode { get; set; }
        public string ModelName { get; set; }
        public string BrandName { get; set; }
    }

    // ---------- brand actions ----------
    public class BrandOption
    {
        public int BrandId { get; set; }
        public string BrandName { get; set; }
    }

    public class BrandAllowRequest
    {
        public string Reason { get; set; }
    }
    // ---------- ship-tos: SQL vs Computyme (read only; piv2.MemberShipTo_Compare / _Issues) ----------
    public class ShipToMirror
    {
        public bool MirrorAvailable { get; set; }
        public string MirrorSource { get; set; }
        public int MirrorShipTos { get; set; }
    }

    public class ShipToCompareRow
    {
        public string AccountNumber { get; set; }
        public string MemberName { get; set; }
        public string Code { get; set; }
        public int? MapId { get; set; }
        public string CodeRaw { get; set; }
        public bool? IsDefault { get; set; }
        public int? AddressId { get; set; }
        public bool? AddressActive { get; set; }
        public string AddressTypeName { get; set; }
        public string SqlStreet { get; set; }
        public string SqlStreet2 { get; set; }
        public string SqlCity { get; set; }
        public string SqlState { get; set; }
        public string SqlZip { get; set; }
        public string SqlCountry { get; set; }
        public string ComputymeSource { get; set; }
        public string ComputymeKey { get; set; }
        public string CtyName { get; set; }
        public string CtyStreet { get; set; }
        public string CtyStreet2 { get; set; }
        public string CtyCity { get; set; }
        public string CtyState { get; set; }
        public string CtyZip { get; set; }
        public string CtyZone { get; set; }
        public string Status { get; set; }
        public string Differences { get; set; }
        public string FitIssues { get; set; }
    }

    public class ShipToStatusCount
    {
        public string Status { get; set; }
        public int ShipTos { get; set; }
        public int Members { get; set; }
    }

    public class MemberShipTos
    {
        public ShipToMirror Mirror { get; set; }
        public List<ShipToCompareRow> Rows { get; set; } = new();
    }

    public class ShipToIssues
    {
        public ShipToMirror Mirror { get; set; }
        public List<ShipToStatusCount> Counts { get; set; } = new();
        public List<ShipToCompareRow> Rows { get; set; } = new();
    }
}
