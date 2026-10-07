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

        OrderActionResponse RejectOrder(RejectOrderRequest request);
        OrderActionResponse UpdateShippingNotes(UpdateShippingNotesRequest request);
        OrderActionResponse OverrideOrderHold(OverrideOrderHoldRequest request);
        OrderActionResponse SetFreeShipping(SetFreeShippingRequest request);
        IEnumerable<OrderShipToOptionDto> GetShipToAddresses(string orderId);
        OrderActionResponse UpdateShipTo(UpdateOrderShipToRequest request);
        IEnumerable<OrderAuditDto> GetOrderAudit(string orderId);


        List<OrderRecordDto> GetConsumerOrders();
        OrderRecordDto? GetConsumerOrder(string orderId);
        OrderActionResponse UpdateConsumerShipTo(UpdateOrderShipToRequest request);
        OrderActionResponse RejectConsumerOrder(RejectOrderRequest request);
        IEnumerable<OrderAuditDto> GetConsumerOrderAudit(string orderId);


        OrderEditResponse EditLine(int orderId, int orderItemId, int quantity, string actionBy, string actionSource);
        OrderEditResponse RemoveLine(int orderId, int orderItemId, string reason, string actionBy, string actionSource);
        OrderEditResponse SetShippingNotes(int orderId, string? shippingNotes, string actionBy, string actionSource);
        OrderEditResponse EditConsumerLine(int orderId, int orderItemId, int quantity, string actionBy, string actionSource);
        OrderEditResponse RemoveConsumerLine(int orderId, int orderItemId, string reason, string actionBy, string actionSource);



    }
}