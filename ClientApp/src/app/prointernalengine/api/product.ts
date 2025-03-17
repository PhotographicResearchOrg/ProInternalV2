interface InventoryStatus {
    label: string;
    value: string;
}

export interface Product {
    id?: string;
    code?: string;
    name?: string;
    description?: string;
    price?: number;
    quantity?: number;
    inventoryStatus?: InventoryStatus;
    category?: string;
    image?: string;
    rating?: number;



 
}
	

export class ProProduct {
	id?: string;
    accountNumber?: number;
    specOrder?: string;
    isDropShipEligible?: number;
    productCode: string;
    brandId?: number;
    modelName?: string;
    modelVersion?: string;
    additionalText?: string;
    catId?: number;
    subCatId?: number;
    upc?: string;
    retail?: number;
    dsChg?: number;
    lastValue?: number;
    cartonPricingRetail?: number;
    authorizedPrice?: number;
    isActive?: number;
    isPublic?: number;
    isForSale?: number;
    isDiscontinued?: boolean;
    replacementCode?: string;
    features?: string;
    specs?: string;
    instructionBook?: string;
    faqDoc?: string;
    p65?: string;
    enterDate?: Date;
    lastUpdated?: Date;
    updatedBy?: number;
    hold?: string;
    inventory?: number;
    multiple?: number;
    outOfStockMessage?: string;
    stockDueDate?: Date;
    specialPriceQuantity?: number;
    carton?: number;
    topCatId?: number;
    map?: number;
    custRetail?: number;
    rebate?: string;
    requireSerialForSar?: boolean;
    brandRebate?: number;
    faq?: string;
    catNo?: string;
    fastShippingAvailable?: number;
    shippingHold?: number;
    supplementalShippingSku?: string;
    supplementalShippingProductId?: number;
    supplementalShippingCost?: number;
    isGroup?: number;
    isClient?: number;
    label?: string;
}

