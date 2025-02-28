export class DeclinedIR {

  public orderID: number;
  public processDate: Date;
  public total: number;
  public rejectReason: string;
  public memberID: number;
  public quantity: number;
  public model: string;
  public email: string;

  constructor()
  {
    this.orderID = 0;
    this.processDate = new Date();;
    this.total = 0; // Initializing in the constructor
    this.rejectReason = "";
    this.memberID = 0;
    this.quantity = 0;
    this.model = "";
    this.email = ""; 
  }

}



