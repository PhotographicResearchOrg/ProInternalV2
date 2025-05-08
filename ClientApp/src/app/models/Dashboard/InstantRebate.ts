export class InstantRebate {
  public irDesc: string;
  public modelNumber: string;
  public batchID: number;
  public units: number;
  public vendorName: string;
  public vendorID: number;
  public programStart: Date;
  public programEnd: Date;
  public irType: number;
  public irtypeName: string;
  public expired: boolean;
  constructor() {
   this.irDesc = "";
   this.modelNumber = "";
   this.batchID = 0; // Initializing in the constructor
   this.units = 0;
   this.vendorName = "";
   this.vendorID = 0;
   this.programStart = new Date();;
   this.programEnd = new Date();
   this.irType = 0;
   this.irtypeName = "";
   this.expired = false; 
  }
}


export interface ParentCompany {
  id: number;
  companyName: string;
  active: boolean;
  imageUrl: string | null;
}


export interface RebateVendor {
  id: number;
  vendorName: string;
  parentCompany: string;
  apmstid: string | null;
  active: boolean;
  isInstantRebate: boolean;
  imageUrl: string | null;
  parentCompanyId: number;
  isPriceProtection: boolean; 
}
