/* Product AI models. API: AiController (api/ai). */

export type AiFeatureKey = 'MARKET_RESEARCH' | 'TRANSLATE' | 'FORECAST' | 'PRODUCT_LOOKUP' | 'COMPETITOR_PRICING';

export interface AiGate {
  feature: AiFeatureKey;
  label: string;
  allowed: boolean;
  reason: string | null;
  provider: string;
  model: string;
  estimatedCostUsd: number;
  monthCostUsd: number;
  budgetUsd: number;
  userTodayCalls: number;
  dailyLimit: number;
}

export interface AiStatus {
  enabled: boolean;
  budgetUsd: number;
  monthCostUsd: number;
  canSeeUsage: boolean;
  features: AiGate[];
}

export interface ResearchSnapshot {
  usageId: number;
  fileId: number | null;
  calledAt: string;
  userName: string;
  provider: string | null;
  model: string | null;
  costUsd: number;
  costIsEstimate: boolean;
  question: string | null;
  detail: string | null;
  markdown: string | null;
}

export interface AiUsageRow {
  usageId: number;
  calledAt: string;
  userName: string;
  feature: string;
  provider: string;
  model: string;
  productId: number | null;
  productCode: string | null;
  modelName: string | null;
  items: number;
  costUsd: number;
  costIsEstimate: boolean;
  status: string;
  question: string | null;
  detail: string | null;
}

export const RESEARCH_TOPICS: { key: string; label: string; icon: string }[] = [
  { key: 'COMPETITORS', label: 'Competitors', icon: 'pi pi-users' },
  { key: 'REVIEWS', label: 'Reviews', icon: 'pi pi-star' },
  { key: 'PRICING', label: 'Street price', icon: 'pi pi-dollar' },
  { key: 'MARKET', label: 'Market and what\'s new', icon: 'pi pi-chart-line' }
];

/* ------------------------------------------------------------ forecast */

export interface SalesHistoryRow { country: string; monthStart: string; units: number; amount: number; }

export interface ForecastPoint {
  usageId: number;
  country: string;        // ISO country, or ALL
  monthStart: string;
  likely: number;
  low: number;
  high: number;
  method: string;
  actual: number | null;  // once the month has ended
}

export interface ForecastRun {
  usageId: number;
  calledAt: string;
  userName: string;
  model: string;
  costUsd: number;
  costIsEstimate: boolean;
  question: string | null;
  summary: string | null;
  months: number;
  points: ForecastPoint[];
}

export interface ForecastView { history: SalesHistoryRow[]; runs: ForecastRun[]; }

export interface ForecastAccuracyRow {
  usageId: number;
  calledAt: string;
  userName: string;
  model: string;
  productCode: string;
  modelName: string;
  brandName: string;
  monthsScored: number;
  forecast: number;
  actual: number;
  errorPct: number | null;
  monthsInRange: number;
}

/* ------------------------------------------------------------ find details and competitor prices */

export interface ResearchSource { number: number; title: string | null; url: string; date: string | null; }

export interface AiResultBase {
  usageId: number;
  fileId: number | null;
  calledAt: string;
  userName: string;
  model: string;
  costUsd: number;
  costIsEstimate: boolean;
  sources: ResearchSource[];
  rawText: string | null;     // the answer as text when it didn't come back in the expected format
}

export interface LookupSpec { label: string; value: string; }
export interface LookupImage { url: string; source: number | null; description: string | null; }

export interface ProductLookupResult extends AiResultBase {
  name: string | null;
  shortDescription: string | null;
  description: string | null;
  features: string[];
  specs: LookupSpec[];
  upc: string | null;
  upcSource: number | null;
  ean: string | null;
  images: LookupImage[];
  notes: string[];
}

export interface CompetitorPrice {
  retailer: string;
  price: number | null;
  currency: string;
  url: string | null;
  inStock: boolean | null;
  seenOn: string | null;
  condition: string | null;
}

export interface CompetitorPriceResult extends AiResultBase {
  prices: CompetitorPrice[];
  lowest: number | null;
  typical: number | null;
  summary: string | null;
}
