export class VendorStock {
  public company: string;
  public vendorId: number;
  public accountId: number;
  public catalogNumber: string;
  public quantity: number;
  public productCode: string;
  public modelName: string;
  public image: string;
  public loadedOn: string;
  public status: string;


  constructor() {
    this.company = "";
    this.vendorId = 0;;
    this.accountId = 0; // Initializing in the constructor
    this.catalogNumber = "";
    this.quantity = 0;
    this.productCode = "";
    this.modelName = "";
    this.image = "";
    this.loadedOn = "";
    this.status = "";
  }
}
