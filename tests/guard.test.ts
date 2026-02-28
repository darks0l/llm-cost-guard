import { describe, expect, it, vi } from "vitest";
import { BudgetExceededError, createGuard, UnknownModelPricingError } from "../src/guard";

describe("guard", () => {
  it("tracks spend and aggregates usage", async () => {
    const guard = createGuard({
      budgets: [{ id: "global", limitUsd: 10, windowMs: 60_000 }]
    });

    await guard.track({ model: "gpt-4o-mini", inputTokens: 100_000, outputTokens: 100_000, userId: "u1", feature: "chat" });
    const usage = await guard.getUsage();

    expect(usage.totalCalls).toBe(1);
    expect(usage.totalSpendUsd).toBeCloseTo(0.075, 6);
    expect(usage.byUser.u1).toBeCloseTo(0.075, 6);
    expect(usage.byFeature.chat).toBeCloseTo(0.075, 6);
  });

  it("fires threshold alerts at 80/90/100", async () => {
    const alerts: number[] = [];
    const guard = createGuard({
      budgets: [{ id: "global", limitUsd: 1, windowMs: 60_000 }]
    });

    guard.onBudgetAlert((alert) => alerts.push(alert.thresholdPercent));

    await guard.track({ model: "gpt-4o", inputTokens: 320_000, outputTokens: 0 });
    await guard.track({ model: "gpt-4o", inputTokens: 40_000, outputTokens: 0 });
    await guard.track({ model: "gpt-4o", inputTokens: 40_000, outputTokens: 0 });

    expect(alerts).toEqual([80, 90, 100]);
  });

  it("throws and triggers kill callbacks when budget is exceeded", async () => {
    const onKill = vi.fn();
    const guard = createGuard({
      budgets: [{ id: "global", limitUsd: 0.01, windowMs: 60_000 }]
    });

    guard.onKill(onKill);

    await expect(
      guard.track({ model: "gpt-4o-mini", inputTokens: 100_000, outputTokens: 0 })
    ).rejects.toBeInstanceOf(BudgetExceededError);

    expect(onKill).toHaveBeenCalledOnce();
  });

  it("supports rolling windows", async () => {
    let current = 1_000_000;
    const guard = createGuard({
      budgets: [{ id: "global", limitUsd: 100, windowMs: 1_000 }],
      now: () => current
    });

    await guard.track({ model: "gpt-4o-mini", inputTokens: 100_000, outputTokens: 0 });
    current += 2_000;

    const usage = await guard.getUsage({ windowMs: 1_000 });
    expect(usage.totalCalls).toBe(0);
  });

  it("throws for unknown model when configured", async () => {
    const guard = createGuard({
      budgets: [{ id: "global", limitUsd: 100, windowMs: 60_000 }],
      onUnknownModel: "error"
    });

    await expect(
      guard.track({ model: "unknown-model", inputTokens: 10, outputTokens: 10 })
    ).rejects.toBeInstanceOf(UnknownModelPricingError);
  });

  it("wraps a client and auto-tracks usage from API responses", async () => {
    const rawClient = {
      responses: {
        create: async () => ({
          model: "gpt-4o-mini",
          usage: {
            prompt_tokens: 100,
            completion_tokens: 200
          }
        })
      }
    };

    const guard = createGuard({
      budgets: [{ id: "global", limitUsd: 100, windowMs: 60_000 }]
    });

    const client = guard.wrap(rawClient, { userId: "u-wrap", feature: "assistant" });
    await client.responses.create();

    const usage = await guard.getUsage({ userId: "u-wrap", feature: "assistant" });
    expect(usage.totalCalls).toBe(1);
    expect(usage.totalInputTokens).toBe(100);
    expect(usage.totalOutputTokens).toBe(200);
  });

  it("supports scoped budgets by user", async () => {
    const guard = createGuard({
      budgets: [{ id: "user-budget", limitUsd: 0.05, windowMs: 60_000, scopeBy: "user" }],
      throwOnKill: false
    });

    const a = await guard.track({ model: "gpt-4o-mini", inputTokens: 100_000, outputTokens: 0, userId: "u1" });
    const b = await guard.track({ model: "gpt-4o-mini", inputTokens: 100_000, outputTokens: 0, userId: "u2" });

    expect(a.killTriggered).toBe(false);
    expect(b.killTriggered).toBe(false);
  });
});
