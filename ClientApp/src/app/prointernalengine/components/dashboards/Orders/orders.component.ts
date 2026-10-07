import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {  PosImportSummary, SentOrder, SentShipment, ProductLookup, HeldOrderReleaseRequest, OrderEditResponse, OrderLine, OrderInboxReviewItem, OrderInboxReviewDetail, ProcessOrdersRequest, OrderAuditRecord, UpdateOrderShipToRequest, OrderChannel, OrderStatus, OrderRecord, OrderShipToOption  } from 'src/app/models/orders/OrderModels';
import { OrdersService } from 'src/app/services/orders.service';
import { OrdersMetrics } from 'src/app/models/Dashboard/OrdersMetrics';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})

export class OrdersComponent implements OnInit {
  activeChannel: OrderChannel = 'warehouse';
  searchTerm = '';
  selectedStatus = 'All';
  selectedOrder: OrderRecord | null = null;
  rejectModalVisible = false;
  rejectTarget: OrderRecord | null = null;
  rejectReason = '';
  rejectReasonError = false;
  selectedOrderIds = new Set<string>();
  metricFilter: 'all' | 'open' | 'hold' | 'special' = 'all';
  overridingOrderId: string | null = null;
  rejectingOrderId: string | null = null;
  savingFreeShipping = false;
  showDsConfig = false;
  dsThreshold = 0;
  savingDsConfig = false;
  addressEditorVisible = false;
  addressEditorOrder: OrderRecord | null = null;
  addressOptions: OrderShipToOption[] = [];
  selectedShipToAddressId: number | null = null;
  addressEditorMode: 'saved' | 'dropship' = 'saved';
  loadingAddresses = false;
  addressError = '';
  savingAddress = false;
  auditModalVisible = false;
  auditLoading = false;
  auditError = '';
  auditRecords: OrderAuditRecord[] = [];
  auditOrder: OrderRecord | null = null;
  processingOrders = false;


  reviewTabActive = false;
  reviewOrders: OrderInboxReviewItem[] = [];
  reviewLoading = false;
  posImporting = false;
  ediImporting = false;
  reviewError = '';
  reviewShowRejected = false;
  reviewSelected: OrderInboxReviewDetail | null = null;
  reviewRawVisible = false;
  reviewRejectTarget: OrderInboxReviewItem | null = null;
  reviewRejectReason = '';
  reviewRejectReasonError = false;
  reviewRejecting = false;

  /* Consumer orders, in the same shape as warehouse orders. */
  consumerOrders: OrderRecord[] = [];
  consumerLoading = false;
  storeFilter = 'All';

  /* Modify an order: one line or the notes at a time. */
  editingLineId: string | null = null;
  editLineQuantity = 1;
  savingLine = false;
  removeLineTarget: OrderLine | null = null;
  removeLineReason = '';
  removeLineReasonError = false;
  editingNotes = false;
  notesDraft = '';
  savingNotes = false;

  /* Sent orders and what came back. */
  sentTabActive = false;
  sentOrders: SentOrder[] = [];
  sentLoading = false;
  sentError = '';
  sentAttentionOnly = false;
  sentActionMode: 'confirm' | 'fail' | 'reopen' | null = null;
  sentActionTarget: SentOrder | null = null;
  sentActionReason = '';
  sentActionNumber = '';
  sentActionError = '';
  sentActionSaving = false;

  /* Needs Review: fix and release. */
  reviewEditing = false;
  reviewReleasing = false;
  reviewEditLines: {
    lineId: string;
    productName: string;
    originalSku: string;
    sku: string;
    remove: boolean;
    problem: string;
  }[] = [];
  reviewEditShipTo = {
    firstName: '',
    lastName: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
    phone: ''
  };
  reviewEditEmail = '';
  productSearchLineId: string | null = null;
  productSearchTerm = '';
  productResults: ProductLookup[] = [];
  productSearching = false;
  productSearched = false;


  readonly statusOptions = [
    'All',
    'Open',
    'On Hold',
    'Approved',
    'Drop Ship',
    'Rejected'
  ];

  dsAddress = {
    companyName: '',
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'USA',
    phone: '',
    email: ''
  };


  public orderMetrics: OrdersMetrics = new OrdersMetrics();
  orders: OrderRecord[] = [];

  loadingOrders = false;
  ordersError = '';

  constructor(
    private router: Router,
    private ordersService: OrdersService,
    private dataService: DataService,
    public toast: MessageService
  ) { }

  ngOnInit(): void {
    this.loadOrders();
    this.loadOrderMetrics();
    this.loadReviewOrders();
    this.loadConsumerOrders();
    this.loadSentOrders();
  }

  selectMetricFilter(
    filter: 'all' | 'open' | 'hold' | 'special'
  ): void {
    this.metricFilter = filter;
    this.selectedStatus = 'All';
    this.selectedOrderIds.clear();
    this.selectedOrder = this.filteredOrders[0] ?? null;
  }
  isOrderOnHold(order: OrderRecord): boolean {
    const status = String(order.status || '').trim().toUpperCase();
    const creditStatus = String(order.creditStatus || '').trim().toUpperCase();

    return (
      status === 'ON HOLD' ||
      status === 'ON_HOLD' ||
      creditStatus === 'ON HOLD' ||
      (order.autoHold === true && order.holdOverride !== true)
    );
  }

  private matchesMetricFilter(order: OrderRecord): boolean {
    const status = String(order.status || '')
      .trim()
      .toUpperCase();

    const type = String(order.orderType || '')
      .trim()
      .toUpperCase();

    const creditStatus = String(order.creditStatus || '')
      .trim()
      .toUpperCase();

    switch (this.metricFilter) {
      case 'open':
        return status === 'OPEN' || status === 'READY';

      case 'hold':
        return this.isOrderOnHold(order);

      case 'special':
        return order.hasSpecial === true;

      default:
        return true;
    }
  }


  openDsConfig(): void {
    this.showDsConfig = true;

    this.dataService
      .getDropShipThreshold()
      .subscribe((threshold: number) => {
        this.dsThreshold = threshold;
      });
  }

  closeDsConfig(): void {
    this.showDsConfig = false;
  }

  saveDsConfig(): void {
    this.savingDsConfig = true;

    this.dataService
      .setDropShipThreshold(this.dsThreshold, 'Order Toolbench')
      .subscribe({
        next: () => {
          this.toast.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Drop Ship ceiling updated'
          });

          this.showDsConfig = false;
          this.savingDsConfig = false;
          this.loadOrderMetrics();
        },

        error: error => {
          console.error(
            'Unable to update Drop Ship ceiling.',
            error
          );

          this.savingDsConfig = false;
        }
      });
  }

  get filteredOrders(): OrderRecord[] {
    const search = this.searchTerm.trim().toUpperCase();
    const selectedStatus = this.selectedStatus.toUpperCase();

    return this.activeOrders.filter(order => {
      const status = String(order.status || '')
        .trim()
        .toUpperCase();

      const type = String(order.orderType || '')
        .trim()
        .toUpperCase();

      const creditStatus = String(order.creditStatus || '')
        .trim()
        .toUpperCase();

      const isOnHold = this.isOrderOnHold(order);

      const matchesStore =
        this.activeChannel !== 'consumer' ||
        this.storeFilter === 'All' ||
        (order.storeId || '') === this.storeFilter;

      const isDropShip =
        status === 'DROP SHIP' ||
        type.includes('DROP SHIP');

      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'ON HOLD' && isOnHold) ||
        (selectedStatus === 'DROP SHIP' && isDropShip) ||
        status === selectedStatus;

      const searchableText = [
        order.orderId,
        order.customerName,
        order.customerReference,
        order.source,
        order.orderType,
        order.accountNumber,
        order.poNumber,
        order.computymeOrderId,
        order.systemReference,
        order.storeId,
        order.shippingAddress?.address1,
        order.shippingAddress?.address2,
        order.shippingAddress?.city,
        order.shippingAddress?.state,
        order.shippingAddress?.postalCode
      ]
        .filter(value => value !== null && value !== undefined)
        .join(' ')
        .toUpperCase();

      return (
        order.channel === this.activeChannel &&
        matchesStore &&
        matchesStatus &&
        (!search || searchableText.includes(search)) &&
        this.matchesMetricFilter(order)
      );
    });
  }


  toggleFreeShipping(order: OrderRecord): void {
    if (this.isConsumer(order)) {
      return;
    }

    const enabled = !order.freeShipping;

    this.savingFreeShipping = true;

    this.ordersService
      .setFreeShipping(order.orderId, enabled)
      .subscribe({
        next: () => {
          order.freeShipping = enabled;

          if (enabled) {
            order.shippingNotes = 'NFPLO';
          } else if (
            order.shippingNotes?.trim().toUpperCase() === 'NFPLO'
          ) {
            order.shippingNotes = '';
          }

          this.savingFreeShipping = false;
        },

        error: error => {
          console.error(
            'Unable to update free shipping.',
            error
          );

          this.savingFreeShipping = false;
        }
      });
  }


  get selectableFilteredOrders(): OrderRecord[] {
    return this.filteredOrders.filter(order =>
      this.canProcess(order)
    );
  }

  get allVisibleSelected(): boolean {
    const selectable = this.selectableFilteredOrders;

    return (
      selectable.length > 0 &&
      selectable.every(order =>
        this.selectedOrderIds.has(order.orderId)
      )
    );
  }

  get someVisibleSelected(): boolean {
    return (
      !this.allVisibleSelected &&
      this.selectableFilteredOrders.some(order =>
        this.selectedOrderIds.has(order.orderId)
      )
    );
  }

  toggleSelectAll(event: Event): void {
    event.stopPropagation();

    const checked =
      (event.target as HTMLInputElement).checked;

    for (const order of this.selectableFilteredOrders) {
      if (checked) {
        this.selectedOrderIds.add(order.orderId);
      } else {
        this.selectedOrderIds.delete(order.orderId);
      }
    }
  }

  toggleAllVisibleSelection(): void {
    if (this.allVisibleSelected) {
      for (const order of this.selectableFilteredOrders) {
        this.selectedOrderIds.delete(order.orderId);
      }
    } else {
      for (const order of this.selectableFilteredOrders) {
        this.selectedOrderIds.add(order.orderId);
      }
    }
  }

  loadOrders(): void {
    this.loadingOrders = true;
    this.ordersError = '';
    this.ordersService.getOrders().subscribe({
      next: (orders: OrderRecord[]) => {
        this.orders = (orders ?? []).map(order => ({
          ...order,
          enteredDate: new Date(order.enteredDate),
          lines: order.lines ?? []
        }));

        this.selectedOrder = this.filteredOrders[0] ?? null;
      },

      error: error => {
        console.error('Unable to load orders.', error);

        this.orders = [];
        this.selectedOrder = null;
        this.ordersError = 'Unable to load warehouse orders.';
        this.loadingOrders = false;
      },

      complete: () => {
        this.loadingOrders = false;
      }
    });
  }


  openAudit(order: OrderRecord): void {
    this.auditOrder = order;
    this.auditRecords = [];
    this.auditError = '';
    this.auditLoading = true;
    this.auditModalVisible = true;

    const audit$ = this.isConsumer(order)
      ? this.ordersService.getConsumerOrderAudit(order.orderId)
      : this.ordersService.getOrderAudit(order.orderId);

    audit$.subscribe({
      next: records => {
        this.auditRecords = records ?? [];
        this.auditLoading = false;
      },

      error: error => {
        console.error('Unable to load order audit.', error);
        this.auditError = 'Unable to load order activity.';
        this.auditLoading = false;
      }
    });
  }

  closeAudit(): void {
    this.auditModalVisible = false;
    this.auditOrder = null;
    this.auditRecords = [];
    this.auditError = '';
  }



  openRejectModal(order: OrderRecord, event?: Event): void {
    event?.stopPropagation();

    this.rejectTarget = order;
    this.rejectReason = '';
    this.rejectReasonError = false;
    this.rejectModalVisible = true;
  }

  closeRejectModal(): void {
    this.rejectModalVisible = false;
    this.rejectTarget = null;
    this.rejectReason = '';
    this.rejectReasonError = false;
  }

  confirmReject(): void {
    const reason = this.rejectReason.trim();
    const target = this.rejectTarget;

    if (!reason || !target) {
      this.rejectReasonError = true;
      return;
    }

    this.rejectingOrderId = target.orderId;

    if (this.isConsumer(target)) {
      this.ordersService
        .rejectConsumerOrder(target.orderId, reason)
        .subscribe({
          next: result => {
            this.rejectingOrderId = null;

            if (!result.success) {
              this.toast.add({
                severity: 'warn',
                summary: 'Not rejected',
                detail: result.message
              });

              return;
            }

            this.closeRejectModal();
            this.selectedOrder = null;
            this.loadConsumerOrders();
          },

          error: error => {
            this.rejectingOrderId = null;
            console.error('Unable to reject consumer order.', error);
          }
        });

      return;
    }

    this.ordersService
      .rejectOrder(target.orderId, reason)
      .subscribe({
        next: () => {
          this.rejectingOrderId = null;
          this.selectedOrderIds.delete(target.orderId);
          this.closeRejectModal();
          this.loadOrders();
          this.loadOrderMetrics();
        },

        error: error => {
          this.rejectingOrderId = null;
          console.error('Unable to reject order.', error);
        }
      });
  }


  overrideHold(order: OrderRecord): void {
    if (this.isConsumer(order) || !order.autoHold || order.holdOverride) {
      return;
    }

    this.overridingOrderId = order.orderId;

    this.ordersService
      .overrideOrderHold(order.orderId)
      .subscribe({
        next: () => {
          this.overridingOrderId = null;
          this.loadOrders();
          this.loadOrderMetrics();
        },

        error: error => {
          this.overridingOrderId = null;

          console.error(
            'Unable to override automatic hold.',
            error
          );
        }
      });
  }

  canProcess(order: OrderRecord): boolean {
    if (this.isConsumer(order)) {
      return String(order.status || '').trim().toUpperCase() === 'OPEN';
    }

    const status = String(order.status || '')
      .trim()
      .toUpperCase();

    const type = String(order.orderType || '')
      .trim()
      .toUpperCase();

    const creditStatus = String(order.creditStatus || '')
      .trim()
      .toUpperCase();

    const onHold = this.isOrderOnHold(order);

    return (
      (status === 'OPEN' || status === 'READY') &&
      !onHold &&
      !type.includes('DROP SHIP')
    );
  }


  loadOrderMetrics(): void {
    this.ordersService.getOrderMetrics().subscribe({
      next: response => {
        this.orderMetrics = response;
      },
      error: error => {
        console.error('Unable to load order metrics.', error);
      }
    });
  }

  get readyCount(): number {
    return this.orders.filter(order => order.status === 'Ready').length;
  }

  get holdCount(): number {
    return this.orders.filter(order => order.status === 'On Hold').length;
  }

  get exceptionCount(): number {
    return this.orders.filter(order => order.status === 'Exception').length;
  }

  get openValue(): number {
    return this.orders.reduce((sum, order) => sum + order.total, 0);
  }

  get selectedCount(): number {
    return this.selectedOrderIds.size;
  }

  selectChannel(channel: OrderChannel): void {
    this.reviewTabActive = false;
    this.sentTabActive = false;
    this.activeChannel = channel;
    this.searchTerm = '';
    this.selectedStatus = 'All';
    this.metricFilter = 'all';
    this.selectedOrderIds.clear();
    this.selectedOrder = null;
    this.storeFilter = 'All';

    if (channel === 'warehouse') {
      this.loadOrders();
    } else {
      this.loadConsumerOrders();
    }
  }

  openOrder(order: OrderRecord): void {
    this.editingLineId = null;
    this.editingNotes = false;

    const order$ = this.isConsumer(order)
      ? this.ordersService.getConsumerOrder(order.orderId)
      : this.ordersService.getOrder(order.orderId, order.orderSectionId);

    order$
      .subscribe({
        next: detail => {
          this.selectedOrder = {
            ...detail,
            enteredDate: new Date(detail.enteredDate),
            lines: detail.lines ?? []
          };
        },

        error: error => {
          console.error(
            'Unable to load order details.',
            error
          );
        }
      });
  }

  toggleOrderSelection(orderId: string, event: Event): void {
    event.stopPropagation();

    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      this.selectedOrderIds.add(orderId);
    } else {
      this.selectedOrderIds.delete(orderId);
    }
  }

  isSelected(orderId: string): boolean {
    return this.selectedOrderIds.has(orderId);
  }

  selectReadyOrders(): void {
    this.filteredOrders
      .filter(order => order.status === 'Ready')
      .forEach(order => this.selectedOrderIds.add(order.orderId));
  }

  processSelected(): void {
    if (!this.selectedCount ||
      this.processingOrders) {
      return;
    }

    this.exportOrders(
      Array.from(this.selectedOrderIds),
      this.activeChannel
    );
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'All';
    this.metricFilter = 'all';
    this.storeFilter = 'All';
  }

  openEdiManagement(): void {
    this.router.navigate(['/orders/edi']);
  }


  processOrder(order: OrderRecord): void {
    if (!this.canProcess(order) ||
      this.processingOrders) {
      return;
    }

    this.exportOrders([order.orderId], order.channel);
  }


  private exportOrders(
    orderIds: string[],
    channel: OrderChannel
  ): void {
    this.processingOrders = true;
    this.ordersError = '';

    const request: ProcessOrdersRequest = {orderIds};

    /* Each channel has its own send; the ids overlap between them. */
    const export$ = channel === 'consumer'
      ? this.ordersService.processConsumerOrders(request)
      : this.ordersService.processOrders(request);

    export$
      .subscribe({
        next: result => {
          this.processingOrders = false;

          if (!result.success) {
            const details =
              Object.entries(result.errors ?? {})
                .flatMap(
                  ([orderId, errors]) =>
                    errors.map(
                      error =>
                        `Order ${orderId}: ${error}`
                    )
                );

            this.ordersError =
              details.length > 0
                ? details.join(' ')
                : result.message;

            this.toast.add({
              severity: 'error',
              summary:
                'Computyme File Not Generated',
              detail: result.message
            });

            return;
          }

          this.toast.add({
            severity: 'success',
            summary:
              'Computyme File Generated',
            detail:
              `${result.processedCount} order(s) written to ` +
              `${result.fileName}. Batch ${result.batchId}.`
          });

          for (const orderId of orderIds) {
            this.selectedOrderIds.delete(
              orderId);
          }

          /* Some orders can be left out of a consumer file. Say which. */
          const leftOut =
            Object.entries(result.errors ?? {})
              .flatMap(
                ([orderId, errors]) =>
                  errors.map(
                    error =>
                      `Order ${orderId}: ${error}`
                  )
              );

          if (leftOut.length > 0) {
            this.ordersError = leftOut.join(' ');
          }

          /* Sent orders leave their tab and appear on Sent. */
          this.selectedOrder = null;

          if (channel === 'consumer') {
            this.loadConsumerOrders();
          } else {
            this.loadOrders();
            this.loadOrderMetrics();
          }

          this.loadSentOrders();
        },

        error: error => {
          this.processingOrders = false;

          console.error(
            'Unable to generate Computyme file.',
            error);

          this.ordersError =
            error?.error?.message ??
            error?.error ??
            'Unable to generate the Computyme file.';

          this.toast.add({
            severity: 'error',
            summary: 'Computyme Export Failed',
            detail:
              'The server could not complete the export.'
          });
        }
      });
  }




  get warehouseOrderCount(): number {
    return this.orders.filter(
      order => order.channel === 'warehouse'
    ).length;
  }


  getHoldLabel(order: OrderRecord): string {
    const creditHold =
      String(order.creditStatus || '').trim().toUpperCase() === 'ON HOLD';

    const autoHold =
      order.autoHold === true &&
      order.holdOverride !== true;

    if (creditHold && autoHold) return 'Credit + Auto';
    if (creditHold) return 'Credit Hold';
    if (autoHold) return 'Auto Hold';

    return order.status;
  }

  get consumerOrderCount(): number {
    return this.consumerOrders.length;
  }

  isConsumer(order: OrderRecord | null | undefined): boolean {
    return order?.channel === 'consumer';
  }

  /* Sent, shipped and rejected orders are not changed here. */
  canEditOrder(order: OrderRecord | null | undefined): boolean {
    const status = String(order?.status || '').trim().toUpperCase();

    return !!order && !['APPROVED', 'SHIPPED', 'REJECTED'].includes(status);
  }

  startLineEdit(line: OrderLine): void {
    if (!line.lineId) {
      return;
    }

    this.editingLineId = line.lineId;
    this.editLineQuantity = line.quantity;
  }

  cancelLineEdit(): void {
    this.editingLineId = null;
  }

  saveLineEdit(order: OrderRecord, line: OrderLine): void {
    const quantity = Number(this.editLineQuantity);

    if (!line.lineId || this.savingLine) {
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      this.toast.add({
        severity: 'warn',
        summary: 'Quantity not saved',
        detail: 'Quantity must be a whole number, 1 or more.'
      });

      return;
    }

    if (quantity === line.quantity) {
      this.cancelLineEdit();
      return;
    }

    this.savingLine = true;

    this.ordersService
      .editOrderLine(order, line.lineId, quantity)
      .subscribe({
        next: result => {
          this.savingLine = false;
          this.afterOrderEdit(order, result, 'Quantity updated');

          if (result.success) {
            this.cancelLineEdit();
          }
        },

        error: error => {
          this.savingLine = false;
          this.orderEditFailed(error);
        }
      });
  }

  openRemoveLine(line: OrderLine): void {
    this.removeLineTarget = line;
    this.removeLineReason = '';
    this.removeLineReasonError = false;
  }

  closeRemoveLine(): void {
    this.removeLineTarget = null;
    this.removeLineReason = '';
    this.removeLineReasonError = false;
  }

  confirmRemoveLine(): void {
    const order = this.selectedOrder;
    const line = this.removeLineTarget;
    const reason = this.removeLineReason.trim();

    if (!order || !line?.lineId || this.savingLine) {
      return;
    }

    if (!reason) {
      this.removeLineReasonError = true;
      return;
    }

    this.savingLine = true;

    this.ordersService
      .removeOrderLine(order, line.lineId, reason)
      .subscribe({
        next: result => {
          this.savingLine = false;
          this.afterOrderEdit(order, result, 'Line removed');

          if (result.success) {
            this.closeRemoveLine();
          }
        },

        error: error => {
          this.savingLine = false;
          this.orderEditFailed(error);
        }
      });
  }

  startNotesEdit(order: OrderRecord): void {
    this.notesDraft = order.shippingNotes ?? '';
    this.editingNotes = true;
  }

  cancelNotesEdit(): void {
    this.editingNotes = false;
  }

  saveNotes(order: OrderRecord): void {
    if (this.savingNotes) {
      return;
    }

    this.savingNotes = true;

    this.ordersService
      .setShippingNotes(order.orderId, this.notesDraft.trim())
      .subscribe({
        next: result => {
          this.savingNotes = false;
          this.afterOrderEdit(order, result, 'Shipping notes updated');

          if (result.success) {
            this.editingNotes = false;
          }
        },

        error: error => {
          this.savingNotes = false;
          this.orderEditFailed(error);
        }
      });
  }

  /* Shows the outcome of a change and reloads the order from the server. */
  private afterOrderEdit(
    order: OrderRecord,
    result: OrderEditResponse,
    summary: string
  ): void {
    if (!result.success) {
      this.toast.add({
        severity: 'warn',
        summary: 'Not saved',
        detail: result.message
      });

      return;
    }

    const contractErrors = result.contractErrors ?? [];

    if (contractErrors.length > 0) {
      this.toast.add({
        severity: 'warn',
        summary: 'Saved, but the order fails the contract',
        detail: contractErrors.join(' '),
        life: 12000
      });
    } else {
      this.toast.add({
        severity: 'success',
        summary,
        detail: result.message
      });
    }

    this.reloadOrder(order);
  }

  private orderEditFailed(error: unknown): void {
    console.error('Unable to change the order.', error);

    this.toast.add({
      severity: 'error',
      summary: 'Change failed',
      detail: this.failureText(error, 'The server could not save this change.')
    });
  }

  /* A refused permission reads differently from a server fault. */
  private failureText(error: unknown, fallback: string): string {
    const status = (error as { status?: number } | null)?.status;

    return status === 403
      ? 'You do not have permission to do this.'
      : fallback;
  }

  // ---- Sent orders ----------------------------------------------------

  openSentTab(): void {
    this.reviewTabActive = false;
    this.sentTabActive = true;
    this.selectedOrder = null;
    this.selectedOrderIds.clear();
    this.loadSentOrders();
  }

  loadSentOrders(): void {
    this.sentLoading = true;
    this.sentError = '';

    this.ordersService.getSentOrders().subscribe({
      next: orders => {
        this.sentOrders = (orders ?? []).map(order => ({
          ...order,
          shipments: this.readShipments(order.shipmentsJson)
        }));

        this.sentLoading = false;
      },

      error: error => {
        console.error('Unable to load sent orders.', error);
        this.sentOrders = [];
        this.sentError = 'Unable to load sent orders.';
        this.sentLoading = false;
      }
    });
  }

  /* The shipments a destination reported. Anything unreadable is ignored. */
  private readShipments(json?: string): SentShipment[] {
    if (!json) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(json);

      return Array.isArray(parsed)
        ? parsed.filter(
            (shipment): shipment is SentShipment =>
              !!shipment && typeof shipment.shipmentId === 'string'
          )
        : [];
    } catch {
      return [];
    }
  }

  /* Rejected by the destination, or sent with no answer for too long. */
  needsAttention(order: SentOrder): boolean {
    return order.exportState === 'FAILED' || order.isOverdue;
  }

  get sentAttentionCount(): number {
    return this.sentOrders.filter(order => this.needsAttention(order)).length;
  }

  get filteredSentOrders(): SentOrder[] {
    return this.sentAttentionOnly
      ? this.sentOrders.filter(order => this.needsAttention(order))
      : this.sentOrders;
  }

  getSentStateLabel(order: SentOrder): string {
    switch (order.exportState) {
      case 'EXPORTED':
        return order.isOverdue ? 'No answer (overdue)' : 'Sent, no answer yet';
      case 'ACKNOWLEDGED':
        return 'Confirmed';
      case 'FAILED':
        return 'Rejected';
      default:
        return order.exportState;
    }
  }

  getSentStateClass(order: SentOrder): string {
    switch (order.exportState) {
      case 'ACKNOWLEDGED':
        return 'status-ready';
      case 'FAILED':
        return 'status-hold';
      default:
        return order.isOverdue ? 'status-exception' : 'status-progress';
    }
  }

  openSentAction(
    mode: 'confirm' | 'fail' | 'reopen',
    order: SentOrder
  ): void {
    this.sentActionMode = mode;
    this.sentActionTarget = order;
    this.sentActionReason = '';
    this.sentActionNumber = order.destinationOrderId ?? '';
    this.sentActionError = '';
  }

  closeSentAction(): void {
    this.sentActionMode = null;
    this.sentActionTarget = null;
    this.sentActionReason = '';
    this.sentActionNumber = '';
    this.sentActionError = '';
  }

  confirmSentAction(): void {
    const order = this.sentActionTarget;
    const mode = this.sentActionMode;
    const reason = this.sentActionReason.trim();

    if (!order || !mode || this.sentActionSaving) {
      return;
    }

    if (mode !== 'confirm' && !reason) {
      this.sentActionError = 'A reason is required.';
      return;
    }

    const action$ =
      mode === 'reopen'
        ? this.ordersService.reopenOrder(order, reason)
        : this.ordersService.setSentResponse(
            order,
            mode === 'confirm' ? 'ACKNOWLEDGED' : 'FAILED',
            this.sentActionNumber.trim(),
            reason
          );

    this.sentActionSaving = true;

    action$.subscribe({
      next: result => {
        this.sentActionSaving = false;

        if (!result.success) {
          this.sentActionError = result.message;
          return;
        }

        this.toast.add({
          severity: 'success',
          summary: mode === 'reopen' ? 'Order reopened' : 'Response recorded',
          detail: result.message
        });

        this.closeSentAction();
        this.loadSentOrders();

        if (mode === 'reopen') {
          /* It is back on its own tab. */
          this.loadOrders();
          this.loadOrderMetrics();
          this.loadConsumerOrders();
        }
      },

      error: error => {
        this.sentActionSaving = false;
        console.error('Unable to update the sent order.', error);

        this.sentActionError = this.failureText(
          error,
          'The server could not save this.'
        );
      }
    });
  }

  // ---- Needs Review: fix and release ----------------------------------

  /* Held Shopify, POS and EDI orders can be corrected and released here. */
  canFixReview(order: OrderInboxReviewItem): boolean {
    return (
      this.canRejectReview(order) &&
      ['SHOPIFY', 'POS', 'EDI'].includes(
        String(order.channel || '').toUpperCase()
      )
    );
  }

  startReviewEdit(): void {
    const held = this.reviewSelected;

    if (!held) {
      return;
    }

    this.reviewEditLines = (held.lines ?? [])
      .filter(line => !!line.lineId)
      .map(line => ({
        lineId: line.lineId as string,
        productName: line.productName ?? '',
        originalSku: line.sku ?? '',
        sku: line.sku ?? '',
        remove: false,
        problem: this.lineProblem(held, line.sku ?? '')
      }))
      /* Lines that need attention first. */
      .sort((a, b) => Number(!!b.problem) - Number(!!a.problem));

    const shipTo = held.shipTo;

    this.reviewEditShipTo = {
      firstName: shipTo?.firstName ?? '',
      lastName: shipTo?.lastName ?? '',
      line1: shipTo?.line1 ?? '',
      line2: shipTo?.line2 ?? '',
      city: shipTo?.city ?? '',
      region: shipTo?.region ?? '',
      postalCode: shipTo?.postalCode ?? '',
      country: shipTo?.country ?? '',
      phone: shipTo?.phone ?? ''
    };

    this.reviewEditEmail = held.customerEmail ?? '';
    this.closeProductSearch();
    this.reviewEditing = true;
  }

  /* Why this line is holding the order, if it is. */
  private lineProblem(held: OrderInboxReviewDetail, sku: string): string {
    const code = sku.trim();

    if (!code) {
      return 'No product code received';
    }

    const hit = (held.problems ?? []).find(problem =>
      ['UNKNOWN_ITEM', 'ITEM_NOT_FOR_SALE'].includes(problem.code) &&
      (problem.message ?? '').includes(code)
    );

    if (!hit) {
      return '';
    }

    return hit.code === 'ITEM_NOT_FOR_SALE'
      ? 'Not for sale: pick another product or remove this line'
      : 'Not a PRO product: pick the right one or remove this line';
  }

  cancelReviewEdit(): void {
    this.reviewEditing = false;
    this.closeProductSearch();
  }

  openProductSearch(line: { lineId: string; sku: string; productName: string }): void {
    this.productSearchLineId = line.lineId;
    this.productSearchTerm = line.sku || '';
    this.productResults = [];
    this.productSearched = false;
  }

  closeProductSearch(): void {
    this.productSearchLineId = null;
    this.productSearchTerm = '';
    this.productResults = [];
    this.productSearched = false;
  }

  runProductSearch(): void {
    const term = this.productSearchTerm.trim();

    if (term.length < 2 || this.productSearching) {
      return;
    }

    this.productSearching = true;

    this.ordersService.searchProducts(term).subscribe({
      next: products => {
        this.productResults = products ?? [];
        this.productSearching = false;
        this.productSearched = true;
      },

      error: error => {
        console.error('Unable to search products.', error);
        this.productResults = [];
        this.productSearching = false;
        this.productSearched = true;
      }
    });
  }

  pickProduct(product: ProductLookup): void {
    const line = this.reviewEditLines.find(
      candidate => candidate.lineId === this.productSearchLineId
    );

    if (line) {
      line.sku = product.productCode;
    }

    this.closeProductSearch();
  }

  releaseReviewOrder(): void {
    const held = this.reviewSelected;

    if (!held || this.reviewReleasing) {
      return;
    }

    const request: HeldOrderReleaseRequest = {
      inboxId: held.inboxId,
      lines: this.reviewEditing
        ? this.reviewEditLines
            .filter(line =>
              line.remove ||
              (line.sku.trim() !== '' &&
               line.sku.trim() !== line.originalSku)
            )
            .map(line => ({
              lineId: line.lineId,
              sku: line.sku.trim(),
              remove: line.remove
            }))
        : [],
      shipTo: this.reviewEditing ? { ...this.reviewEditShipTo } : undefined,
      email: this.reviewEditing ? this.reviewEditEmail.trim() : undefined
    };

    this.reviewReleasing = true;

    this.ordersService.releaseHeldOrder(request).subscribe({
      next: result => {
        this.reviewReleasing = false;

        if (result.released) {
          this.toast.add({
            severity: 'success',
            summary: 'Order released',
            detail: result.message
          });

          this.reviewEditing = false;
          this.reviewSelected = null;
          this.loadReviewOrders();
          this.loadConsumerOrders();
          this.loadOrders();
          return;
        }

        this.toast.add({
          severity: 'warn',
          summary: 'Still held',
          detail: result.message,
          life: 10000
        });

        /* Show what was saved and why it is still held. */
        this.reviewEditing = false;
        this.loadReviewOrders();
        this.openReviewOrder(held);
      },

      error: error => {
        this.reviewReleasing = false;
        console.error('Unable to release the held order.', error);

        this.toast.add({
          severity: 'error',
          summary: 'Release failed',
          detail: this.failureText(
            error,
            'The server could not release this order.'
          )
        });
      }
    });
  }

  /* Re-reads one order and carries its new total back to the grid row. */
  private reloadOrder(order: OrderRecord): void {
    const order$ = this.isConsumer(order)
      ? this.ordersService.getConsumerOrder(order.orderId)
      : this.ordersService.getOrder(order.orderId, order.orderSectionId);

    order$.subscribe({
      next: detail => {
        const fresh: OrderRecord = {
          ...detail,
          enteredDate: new Date(detail.enteredDate),
          lines: detail.lines ?? []
        };

        this.selectedOrder = fresh;

        this.activeOrders
          .filter(row =>
            row.orderId === fresh.orderId &&
            (row.orderSectionId ?? '') === (fresh.orderSectionId ?? '')
          )
          .forEach(row => {
            row.total = fresh.total;
            row.shippingNotes = fresh.shippingNotes;
          });
      },

      error: error => {
        console.error('Unable to reload the order.', error);
      }
    });
  }

  /* The list behind the tab that is showing. */
  get activeOrders(): OrderRecord[] {
    return this.activeChannel === 'consumer'
      ? this.consumerOrders
      : this.orders;
  }

  /* Stores that have open consumer orders. Built from the data. */
  get storeOptions(): string[] {
    const stores = new Set<string>();

    for (const order of this.consumerOrders) {
      if (order.storeId) {
        stores.add(order.storeId);
      }
    }

    return Array.from(stores).sort();
  }

  get addressEditorIsConsumer(): boolean {
    return this.isConsumer(this.addressEditorOrder);
  }

  loadConsumerOrders(): void {
    this.consumerLoading = true;

    this.ordersService.getConsumerOrders().subscribe({
      next: orders => {
        this.consumerOrders = (orders ?? []).map(order => ({
          ...order,
          enteredDate: new Date(order.enteredDate),
          lines: order.lines ?? []
        }));

        this.consumerLoading = false;
      },

      error: error => {
        console.error('Unable to load consumer orders.', error);

        this.consumerOrders = [];
        this.consumerLoading = false;

        if (this.activeChannel === 'consumer') {
          this.ordersError = 'Unable to load consumer orders.';
        }
      }
    });
  }


  openAddressEditor(order: OrderRecord): void {
    this.addressEditorOrder = order;
    this.addressEditorVisible = true;

    this.addressError = '';

    if (this.isConsumer(order)) {
      /* A consumer has no saved ship-to list: one free-form address. */
      const shipTo = order.shippingAddress;

      this.addressEditorMode = 'dropship';
      this.addressOptions = [];
      this.selectedShipToAddressId = null;
      this.loadingAddresses = false;

      this.dsAddress = {
        companyName: '',
        firstName: shipTo?.firstName ?? '',
        lastName: shipTo?.lastName ?? '',
        address1: shipTo?.address1 ?? '',
        address2: shipTo?.address2 ?? '',
        city: shipTo?.city ?? '',
        state: shipTo?.state ?? '',
        postalCode: shipTo?.postalCode ?? '',
        country: shipTo?.country ?? '',
        phone: order.shipPhone ?? '',
        email: order.shipEmail ?? ''
      };

      return;
    }

    this.addressEditorMode =
      order.orderType?.toUpperCase().includes('DROP')
        ? 'dropship'
        : 'saved';

    const address = order.shippingAddress;
    const isDropShip =
      order.orderType?.toUpperCase().includes('DROP');

    const dsParts = isDropShip
      ? (address?.address2 ?? '')
        .split('|')
        .map(value => value.trim())
      : [address?.address2 ?? '', '', ''];

    this.dsAddress = {
      companyName: address?.companyName ?? '',
      firstName: address?.firstName ?? '',
      lastName: address?.lastName ?? '',
      address1: address?.address1 ?? '',
      address2: dsParts[0] ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
      postalCode: address?.postalCode ?? '',
      country: address?.country ?? 'USA',
      phone: dsParts[1] ?? '',
      email: dsParts[2] ?? ''
    };

    this.selectedShipToAddressId =
      address?.addressId ?? null;


    this.loadingAddresses = true;

    this.ordersService
      .getShipToAddresses(order.orderId)
      .subscribe({
        next: addresses => {
          this.addressOptions = addresses ?? [];
          this.loadingAddresses = false;
        },

        error: error => {
          console.error(
            'Unable to load Ship To addresses.',
            error
          );

          this.addressOptions = [];
          this.addressError =
            'Unable to load available addresses.';
          this.loadingAddresses = false;
        }
      });
  }


  closeAddressEditor(): void {
    this.addressEditorVisible = false;
    this.addressEditorOrder = null;
    this.addressOptions = [];
    this.selectedShipToAddressId = null;
    this.addressError = '';
  }

  selectShipToAddress(addressId: number): void {
    this.selectedShipToAddressId = addressId;
  }


  saveAddressChange(): void {
    const order = this.addressEditorOrder;

    if (!order) {
      return;
    }

    this.addressError = '';

    if (this.isConsumer(order)) {
      this.saveConsumerAddress(order);
      return;
    }

    const request: UpdateOrderShipToRequest =
      this.addressEditorMode === 'saved'
        ? {
          orderId: order.orderId,
          mode: 'SAVED',
          addressId:
            this.selectedShipToAddressId ?? undefined
        }
        : {
          orderId: order.orderId,
          mode: 'DROPSHIP',
          ...this.dsAddress
        };

    if (
      request.mode === 'SAVED' &&
      !request.addressId
    ) {
      this.addressError =
        'Select a shipping address.';

      return;
    }

    if (
      request.mode === 'DROPSHIP' &&
      (
        !request.address1?.trim() ||
        !request.city?.trim() ||
        !request.state?.trim() ||
        !request.postalCode?.trim()
      )
    ) {
      this.addressError =
        'Address, city, state and postal code are required.';

      return;
    }

    this.savingAddress = true;

    this.ordersService
      .updateShipTo(request)
      .subscribe({
        next: () => {
          if (request.mode === 'SAVED') {
            const selected =
              this.addressOptions.find(
                address =>
                  address.addressId === request.addressId
              );

            if (selected) {
              order.shippingAddress = {
                addressId: selected.addressId,
                companyName: selected.companyName,
                firstName: selected.firstName,
                lastName: selected.lastName,
                address1: selected.address1,
                address2: selected.address2,
                city: selected.city,
                state: selected.state,
                postalCode: selected.postalCode,
                country: selected.country
              };
            }
          } else {
            order.orderType = 'Drop Ship';

            order.shippingAddress = {
              companyName: this.dsAddress.companyName,
              firstName: this.dsAddress.firstName,
              lastName: this.dsAddress.lastName,
              address1: this.dsAddress.address1,
              address2:
                `${this.dsAddress.address2} | ` +
                `${this.dsAddress.phone} | ` +
                `${this.dsAddress.email}`,
              city: this.dsAddress.city,
              state: this.dsAddress.state,
              postalCode: this.dsAddress.postalCode,
              country: this.dsAddress.country
            };
          }

          // Refresh every upper-grid row for this order.
          this.orders
            .filter(item =>
              item.orderId === order.orderId
            )
            .forEach(item => {
              item.shippingAddress =
                order.shippingAddress
                  ? { ...order.shippingAddress }
                  : undefined;

              if (request.mode === 'DROPSHIP') {
                item.orderType = 'Drop Ship';
              }
            });

          this.savingAddress = false;
          this.closeAddressEditor();

          // Reload the selected order detail from the API.
          this.openOrder(order);
        },

        error: error => {
          console.error(
            'Unable to update shipping address.',
            error
          );

          this.addressError =
            error?.error?.message ??
            error?.error ??
            'Unable to update shipping address.';

          this.savingAddress = false;
        }
      });
  }



  private saveConsumerAddress(order: OrderRecord): void {
    const address = this.dsAddress;

    if (!address.firstName.trim() && !address.lastName.trim()) {
      this.addressError = 'A recipient name is required.';
      return;
    }

    if (
      !address.address1.trim() ||
      !address.city.trim() ||
      !address.state.trim() ||
      !address.postalCode.trim()
    ) {
      this.addressError =
        'Address, city, state and postal code are required.';
      return;
    }

    const request: UpdateOrderShipToRequest = {
      orderId: order.orderId,
      mode: 'DROPSHIP',
      firstName: address.firstName,
      lastName: address.lastName,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
      email: address.email
    };

    this.savingAddress = true;

    this.ordersService
      .updateConsumerShipTo(request)
      .subscribe({
        next: result => {
          this.savingAddress = false;

          if (!result.success) {
            this.addressError = result.message;
            return;
          }

          this.closeAddressEditor();

          /* Reload from the server so the screen shows what was saved. */
          this.openOrder(order);
          this.loadConsumerOrders();
        },

        error: error => {
          console.error(
            'Unable to update consumer shipping address.',
            error
          );

          this.addressError =
            error?.error?.message ??
            error?.error ??
            'Unable to update shipping address.';

          this.savingAddress = false;
        }
      });
  }



  /* Orders still waiting on someone. Rejected ones are not counted. */
  get reviewCount(): number {
    return this.reviewOrders.filter(
      order => order.state !== 'REJECTED'
    ).length;
  }

  openReviewTab(): void {
    this.sentTabActive = false;
    this.reviewTabActive = true;
    this.selectedOrder = null;
    this.selectedOrderIds.clear();
    this.loadReviewOrders();
  }

  loadReviewOrders(): void {
    this.reviewLoading = true;
    this.reviewError = '';

    this.ordersService
      .getReviewOrders(this.reviewShowRejected)
      .subscribe({
        next: orders => {
          this.reviewOrders = orders ?? [];
          this.reviewLoading = false;

          const selectedId = this.reviewSelected?.inboxId;

          if (
            selectedId !== undefined &&
            !this.reviewOrders.some(o => o.inboxId === selectedId)
          ) {
            this.reviewSelected = null;
          }
        },

        error: error => {
          console.error('Unable to load orders needing review.', error);
          this.reviewOrders = [];
          this.reviewError = 'Unable to load orders needing review.';
          this.reviewLoading = false;
        }
      });
  }

  importPosOrders(): void {
    this.posImporting = true;

    this.runOrderImport(
      'POS import',
      this.ordersService.importPosOrders(),
      () => (this.posImporting = false)
    );
  }

  importEdiOrders(): void {
    this.ediImporting = true;

    this.runOrderImport(
      'EDI import',
      this.ordersService.importEdiOrders(),
      () => (this.ediImporting = false)
    );
  }

  private runOrderImport(
    title: string,
    request: Observable<PosImportSummary>,
    done: () => void
  ): void {
    request.subscribe({
      next: result => {
        done();

        this.toast.add({
          severity: !result.success
            ? 'error'
            : result.needsReview > 0 || result.rejected > 0
              ? 'warn'
              : 'success',
          summary: title,
          detail: result.message,
          life: 8000
        });

        this.loadReviewOrders();
        this.loadOrders();
      },

      error: error => {
        console.error(`${title} failed.`, error);
        done();

        this.toast.add({
          severity: 'error',
          summary: title,
          detail: 'Unable to run the import.'
        });
      }
    });
  }

  openReviewOrder(order: OrderInboxReviewItem): void {
    this.reviewRawVisible = false;
    this.reviewEditing = false;

    this.ordersService.getReviewOrder(order.inboxId).subscribe({
      next: detail => {
        this.reviewSelected = {
          ...detail,
          problems: detail.problems ?? [],
          lines: detail.lines ?? []
        };
      },

      error: error => {
        console.error('Unable to load the held order.', error);

        this.toast.add({
          severity: 'error',
          summary: 'Unable to open order',
          detail: 'The held order could not be loaded.'
        });
      }
    });
  }

  /* The document as received, indented when it is JSON. */
  get reviewRawText(): string {
    const raw = this.reviewSelected?.rawDocument ?? '';

    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  getReviewStateLabel(order: OrderInboxReviewItem): string {
    switch (order.state) {
      case 'NEEDS_REVIEW': return 'Needs Review';
      case 'RECEIVED': return 'Not Processed';
      case 'REJECTED': return 'Rejected';
      default: return order.state;
    }
  }

  canRejectReview(order: OrderInboxReviewItem): boolean {
    return order.state === 'NEEDS_REVIEW' || order.state === 'RECEIVED';
  }

  openReviewReject(order: OrderInboxReviewItem, event?: Event): void {
    event?.stopPropagation();

    this.reviewRejectTarget = order;
    this.reviewRejectReason = '';
    this.reviewRejectReasonError = false;
  }

  closeReviewReject(): void {
    this.reviewRejectTarget = null;
    this.reviewRejectReason = '';
    this.reviewRejectReasonError = false;
  }

  confirmReviewReject(): void {
    const target = this.reviewRejectTarget;
    const reason = this.reviewRejectReason.trim();

    if (!target || !reason) {
      this.reviewRejectReasonError = true;
      return;
    }

    this.reviewRejecting = true;

    this.ordersService
      .rejectReviewOrder(target.inboxId, reason)
      .subscribe({
        next: result => {
          this.reviewRejecting = false;

          this.toast.add({
            severity: result.success ? 'success' : 'warn',
            summary: result.success ? 'Order rejected' : 'Not rejected',
            detail: result.message
          });

          this.closeReviewReject();

          if (this.reviewSelected?.inboxId === target.inboxId) {
            this.reviewSelected = null;
          }

          this.loadReviewOrders();
        },

        error: error => {
          this.reviewRejecting = false;
          console.error('Unable to reject the held order.', error);

          this.toast.add({
            severity: 'error',
            summary: 'Reject failed',
            detail: 'The server could not reject this order.'
          });
        }
      });
  }




  getStatusClass(status: OrderStatus): string {
    switch (status) {
      case 'Ready':
        return 'status-ready';

      case 'On Hold':
        return 'status-hold';

      case 'Exception':
        return 'status-exception';

      case 'In Progress':
        return 'status-progress';

      case 'Rejected':
        return 'status-rejected';

      default:
        return '';
    }


  }
}
