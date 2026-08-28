import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { OrdersMetrics } from 'src/app/models/Dashboard/OrdersMetrics';
import { OrderExportResult , OrderAuditRecord, UpdateOrderShipToRequest,OrderShipToOption,OrderActionResponse,OrderChannel,OrderRecord,OverrideOrderHoldRequest,ProcessOrdersRequest,RejectOrderRequest,RemoveOrderLineRequest,ReopenOrderRequest,UpdateOrderLineRequest,UpdateShippingNotesRequest} from 'src/app/models/orders/OrderModels';


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
  reopenOrder(request: ReopenOrderRequest) {return this.api.post<OrderActionResponse>(`API/Orders/${encodeURIComponent(request.orderId)}/reopen`,request);}
  updateShippingNotes(request: UpdateShippingNotesRequest) {return this.api.post<OrderActionResponse>( `API/Orders/${encodeURIComponent(request.orderId)}/shipping-notes`, request  );}
  updateOrderLine(request: UpdateOrderLineRequest) {return this.api.post<OrderActionResponse>(`API/Orders/${encodeURIComponent(request.orderId)}/lines/${encodeURIComponent(request.lineId)}`,request);}
  removeOrderLine(request: RemoveOrderLineRequest) {return this.api.post<OrderActionResponse>(`API/Orders/${encodeURIComponent(request.orderId)}/lines/${encodeURIComponent(request.lineId)}/remove`,request);}
  //------------------------------
}
