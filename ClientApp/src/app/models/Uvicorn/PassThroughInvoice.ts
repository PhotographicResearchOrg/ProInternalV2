

export class PoSyncResult {
  message?: string;
  synced?: number | null;
  count?: number | null;
  processed?: number | null;
  errors?: number | null;
  errorCount?: number | null;

	constructor(o?: any) {
		Object.assign(this, o);
	}
}




export class BatchRunResponse {
  message?: string;
  processed?: number;
  totalProcessed?: number;
  count?: number;
  errors?: number;
  errorCount?: number;
  [k: string]: any;

  constructor(o?: any) {
    Object.assign(this, o);
  }
}
