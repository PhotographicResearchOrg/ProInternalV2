

export class ProductExclusionGroup {
	public productExclusionGroupID: number;
	public groupName: string;

	constructor(o?: any) {
		Object.assign(this, o);
	}
}

export class ProductExclusionGroupProduct {
	public productExclusionGroupProductID: number;
	public productExclusionGroupID: number;
	public productCode: string;
	public modelName: string;

	constructor(o?: any) {
		Object.assign(this, o);
	}
}

export class CompanyGroupExclusion {
	public companyGroupExclusionID: number;
	public companyID: number;
	public productExclusionGroupID: number;

	constructor(o?: any) {
		Object.assign(this, o);
	}
}