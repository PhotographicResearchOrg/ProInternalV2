using Dapper;
using System;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Models.Orders;
using System.Collections.Generic;
using System.Data;
using System.Linq;


//Orders screen Service
namespace ProInternal.Services
{

    public class OrdersDataAccess: BaseDataAccess, IOrdersDataAccess
    {
        public OrdersDataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config,helper,"ProConnectionString")
        {
        }

        public List<OrderRecordDto> GetOrders(OrderSearchRequest request
        )
        {
            using var conn = GetConnection();
            return conn.Query<OrderRecordDto,OrderAddressDto,OrderRecordDto>
                ("PIV2_Orders_Get",(order, shippingAddress) =>
                    {
                        order.ShippingAddress =shippingAddress;
                        order.Lines =new List<OrderLineDto>();
                        return order;
                    },
                    new
                    {
                        Channel = request.Channel,
                        Status = request.Status,
                        SearchTerm = request.SearchTerm,
                        DateFrom = request.DateFrom,
                        DateTo = request.DateTo
                    },
                    splitOn: "Address1",
                    commandType:
                    CommandType.StoredProcedure
            ).ToList();
        }

        public List<OrderRecordDto> GetProcessedOrders(string? channel)
        {
            using var conn = GetConnection();
            return conn.Query<OrderRecordDto,OrderAddressDto, OrderRecordDto>
                ("Orders_GetProcessed",(order, shippingAddress) =>
                {
                    order.ShippingAddress =shippingAddress;
                    order.Lines =new List<OrderLineDto>();
                    return order;
                },
                new
                {Channel = channel},
                splitOn: "Address1",
                commandType:
                CommandType.StoredProcedure
            ).ToList();
        }

       public OrderRecordDto? GetOrder(
       string orderId,
       string? orderSectionId)
        {
            using var conn = GetConnection();
            using var results = conn.QueryMultiple(
                "dbo.PIV2_Orders_GetById",
                new
                {
                    OrderId = orderId,
                    OrderSectionId = orderSectionId
                },
                commandType: CommandType.StoredProcedure
            );

            var order = results.ReadFirstOrDefault<OrderRecordDto>();

            if (order == null)
                return null;

            order.ShippingAddress =results.ReadFirstOrDefault<OrderAddressDto>();
            order.BillingAddress =results.ReadFirstOrDefault<OrderAddressDto>();
            order.Lines =results.Read<OrderLineDto>().ToList();
            return order;
        }

        public OrderActionResponse RejectOrder(RejectOrderRequest request)
        {
            if (!int.TryParse(request.OrderId, out var orderId))
                throw new ArgumentException("A valid OrderId is required.");

            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "dbo.PIV2_Orders_Reject",
                new
                {
                    OrderId = orderId,
                    request.Reason,
                    request.ActionBy,
                    request.ActionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }





//-------------------------------------------------------------Not Wired. -----------------------------------
        public OrderActionResponse RunPosOrders()
        {
            using var conn = GetConnection();
            return conn.QuerySingle<OrderActionResponse>( "TEMP", commandType:CommandType.StoredProcedure);
        }
        public OrderActionResponse ReopenOrder(ReopenOrderRequest request)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>("TEMP",
                new
                {
                    OrderId = request.OrderId,
                    Reason = request.Reason
                },
                commandType:CommandType.StoredProcedure
            );
        }


        public OrderActionResponse UpdateOrderLine(UpdateOrderLineRequest request)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "TEMP",
                new
                {
                    OrderId = request.OrderId,
                    LineId = request.LineId,
                    Quantity = request.Quantity,
                    Notes = request.Notes
                },
                commandType:CommandType.StoredProcedure
            );
        }

        public OrderActionResponse RemoveOrderLine(RemoveOrderLineRequest request)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>("TEMP",
                new
                {
                    OrderId = request.OrderId,
                    LineId = request.LineId,
                    Reason = request.Reason
                },
                commandType: CommandType.StoredProcedure
            );
        }

        //------------------------------------------------------------------------------



        public OrderActionResponse UpdateShippingNotes(
            UpdateShippingNotesRequest request
        )
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "Orders_UpdateShippingNotes",
                new
                {
                    OrderId = request.OrderId,
                    ShippingNotes =
                        request.ShippingNotes
                },
                commandType:
                    CommandType.StoredProcedure
            );
        }

      
        public OrderActionResponse SetFreeShipping(SetFreeShippingRequest request)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "dbo.PIV2_Orders_SetFreeShipping",
                new
                {
                    OrderId = Convert.ToInt32(request.OrderId),
                    request.Enabled,
                    request.ActionBy,
                    request.ActionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public OrderActionResponse OverrideOrderHold(OverrideOrderHoldRequest request)
        {
            if (!int.TryParse(request.OrderId, out var orderId))
            {
                throw new ArgumentException( "A valid OrderId is required.",nameof(request));
            }

            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>( "dbo.PIV2_Orders_OverrideHold",
                new
                {
                    OrderId = orderId,
                    request.Reason,
                    request.ActionBy,
                    request.ActionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public IEnumerable<OrderShipToOptionDto> GetShipToAddresses(string orderId)
        {
            using var conn = GetConnection();

            return conn.Query<OrderShipToOptionDto>("dbo.PIV2_Orders_GetShipToAddresses",
                new
                {
                    OrderId = Convert.ToInt32(orderId)
                },
                commandType: CommandType.StoredProcedure
            ).ToList();
        }


        public OrderActionResponse UpdateShipTo( UpdateOrderShipToRequest request)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "dbo.PIV2_Orders_UpdateShipTo",
                new
                {
                    OrderId = Convert.ToInt32(request.OrderId),
                    request.Mode,
                    request.AddressId,
                    request.CompanyName,
                    request.FirstName,
                    request.LastName,
                    request.Address1,
                    request.Address2,
                    request.City,
                    request.State,
                    request.PostalCode,
                    request.Country,
                    request.Phone,
                    request.Email,
                    request.ActionBy,
                    request.ActionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }


        public IEnumerable<OrderAuditDto> GetOrderAudit(string orderId)
        {
            using var conn = GetConnection();
            return conn.Query<OrderAuditDto>( "dbo.PIV2_Orders_GetAudit",
                new
                {
                    OrderId = orderId
                },
                commandType: CommandType.StoredProcedure
            ).ToList();
        }

        // ---------------------------------------------------------------
        // Consumer orders (OrderConsumer / OrderItemConsumer).
        //
        // Returned in the same shape as warehouse orders. Consumer and
        // warehouse order ids can collide, so every consumer call uses
        // its own stored procedure and never a warehouse one.
        // ---------------------------------------------------------------

        public List<OrderRecordDto> GetConsumerOrders()
        {
            using var conn = GetConnection();

            return conn.Query<OrderRecordDto, OrderAddressDto, OrderRecordDto>(
                "dbo.PIV2_Orders_GetConsumer",
                (order, shippingAddress) =>
                {
                    order.ShippingAddress = shippingAddress;
                    order.Lines = new List<OrderLineDto>();
                    return order;
                },
                splitOn: "Address1",
                commandType: CommandType.StoredProcedure
            ).ToList();
        }

        public OrderRecordDto? GetConsumerOrder(string orderId)
        {
            using var conn = GetConnection();

            using var results = conn.QueryMultiple(
                "dbo.PIV2_Orders_GetConsumerById",
                new { OrderId = orderId },
                commandType: CommandType.StoredProcedure
            );

            var order = results.ReadFirstOrDefault<OrderRecordDto>();

            if (order == null)
                return null;

            order.ShippingAddress = results.ReadFirstOrDefault<OrderAddressDto>();
            order.BillingAddress = results.ReadFirstOrDefault<OrderAddressDto>();
            order.Lines = results.Read<OrderLineDto>().ToList();

            return order;
        }

        public OrderActionResponse UpdateConsumerShipTo(UpdateOrderShipToRequest request)
        {
            if (!int.TryParse(request.OrderId, out var orderId))
                throw new ArgumentException("A valid OrderId is required.");

            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "dbo.PIV2_Orders_UpdateConsumerShipTo",
                new
                {
                    OrderId = orderId,
                    request.FirstName,
                    request.LastName,
                    request.Address1,
                    request.Address2,
                    request.City,
                    request.State,
                    request.PostalCode,
                    request.Country,
                    request.Phone,
                    request.Email,
                    request.ActionBy,
                    request.ActionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public OrderActionResponse RejectConsumerOrder(RejectOrderRequest request)
        {
            if (!int.TryParse(request.OrderId, out var orderId))
                throw new ArgumentException("A valid OrderId is required.");

            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "dbo.PIV2_Orders_RejectConsumer",
                new
                {
                    OrderId = orderId,
                    request.Reason,
                    request.ActionBy,
                    request.ActionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public IEnumerable<OrderAuditDto> GetConsumerOrderAudit(string orderId)
        {
            if (!int.TryParse(orderId, out var id))
                throw new ArgumentException("A valid OrderId is required.");

            using var conn = GetConnection();

            return conn.Query<OrderAuditDto>(
                "dbo.PIV2_Orders_GetConsumerAudit",
                new { OrderId = id },
                commandType: CommandType.StoredProcedure
            ).ToList();
        }

        // ---------------------------------------------------------------
        // Modify an order: line quantity, remove a line, shipping notes.
        // Each procedure audits the change and returns Success = false
        // with the reason when it refuses.
        // ---------------------------------------------------------------

        public OrderEditResponse EditLine(
            int orderId, int orderItemId, int quantity,
            string actionBy, string actionSource)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderEditResponse>(
                "dbo.PIV2_Orders_UpdateLine",
                new
                {
                    OrderId = orderId,
                    OrderItemId = orderItemId,
                    Quantity = quantity,
                    ActionBy = actionBy,
                    ActionSource = actionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public OrderEditResponse RemoveLine(
            int orderId, int orderItemId, string reason,
            string actionBy, string actionSource)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderEditResponse>(
                "dbo.PIV2_Orders_RemoveLine",
                new
                {
                    OrderId = orderId,
                    OrderItemId = orderItemId,
                    Reason = reason,
                    ActionBy = actionBy,
                    ActionSource = actionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public OrderEditResponse SetShippingNotes(
            int orderId, string? shippingNotes,
            string actionBy, string actionSource)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderEditResponse>(
                "dbo.PIV2_Orders_SetShippingNotes",
                new
                {
                    OrderId = orderId,
                    ShippingNotes = shippingNotes,
                    ActionBy = actionBy,
                    ActionSource = actionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public OrderEditResponse EditConsumerLine(
            int orderId, int orderItemId, int quantity,
            string actionBy, string actionSource)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderEditResponse>(
                "dbo.PIV2_Orders_UpdateConsumerLine",
                new
                {
                    OrderId = orderId,
                    OrderItemId = orderItemId,
                    Quantity = quantity,
                    ActionBy = actionBy,
                    ActionSource = actionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public OrderEditResponse RemoveConsumerLine(
            int orderId, int orderItemId, string reason,
            string actionBy, string actionSource)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderEditResponse>(
                "dbo.PIV2_Orders_RemoveConsumerLine",
                new
                {
                    OrderId = orderId,
                    OrderItemId = orderItemId,
                    Reason = reason,
                    ActionBy = actionBy,
                    ActionSource = actionSource
                },
                commandType: CommandType.StoredProcedure
            );
        }


    }
}
