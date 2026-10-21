/* Product AI models. API: AiController (api/ai). */

export type AiFeatureKey = 'MARKET_RESEARCH' | 'TRANSLATE' | 'CATEGORY_SUGGEST' | 'PRODUCT_LOOKUP' | 'COMPETITOR_PRICING' | 'FORECAST';

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
