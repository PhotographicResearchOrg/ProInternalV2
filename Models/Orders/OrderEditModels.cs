using System.Collections.Generic;

namespace ProInternal.Models.Orders
{
    /* Change a line quantity, or remove a line (Reason required). */
    public sealed class OrderLineEditRequest
    {
        public string? OrderId { get; set; }

        /*
         * The LineId the order detail returned.
         *   warehouse  "OrderItemId:OrderId"
         *   consumer   "OrderItemConsumerId"
         */
        public string? LineId { get; set; }

        public int Quantity { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class OrderShippingNotesRequest
    {
        public string? OrderId { get; set; }
        public string? ShippingNotes { get; set; }
    }

    /* The result of one change to an order. */
    public sealed class OrderEditResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? OrderId { get; set; }

        /*
         * Filled after a saved change when the order, rebuilt as a
         * contract order, no longer passes the contract. The change is
         * kept; the order cannot be sent until these are cleared.
         */
        public List<string> ContractErrors { get; set; } = new();
    }
}
