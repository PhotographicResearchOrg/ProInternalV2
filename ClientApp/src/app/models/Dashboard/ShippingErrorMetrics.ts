export class ShippingErrorMetrics {
  public openShippingErrors: number;
  public threshold: number;
  public oldestInQueue: Date;
  

  constructor() {
    this.openShippingErrors = 0; // Initializing in the constructor
    this.threshold = 0;
    this.oldestInQueue =  new Date();
  }

}
