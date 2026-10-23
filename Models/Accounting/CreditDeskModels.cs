#nullable disable
using System;
using System.Collections.Generic;

namespace ProInternal.Models.Accounting.CreditDesk
{
    /* Credit Desk (api/creditdesk): piv2.Credit_MemberList / Credit_MemberGet. Money is in dollars. */

    public class CreditMemberRow
    {
        public string AccountNumber { get; set; }
        public string Name { get; set; }
        public int? MemberType { get; set; }
        public bool OnWeb { get; set; }
        public bool InComputyme { get; set; }
        public double? Limit { get; set; }
        public double? Balance { get; set; }
        public double? PastDue { get; set; }
        public double? Days90 { get; set; }
        public double? OpenOrders { get; set; }
        public double VendorExposure { get; set; }
        public double VendorBilled { get; set; }
        public double? Available { get; set; }
        public double? YtdSales { get; set; }
        public double? HighCredit { get; set; }
        public bool OnHold { get; set; }
        public int WebOrders { get; set; }
        public double WebValue { get; set; }
        public int HeldOrders { get; set; }
        public double HeldValue { get; set; }
        public decimal PendingVendorCredits { get; set; }
        public int PendingVendorCreditCount { get; set; }
        public DateTime? LastNoteAt { get; set; }
    }

    public class CreditHeader
    {
        public string AccountNumber { get; set; }
        public string Name { get; set; }
        public string ComputymeName { get; set; }
        public int? MemberType { get; set; }
        public bool OnWeb { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public bool InComputyme { get; set; }
        public double? Limit { get; set; }
        public double? Balance { get; set; }
        public double? CurrentDue { get; set; }
        public double? Days30 { get; set; }
        public double? Days60 { get; set; }
        public double? Days90 { get; set; }
        public double? PastDue { get; set; }
        public double? OpenOrders { get; set; }
        public double VendorExposure { get; set; }
        public double VendorBilled { get; set; }
        public double? Available { get; set; }
        public double ShippingSoon { get; set; }
        public double OpenInvoices { get; set; }
        public double Allocated { get; set; }
        public double EzPayInTransit { get; set; }
        public double? InvoiceAvailable { get; set; }
        public double? HighCredit { get; set; }
        public double? CurrentYearHigh { get; set; }
        public double? YtdSales { get; set; }
        public double? Investment { get; set; }
        public bool OnHold { get; set; }
        public string CreditStatus { get; set; }
    }

    public class CreditInvoice
    {
        public string InvoiceKey { get; set; }
        public string Invoice { get; set; }
        public DateTime? Posted { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public string Terms { get; set; }
        public string PO { get; set; }
        public string VendorInvoice { get; set; }
        public string VendorName { get; set; }
        public double? Gross { get; set; }
        public double? DiscountPct { get; set; }
        public int? AgeDays { get; set; }
    }

    public class CreditWebOrder
    {
        public int OrderId { get; set; }
        public string PO { get; set; }
        public DateTime Entered { get; set; }
        public double? Total { get; set; }
        public int Lines { get; set; }
        public bool AutoHold { get; set; }
        public bool HoldOverride { get; set; }
        public bool Held { get; set; }
        public string OrderedBy { get; set; }
    }

    public class CreditComputymeOrder
    {
        public string OrderKey { get; set; }
        public string PO { get; set; }
        public DateTime? ShipDate { get; set; }
        public string Code { get; set; }
        public string WebOrder { get; set; }
        public double? Total { get; set; }
        public int Lines { get; set; }
        public bool ShipsSoon { get; set; }
    }

    public class CreditBackorder
    {
        public string BackorderKey { get; set; }
        public string PO { get; set; }
        public DateTime? Ordered { get; set; }
        public DateTime? ShipDate { get; set; }
        public string ProductCode { get; set; }
        public string Description { get; set; }
        public double? Quantity { get; set; }
        public double? AllocatedQty { get; set; }
        public double? UnitNet { get; set; }
        public double? AllocatedValue { get; set; }
        public bool CountsNow { get; set; }
    }

    public class CreditVendorPo
    {
        public string VendorId { get; set; }
        public string VendorName { get; set; }
        public string PO { get; set; }
        public DateTime? PoDate { get; set; }
        public double? Amount { get; set; }
        public double? Billed { get; set; }
        public double? Net { get; set; }
    }

    public class CreditVendorApproval
    {
        public int ApprovalId { get; set; }
        public DateTime Requested { get; set; }
        public string VendorId { get; set; }
        public string VendorName { get; set; }
        public string PO { get; set; }
        public decimal Amount { get; set; }
        public string AuthorizationCode { get; set; }
        public string RequestedBy { get; set; }
        public bool Declined { get; set; }
    }

    public class CreditNoteRow
    {
        public int Id { get; set; }
        public string Kind { get; set; }
        public int? OrderId { get; set; }
        public string Note { get; set; }
        public string CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreditMember
    {
        public CreditHeader Header { get; set; }
        public List<CreditInvoice> Invoices { get; set; } = new();
        public List<CreditWebOrder> WebOrders { get; set; } = new();
        public List<CreditComputymeOrder> ComputymeOrders { get; set; } = new();
        public List<CreditBackorder> Backorders { get; set; } = new();
        public List<CreditVendorPo> VendorPos { get; set; } = new();
        public List<CreditVendorApproval> VendorApprovals { get; set; } = new();
        public List<CreditNoteRow> Notes { get; set; } = new();
        public bool CanOverride { get; set; }
    }

    public class CreditMemberList
    {
        public List<CreditMemberRow> Members { get; set; } = new();
        public bool CanOverride { get; set; }
    }

    public class CreditOverrideRequest { public string Reason { get; set; } }
    public class CreditNoteRequest { public string Note { get; set; } public string Kind { get; set; } }
}
