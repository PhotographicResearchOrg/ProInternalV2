export class Account {

  public accountNumber: number;
  public accountName: string;
  public label : string;



  constructor() {
    this.accountNumber = 0; // Initializing in the constructor
    this.accountName = "";
    this.label = "";
  }

}

export class Brands {

  public brandID: number;
  public brandName: string;

  constructor() {
    this.brandID = 0; // Initializing in the constructor
    this.brandName = "";
  }

}
