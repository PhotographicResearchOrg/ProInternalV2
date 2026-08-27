using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ProInternal.Models.Orders
{
    public class OrderAddressDto
    {

        public int? AddressId { get; set; } 
        public string? CompanyName { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string Address1 { get; set; } = "";
        public string? Address2 { get; set; }
        public string City { get; set; } = "";
        public string State { get; set; } = "";
        public string PostalCode { get; set; } = "";
        public string? Country { get; set; }
    }


    public class OrderAuditDto
    {
        public string ActionType { get; set; } = "";
        public string? Reason { get; set; }
        public string? ActionBy { get; set; }
        public string? ActionSource { get; set; }
        public string? ActionData { get; set; }
        public DateTime ActionDate { get; set; }
    }


    public class SetFreeShippingRequest
    {
        public string OrderId { get; set; } = "";
        public bool Enabled { get; set; }

        [JsonIgnore]
        public string? ActionBy { get; set; }

        [JsonIgnore]
        public string? ActionSource { get; set; }
    }


    public class OrderLineDto
    {
        public string? LineId { get; set; }
        public string Sku { get; set; } = "";
        public string Description { get; set; } = "";
        public decimal Quantity { get; set; }
        public decimal Total { get; set; }

        public string? StockStatus { get; set; }
        public decimal? UnitCost { get; set; }
        public string? Notes { get; set; }
        public string? SpecialName { get; set; }
    }

    public class OrderRecordDto
    {

        public bool FreeShipping { get; set; }
        public bool HasSpecial { get; set; }
        public string? OrderSectionId { get; set; }
        public string OrderId { get; set; } = "";
        public string Channel { get; set; } = "";

        public string CustomerName { get; set; } = "";
        public string CustomerReference { get; set; } = "";

        public string Source { get; set; } = "";
        public string OrderType { get; set; } = "";
        public string Status { get; set; } = "";

        public DateTime EnteredDate { get; set; }
        public decimal Total { get; set; }

        public string PaymentMethod { get; set; } = "";
        public string ShippingMethod { get; set; } = "";
        public string SystemReference { get; set; } = "";

        public string? AccountNumber { get; set; }
        public string? PoNumber { get; set; }
        public string? ComputymeOrderId { get; set; }

        public OrderAddressDto? ShippingAddress { get; set; }
        public OrderAddressDto? BillingAddress { get; set; }

        public decimal? AvailableBalance { get; set; }
        public decimal? NetAvailable { get; set; }

        public string? ShippingNotes { get; set; }
        public string? CreditStatus { get; set; }

        public bool AutoHold { get; set; }
        public bool HoldOverride { get; set; }

        public string? RejectionReason { get; set; }

        public List<OrderLineDto> Lines { get; set; } = new();
    }

    public class OrderSearchRequest
    {
        public string? Channel { get; set; }
        public string? Status { get; set; }
        public string? SearchTerm { get; set; }
        public DateTime? DateFrom { get; set; }
        public DateTime? DateTo { get; set; }
    }

    public class RejectOrderRequest
    {
        public string OrderId { get; set; } = "";
        public string Reason { get; set; } = "";

        [JsonIgnore]
        public string? ActionBy { get; set; }

        [JsonIgnore]
        public string? ActionSource { get; set; }

    }

    public class OverrideOrderHoldRequest
    {
        public string OrderId { get; set; } = "";
        public string Reason { get; set; } = "";

        [JsonIgnore]
        public string? ActionBy { get; set; }

        [JsonIgnore]
        public string? ActionSource { get; set; }

    }

    public class ProcessOrdersRequest
    {
        public List<string> OrderIds { get; set; } = new();
    }

    public class ReopenOrderRequest
    {
        public string OrderId { get; set; } = "";
        public string Reason { get; set; } = "";
    }

    public class UpdateShippingNotesRequest
    {
        public string OrderId { get; set; } = "";
        public string ShippingNotes { get; set; } = "";
    }

    public class UpdateOrderLineRequest
    {
        public string OrderId { get; set; } = "";
        public string LineId { get; set; } = "";
        public decimal Quantity { get; set; }
        public string? Notes { get; set; }
    }

    public class RemoveOrderLineRequest
    {
        public string OrderId { get; set; } = "";
        public string LineId { get; set; } = "";
        public string Reason { get; set; } = "";
    }

    public class OrderActionResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = "";
        public string? OrderId { get; set; }
        public string? BatchId { get; set; }
    }


    public class OrderShipToOptionDto
    {
        public int AddressId { get; set; }
        public bool IsDefaultShipTo { get; set; }

        public string? CompanyName { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }

        public string Address1 { get; set; } = "";
        public string? Address2 { get; set; }
        public string City { get; set; } = "";
        public string State { get; set; } = "";
        public string PostalCode { get; set; } = "";
        public string? Country { get; set; }
    }


    public class UpdateOrderShipToRequest
    {
        public string OrderId { get; set; } = "";
        public string Mode { get; set; } = "";

        public int? AddressId { get; set; }

        public string? CompanyName { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }

        public string? Address1 { get; set; }
        public string? Address2 { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PostalCode { get; set; }
        public string? Country { get; set; }

        public string? Phone { get; set; }
        public string? Email { get; set; }

        [JsonIgnore]
        public string? ActionBy { get; set; }

        [JsonIgnore]
        public string? ActionSource { get; set; }
    }



}