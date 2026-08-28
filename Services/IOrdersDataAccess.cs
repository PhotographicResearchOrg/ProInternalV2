using ProInternal.Models.Orders;
using System.Collections.Generic;
//Orders screen Service
namespace ProInternal.Services
{
    public interface IOrdersDataAccess
    {
        List<OrderRecordDto> GetOrders(OrderSearchRequest request);
        List<OrderRecordDto> GetProcessedOrders(string? channel);
        OrderRecordDto? GetOrder(string orderId, string? orderSectionId);


        //Not wired. 
        //------------------------------------------------------------------
        OrderActionResponse RunPosOrders();
        OrderActionResponse ReopenOrder(ReopenOrderRequest request);
        OrderActionResponse UpdateOrderLine(UpdateOrderLineRequest request);
        OrderActionResponse RemoveOrderLine(RemoveOrderLineRequest request);
        //------------------------------------------------------------------


        OrderActionResponse RejectOrder(RejectOrderRequest request);
        OrderActionResponse UpdateShippingNotes(UpdateShippingNotesRequest request);
        OrderActionResponse OverrideOrderHold(OverrideOrderHoldRequest request);
        OrderActionResponse SetFreeShipping(SetFreeShippingRequest request);
        IEnumerable<OrderShipToOptionDto> GetShipToAddresses(string orderId);
        OrderActionResponse UpdateShipTo(UpdateOrderShipToRequest request);
        IEnumerable<OrderAuditDto> GetOrderAudit(string orderId);

    }
}