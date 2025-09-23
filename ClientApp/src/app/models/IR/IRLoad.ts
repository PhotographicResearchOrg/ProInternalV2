export class RebateIRRowDto {
  vendorBrand?: string | null;           // Vendor / Brand
  productDescription?: string | null;    // Product Description
  proCodePrimary?: string | null;        // PRO Code_(Primary)
  instantRebate?: number | null;         // Instant Rebate
  memberReimbursement?: number | null;   // Member_Reimbursement
  map?: number | null;                   // MAP
  startDate?: string | null;             // ISO string from API
  endDate?: string | null;               // ISO string from API
  stackProduct?: string | null;          // Stack Product
  stackProductCode?: string | null;   // raw from sheet col 9 (e.g., "72437 + 72458")
  rebateType?: number | null;            // Rebate Type
  notes?: string | null;                 // Notes
  stack?: string | null;                 // Stack (CSV)
  dispositionModelID?: number | null;    // disposition
  proposedModelName?: string | null;
  // legacy/compat (if you still use them elsewhere)
  productCode?: string | null;
  modelName?: string | null;
  irDescription?: string | null;
  previewId?: number | null;
}


export interface CommitRequest {
  previewIds: number[];
  dryRun: boolean;
  overwriteDuplicates: boolean;
}

export interface CommitResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: CommitRowResult[];
}
export interface CommitRowResult {
  previewId: number;
  status: CommitStatus;
  message?: string;

}

export type CommitStatus = 'Inserted' | 'Updated' | 'Skipped' | 'Error' | string;
