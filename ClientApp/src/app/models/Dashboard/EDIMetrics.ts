export class EDIMetrics {
  public openEDIOrders: number;
  public ediAlertThreshold: number;
  public oldestInQueue: Date;

  constructor() {
    this.openEDIOrders = 0; // Initializing in the constructor
    this.ediAlertThreshold = 0;
    this.oldestInQueue = new Date();

  }

}
