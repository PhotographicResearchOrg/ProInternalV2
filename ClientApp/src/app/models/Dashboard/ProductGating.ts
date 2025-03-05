export class ProductGating {

  public companyBrandExclusionID: number;
  public brandID: number;
  public accountNumber: number;
  public rosterID: number;
  public DBA: string;
  public brandName: string;
  public country: string;
  public countryCode: string;
  public retailerType: string;

  constructor()
  {
    this.companyBrandExclusionID = 0;
    this.brandID = 0;;
    this.accountNumber = 0; // Initializing in the constructor
    this.rosterID = 0;
    this.DBA = "";
    this.brandName = "";
    this.country = "";
    this.countryCode = "";
  }

}



