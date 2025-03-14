export class Account {

	public companyID: number
  public accountNumber: number = 0;
  public accountName: string = '';
  public label : string = '';



  constructor(o?: any) {
    Object.assign(this,o);
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

export class Brand {
	public brandID: number;
	public brandName: string;
	constructor(o?:any) {
		Object.assign(this, o);
	}
}
