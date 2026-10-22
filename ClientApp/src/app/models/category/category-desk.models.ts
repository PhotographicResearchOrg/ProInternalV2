/* Category Desk models. API: CategoryDeskController (api/categorydesk). */

export interface CategoryNode {
  catId: number;
  parentCatId: number | null;
  name: string;
  visible: boolean;
  effectiveVisible: boolean;
  notes: string | null;
  egrp: number | null;
  depth: number;               // 0 = root (never shown), 1 = top level
  topId: number | null;
  egrpNodeId: number | null;   // the EGRP category this node is in (itself or above), null outside any
  pathNames: string;
  ownCount: number;
  ownActiveCount: number;
  totalCount: number;
  activeCount: number;
  discontinuedCount: number;
}

export interface CategorySummary {
  uncategorized: number;
  suspect: number;
  visibleEmpty: number;
  orphans: number;
  version: number;
}

export interface EgrpOption { egrp: number; name: string; }
export interface OrphanCategory { catId: number; name: string; parentCatId: number | null; }

export interface CategoryTree {
  nodes: CategoryNode[];
  summary: CategorySummary;
  egrpsNotOnTree: EgrpOption[];
  orphans: OrphanCategory[];
  sqlIsMaster: boolean;
  canEdit: boolean;
}

export type ProductQueue = 'UNCATEGORIZED' | 'SUSPECT';

export interface CategoryProductQuery {
  term?: string | null;
  brandId?: number | null;
  vendorId?: number | null;
  status?: 'ACTIVE' | 'DISCONTINUED' | null;
  forSale?: boolean | null;
  isPublic?: boolean | null;
  nodeId?: number | null;
  includeChildren?: boolean;
  queue?: ProductQueue | null;
  egrp?: number | null;
  newDays?: number | null;
  page?: number;
  pageSize?: number;           // 0 = every match
}

export interface CategoryProductRow {
  productId: number;
  productCode: string;
  modelName: string;
  brandId: number | null;
  brandName: string;
  vendorId: number | null;
  vendorName: string | null;
  egrp: number | null;
  isDiscontinued: boolean;
  isForSale: boolean;
  isPublic: boolean;
  replacementCode: string | null;
  enterDate: string | null;
  nodeId: number;
  nodePath: string | null;
  egrpNodeId: number | null;   // where the product's Computyme EGRP sits in the tree
  problem: string | null;
  suggestedNodeId: number | null;
  suggestedPath: string | null;
  suggestReason: string | null;
  suggestConfidence: number | null;
  suggestSignal: string | null;
  totalCount: number;
}

export interface CategoryProductPage { rows: CategoryProductRow[]; total: number; page: number; pageSize: number; }

export interface FilterOption { id: number; name: string; }
export interface CategoryFilters { brands: FilterOption[]; vendors: FilterOption[]; }

/* ------------------------------------------------------------ publish */

export type ChangeSource = 'USER' | 'RULE' | 'AI';

export interface CategoryChange {
  id: number;                  // a temporary negative id when new in this draft (existing ids can be negative too)
  parentId: number | null;
  name: string;
  visible: boolean;
  notes: string | null;
  egrp: number | null;
  delete?: boolean;
  /** added in this draft; tells the server the id is temporary */
  isNew?: boolean;
  source?: ChangeSource;
}

export interface ProductMove { productId: number; nodeId: number; source: ChangeSource; }

export interface PublishRequest {
  changes: { categories: CategoryChange[]; products: ProductMove[] };
  comment: string | null;
  baseVersion: number | null;
}

export interface PublishResult {
  publishId: number;
  categoryChanges: number;
  productChanges: number;
  productsRepathed: number;
  newIds: { tempId: number; catId: number }[];
}

export interface PublishSummary {
  publishId: number;
  publishedAt: string;
  publishedBy: string;
  comment: string | null;
  revertOfPublishId: number | null;
  revertedByPublishId: number | null;
  categoryChanges: number;
  productChanges: number;
  fromAi: number;
  fromSuggestion: number;
}

export interface PublishItem {
  changeId: number;
  publishId: number;
  publishedAt: string;
  publishedBy: string;
  comment: string | null;
  itemType: 'CATEGORY' | 'PRODUCT';
  itemId: number;
  itemLabel: string;
  action: 'ADD' | 'UPDATE' | 'DELETE' | 'MOVE';
  fields: string | null;
  source: string;
  beforeJson: string | null;
  afterJson: string | null;
  beforePath: string | null;
  afterPath: string | null;
}

export interface RevertConflict {
  itemType: string;
  itemId: number;
  itemLabel: string;
  laterPublishId: number;
  laterBy: string;
  laterAt: string;
}

export const PROBLEM_LABELS: Record<string, string> = {
  UNCATEGORIZED: 'No category',
  MISSING: 'Category no longer exists',
  HIDDEN: 'Category is hidden',
  EGRP_MISMATCH: 'Not inside its Computyme EGRP category',
  ON_PARENT: 'Sits on a category that has sub-categories',
  REPLACEMENT_UNCATEGORIZED: 'Discontinued; its replacement has no category'
};
