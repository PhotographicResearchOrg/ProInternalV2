using Dapper;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Models.Orders;
using System.Collections.Generic;
using System.Data;
using System.Linq;

namespace ProInternal.Services
{

    public class OrdersDataAccess: BaseDataAccess, IOrdersDataAccess
    {
        public OrdersDataAccess(
            IConfiguration config,
            AwsSecretHelper helper
        )
            : base(
                config,
                helper,
                "ProConnectionString"
            )
        {
        }

        public List<OrderRecordDto> GetOrders(
            OrderSearchRequest request
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

        public List<OrderRecordDto> GetProcessedOrders(
            string? channel
        )
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
                {
 Channel = channel
                },
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

            order.ShippingAddress =
                results.ReadFirstOrDefault<OrderAddressDto>();

            order.BillingAddress =
                results.ReadFirstOrDefault<OrderAddressDto>();

            order.Lines =
                results.Read<OrderLineDto>().ToList();

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


        public OrderActionResponse ProcessOrders(
            ProcessOrdersRequest request
        )
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "Orders_Process",
                new
                {
                    OrderIds = string.Join(
                        ",",
                        request.OrderIds
                    )
                },
                commandType:
                    CommandType.StoredProcedure
            );
        }

        public OrderActionResponse RunPosOrders()
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "Orders_RunPos",
                commandType:
                    CommandType.StoredProcedure
            );
        }

        public OrderActionResponse ReopenOrder(ReopenOrderRequest request)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>("Orders_Reopen",
                new
                {
                    OrderId = request.OrderId,
                    Reason = request.Reason
                },
                commandType:
                    CommandType.StoredProcedure
            );
        }

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

        public OrderActionResponse UpdateOrderLine(
            UpdateOrderLineRequest request
        )
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "Orders_UpdateLine",
                new
                {
                    OrderId = request.OrderId,
                    LineId = request.LineId,
                    Quantity = request.Quantity,
                    Notes = request.Notes
                },
                commandType:
                    CommandType.StoredProcedure
            );
        }

        public OrderActionResponse RemoveOrderLine(RemoveOrderLineRequest request)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "Orders_RemoveLine",
                new
                {
                    OrderId = request.OrderId,
                    LineId = request.LineId,
                    Reason = request.Reason
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
                throw new ArgumentException(
                    "A valid OrderId is required.",
                    nameof(request)
                );
            }

            using var conn = GetConnection();

            return conn.QuerySingle<OrderActionResponse>(
                "dbo.PIV2_Orders_OverrideHold",
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

            return conn.Query<OrderShipToOptionDto>(
                "dbo.PIV2_Orders_GetShipToAddresses",
                new
                {
                    OrderId = Convert.ToInt32(orderId)
                },
                commandType: CommandType.StoredProcedure
            ).ToList();
        }


        public OrderActionResponse UpdateShipTo(
    UpdateOrderShipToRequest request)
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

            return conn.Query<OrderAuditDto>(
                "dbo.PIV2_Orders_GetAudit",
                new
                {
                    OrderId = orderId
                },
                commandType: CommandType.StoredProcedure
            ).ToList();
        }


    }
}