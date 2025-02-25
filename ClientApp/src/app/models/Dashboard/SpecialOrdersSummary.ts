export class SpecialOrdersSummary {
  public ProductCode: number;
  public CAT_NO: string;
  public ModelName: string;
  public image: string;
  public price: number;
  public EnterDate: Date;
  public Quantity: number;
  public Inventory: number;
  public CatName: string;
  public Status: string;
  public AccountNumber: string;


  constructor() {
    this.ProductCode = 0;
    this.CAT_NO = "";
    this.ModelName = "";
    this.image = "";
    this.price = 0;
    this.EnterDate = new Date();
    this.Quantity = 0;
    this.Inventory = 0;
    this.CatName = "";
    this.Status = "";
    this.AccountNumber = "";
  }

}
