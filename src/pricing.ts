import { ModelPricing, PricingCatalog } from "./types";

export const BUILT_IN_PRICING: PricingCatalog = {
  "gpt-4o": { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10 },
  "gpt-4o-mini": { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 },
  "gpt-4-turbo": { inputPerMillionUsd: 10, outputPerMillionUsd: 30 },
  "gpt-3.5-turbo": { inputPerMillionUsd: 0.5, outputPerMillionUsd: 1.5 },
  "gpt-4.1": { inputPerMillionUsd: 2, outputPerMillionUsd: 8 },
  "gpt-4.1-mini": { inputPerMillionUsd: 0.8, outputPerMillionUsd: 3.2 },
  "gpt-4.1-nano": { inputPerMillionUsd: 0.2, outputPerMillionUsd: 0.8 },
  "gpt-5": { inputPerMillionUsd: 1.25, outputPerMillionUsd: 10 },
  "gpt-5-mini": { inputPerMillionUsd: 0.25, outputPerMillionUsd: 2 },
  "o1": { inputPerMillionUsd: 15, outputPerMillionUsd: 60 },
  "o1-mini": { inputPerMillionUsd: 1.1, outputPerMillionUsd: 4.4 },
  "o3-mini": { inputPerMillionUsd: 1.1, outputPerMillionUsd: 4.4 },
  "claude-opus-4-20250918": { inputPerMillionUsd: 15, outputPerMillionUsd: 75 },
  "claude-sonnet-4-20250514": { inputPerMillionUsd: 3, outputPerMillionUsd: 15 },
  "claude-3-haiku": { inputPerMillionUsd: 0.25, outputPerMillionUsd: 1.25 },
  "claude-3.5-sonnet": { inputPerMillionUsd: 3, outputPerMillionUsd: 15 },
  "claude-3-5-sonnet-20241022": { inputPerMillionUsd: 3, outputPerMillionUsd: 15 },
  "claude-3.5-haiku": { inputPerMillionUsd: 0.8, outputPerMillionUsd: 4 },
  "claude-3-5-haiku-20241022": { inputPerMillionUsd: 0.8, outputPerMillionUsd: 4 },
  "claude-opus-4-6": { inputPerMillionUsd: 5, outputPerMillionUsd: 25 },
  "claude-sonnet-4-6": { inputPerMillionUsd: 3, outputPerMillionUsd: 15 },
  "gemini-1.5-pro": { inputPerMillionUsd: 3.5, outputPerMillionUsd: 10.5 },
  "gemini-1.5-flash": { inputPerMillionUsd: 0.35, outputPerMillionUsd: 1.05 },
  "gemini-2.0-flash": { inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4 },
  "gemini-2.5-pro": { inputPerMillionUsd: 1.25, outputPerMillionUsd: 10 },
  "gemini-2.5-flash": { inputPerMillionUsd: 0.3, outputPerMillionUsd: 2.5 },
  "gemini-2.5-flash-lite": { inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4 },
  "deepseek-chat": { inputPerMillionUsd: 0.27, outputPerMillionUsd: 1.1 },
  "deepseek-reasoner": { inputPerMillionUsd: 0.55, outputPerMillionUsd: 2.19 },
  "minimax-m2.5": { inputPerMillionUsd: 0.5, outputPerMillionUsd: 1.8 }
};

export function getModelPricing(model: string, pricing: PricingCatalog = BUILT_IN_PRICING): ModelPricing | undefined {
  return pricing[model];
}

export function calculateCostUsd(model: string, inputTokens: number, outputTokens: number, pricing: PricingCatalog = BUILT_IN_PRICING): number | undefined {
  const modelPricing = getModelPricing(model, pricing);
  if (!modelPricing) {
    return undefined;
  }

  const inputCost = (inputTokens / 1_000_000) * modelPricing.inputPerMillionUsd;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.outputPerMillionUsd;
  return inputCost + outputCost;
}
