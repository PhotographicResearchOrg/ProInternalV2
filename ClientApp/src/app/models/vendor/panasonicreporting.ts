export interface panaRep {
  id?: number;
  repName: string;
  email: string;
}

export interface panaAccount {
  meca: string;
  accountNumber: number | null;
  accountName: string;
  repid: number | null;
  id?: number;
}
