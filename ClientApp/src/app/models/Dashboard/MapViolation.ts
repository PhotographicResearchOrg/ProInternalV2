
export interface MapViolation {
  accountName?:  string;
  accountNumber: string;
  productCode: string;
  penaltyDays: number;
  submittedOn?: Date; // Optional field for previous violations
  endDate?: Date;
}



