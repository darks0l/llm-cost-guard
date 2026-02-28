import { BUILT_IN_PRICING, calculateCostUsd } from "./pricing";
import { MemoryStorageAdapter } from "./storage";
import {
  BudgetAlert,
  BudgetKillEvent,
  BudgetRule,
  GuardConfig,
  LlmCostGuard,
  PricingCatalog,
  TrackRequest,
  TrackResult,
  UsageEvent,
  UsageFilter,
  UsageSummary,
  WrapOptions
} from "./types";

const ALERT_THRESHOLDS: Array<80 | 90 | 100> = [80, 90, 100];

export class UnknownModelPricingError extends Error {
  constructor(model: string) {
    super(`No pricing entry found for model: ${model}`);
    this.name = "UnknownModelPricingError";
  }
}

export class BudgetExceededError extends Error {
  readonly event: BudgetKillEvent;

  constructor(event: BudgetKillEvent) {
    super(`Budget exceeded for ${event.scopeKey}. Limit: $${event.limitUsd.toFixed(6)}, usage: $${event.usageUsd.toFixed(6)}`);
    this.name = "BudgetExceededError";
    this.event = event;
  }
}

type Callback<T> = (event: T) => void;

function usageSummaryFromEvents(events: UsageEvent[]): UsageSummary {
  const summary: UsageSummary = {
    totalSpendUsd: 0,
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    byModel: {},
    byUser: {},
    byFeature: {}
  };

  for (const event of events) {
    summary.totalSpendUsd += event.costUsd;
    summary.totalCalls += 1;
    summary.totalInputTokens += event.inputTokens;
    summary.totalOutputTokens += event.outputTokens;

    summary.byModel[event.model] = (summary.byModel[event.model] ?? 0) + event.costUsd;

    if (event.userId) {
      summary.byUser[event.userId] = (summary.byUser[event.userId] ?? 0) + event.costUsd;
    }

    if (event.feature) {
      summary.byFeature[event.feature] = (summary.byFeature[event.feature] ?? 0) + event.costUsd;
    }
  }

  return summary;
}

function baseRuleMatch(rule: BudgetRule, event: UsageEvent): boolean {
  if (rule.model && rule.model !== event.model) {
    return false;
  }

  if (rule.userId && rule.userId !== event.userId) {
    return false;
  }

  if (rule.feature && rule.feature !== event.feature) {
    return false;
  }

  return true;
}

function getScopeIdentity(rule: BudgetRule, event: UsageEvent): { key: string; userId?: string; feature?: string } | null {
  const scopeBy = rule.scopeBy ?? "global";
  const scopeParts: string[] = [rule.id ?? "rule"];

  if (scopeBy === "user" || scopeBy === "user_feature") {
    if (!event.userId) {
      return null;
    }

    scopeParts.push(`user:${event.userId}`);
  }

  if (scopeBy === "feature" || scopeBy === "user_feature") {
    if (!event.feature) {
      return null;
    }

    scopeParts.push(`feature:${event.feature}`);
  }

  if (scopeBy === "global") {
    scopeParts.push("global");
  }

  return {
    key: scopeParts.join("|"),
    userId: scopeBy === "user" || scopeBy === "user_feature" ? event.userId : rule.userId,
    feature: scopeBy === "feature" || scopeBy === "user_feature" ? event.feature : rule.feature
  };
}

function getUsageDataFromResponse(payload: unknown, fallbackModel: string | undefined): { model: string; inputTokens: number; outputTokens: number } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const obj = payload as Record<string, unknown>;
  const usage = (obj.usage ?? obj.usageMetadata) as Record<string, unknown> | undefined;

  const model = (typeof obj.model === "string" ? obj.model : fallbackModel) ?? "";
  if (!model) {
    return null;
  }

  if (usage) {
    const input =
      toNumber(usage.prompt_tokens) ??
      toNumber(usage.input_tokens) ??
      toNumber(usage.promptTokenCount) ??
      toNumber(usage.inputTokenCount) ??
      0;

    const output =
      toNumber(usage.completion_tokens) ??
      toNumber(usage.output_tokens) ??
      toNumber(usage.candidatesTokenCount) ??
      toNumber(usage.outputTokenCount) ??
      0;

    if (input > 0 || output > 0) {
      return { model, inputTokens: input, outputTokens: output };
    }

    const total = toNumber(usage.totalTokenCount) ?? toNumber(usage.total_tokens);
    if (typeof total === "number" && total > 0) {
      return { model, inputTokens: total, outputTokens: 0 };
    }
  }

  return null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function asModelFromArgs(args: unknown[]): string | undefined {
  if (args.length === 0 || typeof args[0] !== "object" || args[0] === null) {
    return undefined;
  }

  const request = args[0] as Record<string, unknown>;
  if (typeof request.model === "string") {
    return request.model;
  }

  if (typeof request.modelId === "string") {
    return request.modelId;
  }

  return undefined;
}

export function createGuard(config: GuardConfig): LlmCostGuard {
  const storage = config.storage ?? new MemoryStorageAdapter();
  const pricing: PricingCatalog = { ...BUILT_IN_PRICING, ...(config.pricing ?? {}) };
  const now = config.now ?? (() => Date.now());
  const throwOnKill = config.throwOnKill ?? true;
  const onUnknownModel = config.onUnknownModel ?? "error";

  const budgetAlertCallbacks = new Set<Callback<BudgetAlert>>();
  const killCallbacks = new Set<Callback<BudgetKillEvent>>();
  const alertState = new Map<string, number>();

  async function evaluateBudgets(event: UsageEvent): Promise<{ alerts: BudgetAlert[]; killEvent?: BudgetKillEvent }> {
    const alerts: BudgetAlert[] = [];
    let killEvent: BudgetKillEvent | undefined;

    for (let i = 0; i < config.budgets.length; i += 1) {
      const rule = config.budgets[i];
      if (!baseRuleMatch(rule, event)) {
        continue;
      }

      const scope = getScopeIdentity({ ...rule, id: rule.id ?? `rule-${i}` }, event);
      if (!scope) {
        continue;
      }

      const windowStart = now() - rule.windowMs;
      const events = await storage.list({
        model: rule.model,
        userId: scope.userId,
        feature: scope.feature,
        since: windowStart,
        until: now()
      });

      const usageUsd = events.reduce((total, entry) => total + entry.costUsd, 0);
      const percent = (usageUsd / rule.limitUsd) * 100;
      const stateKey = `${i}:${scope.key}`;
      const previous = alertState.get(stateKey) ?? 0;

      let highestTriggered = 0;
      for (const threshold of ALERT_THRESHOLDS) {
        if (percent >= threshold) {
          highestTriggered = threshold;
        }
      }

      if (highestTriggered > previous) {
        for (const threshold of ALERT_THRESHOLDS) {
          if (threshold > previous && threshold <= highestTriggered) {
            const alert: BudgetAlert = {
              rule,
              thresholdPercent: threshold,
              usageUsd,
              limitUsd: rule.limitUsd,
              scopeKey: scope.key
            };
            alerts.push(alert);
            budgetAlertCallbacks.forEach((callback) => callback(alert));
          }
        }
      }

      if (highestTriggered < 80) {
        alertState.set(stateKey, 0);
      } else {
        alertState.set(stateKey, highestTriggered);
      }

      if (!killEvent && usageUsd > rule.limitUsd && (rule.killSwitch ?? true)) {
        killEvent = {
          rule,
          usageUsd,
          limitUsd: rule.limitUsd,
          scopeKey: scope.key
        };
      }
    }

    if (killEvent) {
      killCallbacks.forEach((callback) => callback(killEvent as BudgetKillEvent));
    }

    return { alerts, killEvent };
  }

  async function track(input: TrackRequest): Promise<TrackResult> {
    const timestamp = input.timestamp ?? now();
    const costUsd = calculateCostUsd(input.model, input.inputTokens, input.outputTokens, pricing);

    if (typeof costUsd !== "number") {
      if (onUnknownModel === "error") {
        throw new UnknownModelPricingError(input.model);
      }
    }

    const event: UsageEvent = {
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      userId: input.userId,
      feature: input.feature,
      timestamp,
      createdAt: timestamp,
      costUsd: costUsd ?? 0
    };

    await storage.append(event);

    const { alerts, killEvent } = await evaluateBudgets(event);
    if (killEvent && throwOnKill) {
      throw new BudgetExceededError(killEvent);
    }

    return {
      event,
      alerts,
      killTriggered: Boolean(killEvent)
    };
  }

  async function getUsage(filter?: UsageFilter): Promise<UsageSummary> {
    const resolvedFilter = { ...filter };
    if (typeof resolvedFilter.windowMs === "number") {
      resolvedFilter.since = now() - resolvedFilter.windowMs;
    }

    const events = await storage.list(resolvedFilter);
    return usageSummaryFromEvents(events);
  }

  function onBudgetAlert(callback: Callback<BudgetAlert>): () => void {
    budgetAlertCallbacks.add(callback);
    return () => budgetAlertCallbacks.delete(callback);
  }

  function onKill(callback: Callback<BudgetKillEvent>): () => void {
    killCallbacks.add(callback);
    return () => killCallbacks.delete(callback);
  }

  function wrap<TClient extends object>(client: TClient, options?: WrapOptions): TClient {
    const proxyCache = new WeakMap<object, object>();

    const makeProxy = <T extends object>(target: T): T => {
      if (proxyCache.has(target)) {
        return proxyCache.get(target) as T;
      }

      const proxy = new Proxy(target, {
        get(currentTarget, prop, receiver) {
          const value = Reflect.get(currentTarget, prop, receiver);

          if (typeof value === "function") {
            return async (...args: unknown[]) => {
              const result = await Reflect.apply(value, currentTarget, args);
              const modelFromArgs = asModelFromArgs(args);
              const usage = getUsageDataFromResponse(result, modelFromArgs);

              if (usage) {
                const extracted = options?.metadataExtractor?.(args) ?? {};
                await track({
                  model: usage.model,
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                  userId: extracted.userId ?? options?.userId,
                  feature: extracted.feature ?? options?.feature
                });
              }

              return result;
            };
          }

          if (typeof value === "object" && value !== null) {
            return makeProxy(value as object);
          }

          return value;
        }
      });

      proxyCache.set(target, proxy);
      return proxy;
    };

    return makeProxy(client);
  }

  return {
    wrap,
    track,
    getUsage,
    onBudgetAlert,
    onKill
  };
}