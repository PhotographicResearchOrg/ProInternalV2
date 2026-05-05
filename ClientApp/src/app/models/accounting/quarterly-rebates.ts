export class QuarterlyRebates {

  public programName: string;
  public totalAmount: number;
  public issueDate: Date;
  public batchID: number;
  public programID: number;

  constructor()
  {
    this.programName = ""; // Initializing in the constructor
    this.totalAmount = 0;
    this.issueDate = new Date();
    this.batchID = 0;
    this.programID = 0;


  }

}


export class PaymentType {
  constructor(
    public accountNumber: string = '',
    public dba: string = '',
    public paymentTypeName: string = ''
  ) { }
}

export class QuarterlyRebatesHistorical {

  public qrPeriod: string;
  public totalAmount: number;
  public issueDate: Date;
  public checkIssueDate: Date;

  

  public id: number;
  public active: boolean;
  constructor() {
    this.qrPeriod = ""; // Initializing in the constructor
    this.totalAmount = 0;
    this.id = 0;
    this.issueDate = new Date();
    this.checkIssueDate = new Date();
    this.active = false;
  }

}
export class qrDetail {
  public batchID: number;
  public accountNumber: string;
  public DBA: string;
  public totalAmount: number
  public issueDate: Date
  public QuarterlyRebateProgram: string;
  constructor() {
    this.batchID = 0;
    this.accountNumber = ""; // Initializing in the constructor
    this.DBA = "";
    this.totalAmount = 0;
    this.issueDate = new Date();
    this.QuarterlyRebateProgram = "";
  }
}
