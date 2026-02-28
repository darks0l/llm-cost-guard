import { ModelPricing, PricingCatalog } from "./types";

export const BUILT_IN_PRICING: PricingCatalog = {
  "gpt-4o": { inputPerMillionUsd: 5, outputPerMillionUsd: 15 },
  "gpt-4o-mini": { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 },
  "gpt-4-turbo": { inputPerMillionUsd: 10, outputPerMillionUsd: 30 },
  "gpt-3.5-turbo": { inputPerMillionUsd: 0.5, outputPerMillionUsd: 1.5 },
  "claude-opus-4-20250918": { inputPerMillionUsd: 15, outputPerMillionUsd: 75 },
  "claude-sonnet-4-20250514": { inputPerMillionUsd: 3, outputPerMillionUsd: 15 },
  "claude-3-haiku": { inputPerMillionUsd: 0.25, outputPerMillionUsd: 1.25 },
  "gemini-1.5-pro": { inputPerMillionUsd: 3.5, outputPerMillionUsd: 10.5 },
  "gemini-1.5-flash": { inputPerMillionUsd: 0.35, outputPerMillionUsd: 1.05 }
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