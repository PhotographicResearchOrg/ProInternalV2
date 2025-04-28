export interface PatronageUpload {
  id: number;
  accountID: number;
  totalValue: number;
  perc: number;
  shares: number;
  balance: number;
  profit: number;
  dividend: number;
  payment: number;
  credit: number;
  dateLoaded: Date;
  batchID: number;
  stockValue: number;
  taxWithholding: number;
  withdrawal: number;
  endingRetention: number;
}

export interface PatronageHistorical {
  id: number;
  issueDate: Date;
  totalAmount: number;
  active: boolean;
}

export interface patronageDetail {
  id: number;
  accountID: number;
  totalValue: number;
  perc: number;
  shares: number;
  balance: number;
  profit: number;
  dividend: number;
  payment: number;
  credit: number;
  dateLoaded: Date;
  batchID: number;
  stockValue: number;
  taxWithholding: number;
  withdrawal: number;
  endingRetention: number;
}
