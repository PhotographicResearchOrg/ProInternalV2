export class IRMetrics {
  public irsInQueue: number;
  public threshold: number;
  public oldestInQueue: Date;

  constructor() {
    this.irsInQueue = 0; // Initializing in the constructor
    this.threshold = 0;
    this.oldestInQueue =  new Date();
  }

}
