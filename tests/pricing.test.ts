import { describe, expect, it } from "vitest";
import { BUILT_IN_PRICING, calculateCostUsd, getModelPricing } from "../src/pricing";

describe("pricing", () => {
  it("returns built-in pricing entries", () => {
    expect(getModelPricing("gpt-4o", BUILT_IN_PRICING)).toEqual({
      inputPerMillionUsd: 5,
      outputPerMillionUsd: 15
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