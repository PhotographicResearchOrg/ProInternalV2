import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { OrdersMetrics } from 'src/app/models/Dashboard/OrdersMetrics';
import { PosImportSummary, SentOrder, ProductLookup, HeldOrderReleaseRequest, HeldOrderReleaseResult, OrderEditResponse, OrderInboxReviewItem, OrderInboxReviewDetail, OrderInboxActionResponse, OrderExportResult , OrderAuditRecord, UpdateOrderShipToRequest,OrderShipToOption,OrderActionResponse,OrderChannel,OrderRecord,OverrideOrderHoldRequest,ProcessOrdersRequest,RejectOrderRequest,RemoveOrderLineRequest,ReopenOrderRequest,UpdateOrderLineRequest,UpdateShippingNotesRequest} from 'src/app/models/orders/OrderModels';


@Injectable({
  providedIn: 'root'
})

export class OrdersService {
  constructor(private api: ApiService) { }
  getOrders() {return this.api.get<OrderRecord[]>('API/Orders');}

  getProcessedOrders(channel?: OrderChannel) { const url = channel ? `API/Orders/processed?channel=${encodeURIComponent(channel)}` : 'API/Orders/processed'; return this.api.get<OrderRecord[]>(url); }

  getOrder(orderId: string, orderSectionId?: string)
  {
    let url =`API/Orders/${encodeURIComponent(orderId)}`;
    if (orderSectionId) {url +=`?orderSectionId=${encodeURIComponent(orderSectionId)}`;}
    return this.api.get<OrderRecord>(url);
  }

  getOrderMetrics(): Observable<OrdersMetrics> {return this.api.get<OrdersMetrics>('API/Metrics/getOrderMetrics');}

  rejectOrder(orderId: string, reason: string): Observable<OrderActionResponse>
  {
    const request: RejectOrderRequest =
    {
      orderId,
      reason
    };
    return this.api.post<OrderActionResponse>(
      'API/Orders/reject',
      request
    );
  }

  overrideOrderHold(
    orderId: string
  ): Observable<OrderActionResponse> {
    const request: OverrideOrderHoldRequest = {
      orderId,
      reason: 'Manual override from Order Toolbench'
    };

    return this.api.post<OrderActionResponse>(
      'API/Orders/override-hold',
      request
    );
  }

  setFreeShipping(
    orderId: string,
    enabled: boolean
  ): Observable<OrderActionResponse> {
    return this.api.post<OrderActionResponse>(
      'API/Orders/free-shipping',
      {
        orderId,
        enabled
      }
    );
  }

  getShipToAddresses(
    orderId: string
  ): Observable<OrderShipToOption[]> {
    return this.api.get<OrderShipToOption[]>(
      `API/Orders/${orderId}/ship-to-addresses`
    );
  }

  updateShipTo(
    request: UpdateOrderShipToRequest
  ): Observable<OrderActionResponse> {
    return this.api.post<OrderActionResponse>(
      'API/Orders/update-ship-to',
      request
    );
  }

  getOrderAudit(
    orderId: string
  ): Observable<OrderAuditRecord[]> {
    return this.api.get<OrderAuditRecord[]>(
      `API/Orders/${encodeURIComponent(orderId)}/audit`
    );
  }



  processOrders(
    request: ProcessOrdersRequest
  ): Observable<OrderExportResult> {
    return this.api.post<OrderExportResult>(
      'API/Orders/process',
      request
    );
  }


  //Not yet configured.
  //-------------
  runPosOrders() {return this.api.post<OrderActionResponse>('API/Orders/run-pos',{}); }
  //------------------------------


  // ---- Needs Review (order inbox) --------------------------------

  getReviewOrders(includeRejected = false): Observable<OrderInboxReviewItem[]> {
    return this.api.get<OrderInboxReviewItem[]>(
      `API/OrderInbox/review?includeRejected=${includeRejected}`
    );
  }

  getReviewOrder(inboxId: number): Observable<OrderInboxReviewDetail> {
    return this.api.get<OrderInboxReviewDetail>(
      `API/OrderInbox/review/${inboxId}`
    );
  }

  rejectReviewOrder(
    inboxId: number,
    reason: string
  ): Observable<OrderInboxActionResponse> {
    return this.api.post<OrderInboxActionResponse>(
      'API/OrderInbox/reject',
      { inboxId, reason }
    );
  }


  // ---- Consumer orders -------------------------------------------
  // Same shape as warehouse orders, separate routes: consumer and
  // warehouse order ids can collide.

  getConsumerOrders(): Observable<OrderRecord[]> {
    return this.api.get<OrderRecord[]>('API/Orders/consumer');
  }

  getConsumerOrder(orderId: string): Observable<OrderRecord> {
    return this.api.get<OrderRecord>(
      `API/Orders/consumer/${encodeURIComponent(orderId)}`
    );
  }

  getConsumerOrderAudit(orderId: string): Observable<OrderAuditRecord[]> {
    return this.api.get<OrderAuditRecord[]>(
      `API/Orders/consumer/${encodeURIComponent(orderId)}/audit`
    );
  }

  updateConsumerShipTo(
    request: UpdateOrderShipToRequest
  ): Observable<OrderActionResponse> {
    return this.api.post<OrderActionResponse>(
      'API/Orders/consumer/update-ship-to',
      request
    );
  }

  rejectConsumerOrder(
    orderId: string,
    reason: string
  ): Observable<OrderActionResponse> {
    const request: RejectOrderRequest = {
      orderId,
      reason
    };

    return this.api.post<OrderActionResponse>(
      'API/Orders/consumer/reject',
      request
    );
  }


  // ---- Modify an order -------------------------------------------
  // The channel picks the route, because a consumer order id and a
  // warehouse order id can be the same number.

  private orderRoute(order: { orderId: string; channel: OrderChannel }): string {
    const id = encodeURIComponent(order.orderId);

    return order.channel === 'consumer'
      ? `API/Orders/consumer/${id}`
      : `API/Orders/${id}`;
  }

  editOrderLine(
    order: { orderId: string; channel: OrderChannel },
    lineId: string,
    quantity: number
  ): Observable<OrderEditResponse> {
    return this.api.post<OrderEditResponse>(
      `${this.orderRoute(order)}/lines/${encodeURIComponent(lineId)}`,
      { orderId: order.orderId, lineId, quantity }
    );
  }

  removeOrderLine(
    order: { orderId: string; channel: OrderChannel },
    lineId: string,
    reason: string
  ): Observable<OrderEditResponse> {
    return this.api.post<OrderEditResponse>(
      `${this.orderRoute(order)}/lines/${encodeURIComponent(lineId)}/remove`,
      { orderId: order.orderId, lineId, reason }
    );
  }

  /* Warehouse orders only. */
  setShippingNotes(
    orderId: string,
    shippingNotes: string
  ): Observable<OrderEditResponse> {
    return this.api.post<OrderEditResponse>(
      `API/Orders/${encodeURIComponent(orderId)}/shipping-notes`,
      { orderId, shippingNotes }
    );
  }


  // ---- Needs Review: fix and release -----------------------------

  searchProducts(term: string): Observable<ProductLookup[]> {
    return this.api.get<ProductLookup[]>(
      `API/OrderInbox/products?term=${encodeURIComponent(term)}`
    );
  }

  releaseHeldOrder(
    request: HeldOrderReleaseRequest
  ): Observable<HeldOrderReleaseResult> {
    return this.api.post<HeldOrderReleaseResult>(
      'API/OrderInbox/release',
      request
    );
  }


  importPosOrders(): Observable<PosImportSummary> {
    return this.api.post<PosImportSummary>(
      'API/OrderInbox/import/pos',
      {}
    );
  }

  // new for EDI
  importEdiOrders(): Observable<PosImportSummary> {
    return this.api.post<PosImportSummary>(
      'API/OrderInbox/import/edi',
      {}
    );
  }




  // ---- Send, sent orders, responses, reopen ----------------------

  processConsumerOrders(
    request: ProcessOrdersRequest
  ): Observable<OrderExportResult> {
    return this.api.post<OrderExportResult>(
      'API/Orders/consumer/process',
      request
    );
  }

  getSentOrders(days = 30): Observable<SentOrder[]> {
    return this.api.get<SentOrder[]>(`API/Orders/sent?days=${days}`);
  }

  setSentResponse(
    order: { orderId: string; channel: OrderChannel },
    state: 'ACKNOWLEDGED' | 'FAILED',
    destinationOrderId: string,
    reason: string
  ): Observable<OrderEditResponse> {
    return this.api.post<OrderEditResponse>(
      'API/Orders/sent/response',
      {
        orderId: order.orderId,
        channel: order.channel,
        state,
        destinationOrderId,
        reason
      }
    );
  }

  reopenOrder(
    order: { orderId: string; channel: OrderChannel },
    reason: string
  ): Observable<OrderEditResponse> {
    return this.api.post<OrderEditResponse>(
      'API/Orders/reopen',
      {
        orderId: order.orderId,
        channel: order.channel,
        reason
      }
    );
  }
}
