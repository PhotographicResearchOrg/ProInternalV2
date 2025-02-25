export class SARMetrics {
  public totalInQueue: number;
  public proHoldInQueue: number;
  public memCreditsInQueue: number;
  public oldestInQueue: Date;
  

  constructor() {
    this.totalInQueue = 0; // Initializing in the constructor
    this.proHoldInQueue = 0;
    this.memCreditsInQueue = 0;
    this.oldestInQueue =  new Date();
  }

}
