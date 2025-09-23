export class DeclinedIR {

  public stringprogramweek: string;
  public orderID: number;
  public processDate: Date;
  public total: number;
  public rejectReason: string;
  public memberID: number;
  public quantity: number;
  public model: string;
  public email: string;
  public status: number;
  public vendorID: number;
  public vendorName?: string;
  public vendorImage?: string;

  public masterFileLoc: string;           // new field for single file or indicator string
  public additionalFiles: string;         // new field for comma-separated list

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

    this.masterFileLoc = "";
    this.additionalFiles = "";
  }

  // Optional utility to split files into a list
  public getAdditionalFileList(): string[] {
    return this.additionalFiles
      ? this.additionalFiles.split(',').map(f => f.trim()).filter(f => !!f)
      : [];
  }
}



