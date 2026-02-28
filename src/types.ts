export type MaybePromise<T> = T | Promise<T>;

export interface ModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export type PricingCatalog = Record<string, ModelPricing>;

export interface BudgetRule {
  id?: string;
  limitUsd: number;
  windowMs: number;
  model?: string;
  userId?: string;
  feature?: string;
  scopeBy?: "global" | "user" | "feature" | "user_feature";
  killSwitch?: boolean;
}

export interface TrackRequest {
  model: string;
  inputTokens: number;
  outputTokens: number;
  userId?: string;
  feature?: string;
  timestamp?: number;
}

export interface UsageEvent extends Required<Omit<TrackRequest, "userId" | "feature">> {
  userId?: string;
  feature?: string;
  costUsd: number;
  createdAt: number;
}

export interface UsageFilter {
  model?: string;
  userId?: string;
  feature?: string;
  since?: number;
  until?: number;
  windowMs?: number;
}

export interface UsageSummary {
  totalSpendUsd: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Record<string, number>;
  byUser: Record<string, number>;
  byFeature: Record<string, number>;
}

export interface BudgetAlert {
  rule: BudgetRule;
  thresholdPercent: 80 | 90 | 100;
  usageUsd: number;
  limitUsd: number;
  scopeKey: string;
}

export interface BudgetKillEvent {
  rule: BudgetRule;
  usageUsd: number;
  limitUsd: number;
  scopeKey: string;
}

export interface TrackResult {
  event: UsageEvent;
  alerts: BudgetAlert[];
  killTriggered: boolean;
}

export interface GuardConfig {
  budgets: BudgetRule[];
  pricing?: PricingCatalog;
  storage?: StorageAdapter;
  now?: () => number;
  throwOnKill?: boolean;
  onUnknownModel?: "error" | "zero";
}

export interface WrapOptions<TArgs extends unknown[] = unknown[]> {
  userId?: string;
  feature?: string;
  metadataExtractor?: (args: TArgs) => { userId?: string; feature?: string };
}

export interface StorageQuery extends UsageFilter {}

export interface StorageAdapter {
  append(event: UsageEvent): MaybePromise<void>;
  list(filter?: StorageQuery): MaybePromise<UsageEvent[]>;
  reset?(): MaybePromise<void>;
}

export interface LlmCostGuard {
  wrap<TClient extends object>(client: TClient, options?: WrapOptions): TClient;
  track(input: TrackRequest): Promise<TrackResult>;
  getUsage(filter?: UsageFilter): Promise<UsageSummary>;
  onBudgetAlert(callback: (alert: BudgetAlert) => void): () => void;
  onKill(callback: (event: BudgetKillEvent) => void): () => void;
}