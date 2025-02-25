export class MapViolation {

  public AccountNumber: string;
  public StartDate: Date;
  public EndDate: Date;
  public Date: Date;
  public ProductCode: string;

  constructor()
  {
    this.StartDate = new Date();
    this.EndDate = new Date();
    this.Date = new Date();
    this.ProductCode = "";
    this.AccountNumber = "";
  }

}
