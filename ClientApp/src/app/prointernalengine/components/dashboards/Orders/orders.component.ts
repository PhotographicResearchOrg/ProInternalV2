import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProcessOrdersRequest, OrderAuditRecord, UpdateOrderShipToRequest, OrderChannel, OrderStatus, OrderRecord, OrderShipToOption  } from 'src/app/models/orders/OrderModels';
import { OrdersService } from 'src/app/services/orders.service';
import { OrdersMetrics } from 'src/app/models/Dashboard/OrdersMetrics';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';

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

    return this.orders.filter(order => {
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
        matchesStatus &&
        (!search || searchableText.includes(search)) &&
        this.matchesMetricFilter(order)
      );
    });
  }


  toggleFreeShipping(order: OrderRecord): void {
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

    this.ordersService.getOrderAudit(order.orderId).subscribe({
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
    if (!order.autoHold || order.holdOverride) {
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
    this.activeChannel = channel;
    this.searchTerm = '';
    this.selectedStatus = 'All';
    this.metricFilter = 'all';
    this.selectedOrderIds.clear();
    this.selectedOrder = null;

    if (channel === 'warehouse') {
      this.loadOrders();
    }
  }

  openOrder(order: OrderRecord): void {
    this.ordersService
      .getOrder(order.orderId, order.orderSectionId)
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
      Array.from(this.selectedOrderIds)
    );
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'All';
    this.metricFilter = 'all';
  }

  openEdiManagement(): void {
    this.router.navigate(['/orders/edi']);
  }


  processOrder(order: OrderRecord): void {
    if (!this.canProcess(order) ||
      this.processingOrders) {
      return;
    }

    this.exportOrders([order.orderId]);
  }


  private exportOrders(
    orderIds: string[]
  ): void {
    this.processingOrders = true;
    this.ordersError = '';

    const request: ProcessOrdersRequest = {orderIds};

    this.ordersService
      .processOrders(request)
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
    return this.orders.filter(
      order => order.channel === 'consumer'
    ).length;
  }


  openAddressEditor(order: OrderRecord): void {
    this.addressEditorOrder = order;
    this.addressEditorVisible = true;

    this.addressError = '';

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
