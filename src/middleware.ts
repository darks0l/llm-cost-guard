import { LlmCostGuard, UsageSummary } from "./types";

export interface MiddlewareOptions {
  userIdResolver?: (req: unknown) => string | undefined;
  featureResolver?: (req: unknown) => string | undefined;
  overBudgetStatusCode?: number;
  overBudgetMessage?: string;
  precheck?: {
    enabled: boolean;
    maxSpendUsd: number;
    windowMs: number;
  };
}

function defaultUserResolver(req: unknown): string | undefined {
  if (!req || typeof req !== "object") {
    return undefined;
  }

  const headers = (req as { headers?: Record<string, unknown> }).headers;
  const value = headers?.["x-user-id"];
  return typeof value === "string" ? value : undefined;
}

function defaultFeatureResolver(req: unknown): string | undefined {
  if (!req || typeof req !== "object") {
    return undefined;
  }

  const headers = (req as { headers?: Record<string, unknown> }).headers;
  const value = headers?.["x-feature"];
  return typeof value === "string" ? value : undefined;
}

async function isOverBudget(guard: LlmCostGuard, req: unknown, options?: MiddlewareOptions): Promise<boolean> {
  if (!options?.precheck?.enabled) {
    return false;
  }

  const resolveUserId = options.userIdResolver ?? defaultUserResolver;
  const resolveFeature = options.featureResolver ?? defaultFeatureResolver;

  const usage: UsageSummary = await guard.getUsage({
    userId: resolveUserId(req),
    feature: resolveFeature(req),
    windowMs: options.precheck.windowMs
  });

  return usage.totalSpendUsd >= options.precheck.maxSpendUsd;
}

export function createExpressMiddleware(guard: LlmCostGuard, options?: MiddlewareOptions) {
  return async (req: any, res: any, next: (error?: unknown) => void) => {
    try {
      const overBudget = await isOverBudget(guard, req, options);
      if (overBudget) {
        const statusCode = options?.overBudgetStatusCode ?? 429;
        res.status(statusCode).json({
          error: options?.overBudgetMessage ?? "Budget exceeded"
        });
        return;
      }

      req.llmCostGuard = {
        track: guard.track,
        getUsage: guard.getUsage
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createFastifyPreHandler(guard: LlmCostGuard, options?: MiddlewareOptions) {
  return async (request: any, reply: any) => {
    const overBudget = await isOverBudget(guard, request, options);
    if (overBudget) {
      const statusCode = options?.overBudgetStatusCode ?? 429;
      reply.code(statusCode).send({
        error: options?.overBudgetMessage ?? "Budget exceeded"
      });
      return;
    }

    request.llmCostGuard = {
      track: guard.track,
      getUsage: guard.getUsage
    };
  };
}