export class OrdersMetrics {
  public openOrders: number;
  public onHoldOrders: number;
  public specialsOrders: number;
  public dropShipOrders: string;
  public lastRunTime: Date;
  public oldestOnHold: Date;
  public threshold: number;

  constructor() {
    this.openOrders = 0; // Initializing in the constructor
    this.onHoldOrders = 0;
    this.specialsOrders = 0;
    this.dropShipOrders = "";
    this.lastRunTime = new Date();
    this.oldestOnHold = new Date();
    this.threshold = 0;
  }

}
