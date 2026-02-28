import { describe, expect, it } from "vitest";
import { BUILT_IN_PRICING, calculateCostUsd, getModelPricing } from "../src/pricing";

describe("pricing", () => {
  it("returns built-in pricing entries", () => {
    expect(getModelPricing("gpt-4o", BUILT_IN_PRICING)).toEqual({
      inputPerMillionUsd: 2.5,
      outputPerMillionUsd: 10
    });
  });

  it("includes newly added model pricing entries", () => {
    expect(getModelPricing("claude-opus-4-6", BUILT_IN_PRICING)).toEqual({
      inputPerMillionUsd: 5,
      outputPerMillionUsd: 25
    });
    expect(getModelPricing("gpt-5", BUILT_IN_PRICING)).toEqual({
      inputPerMillionUsd: 1.25,
      outputPerMillionUsd: 10
    });
    expect(getModelPricing("gemini-2.5-pro", BUILT_IN_PRICING)).toEqual({
      inputPerMillionUsd: 1.25,
      outputPerMillionUsd: 10
    });
    expect(getModelPricing("deepseek-chat", BUILT_IN_PRICING)).toEqual({
      inputPerMillionUsd: 0.27,
      outputPerMillionUsd: 1.1
    });
  });

  it("calculates token cost correctly", () => {
    const cost = calculateCostUsd("gpt-4o-mini", 500_000, 250_000, BUILT_IN_PRICING);
    expect(cost).toBeCloseTo(0.225, 6);
  });

  it("returns undefined for unknown models", () => {
    expect(calculateCostUsd("unknown", 1000, 1000, BUILT_IN_PRICING)).toBeUndefined();
  });
});
