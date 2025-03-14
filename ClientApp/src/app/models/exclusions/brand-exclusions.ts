

export class CompanyBrandExclusion {
	public companyId: number;
	public brandID: number;
	public brandName: string;

	constructor(o?: any) {
		Object.assign(this, o);
	}
}