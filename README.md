# llm-cost-guard

Drop-in spend tracking, budgets, and kill switches for LLM API calls. Wrap any SDK client or track manually — zero runtime dependencies, TypeScript-first, works with every provider.

- **Author:** [`darksol`](https://github.com/darks0l)
- **License:** MIT
- **Runtime deps:** zero
- **Formats:** ESM + CJS + TypeScript types
- **Node:** ≥ 18

## Install

```bash
npm install llm-cost-guard
```

## Why?

LLM API costs can spiral fast — one bad loop, one forgotten test, one over-eager agent. `llm-cost-guard` gives you:

- **Rolling-window budgets** — per-user, per-feature, or global
- **Kill switches** — auto-throw when limits are hit
- **Threshold alerts** — callbacks at 80%, 90%, 100%
- **Auto-tracking** — wrap any OpenAI/Anthropic/Google SDK and it just works
- **Manual tracking** — `guard.track()` for any provider
- **Express + Fastify middleware** — precheck gates before LLM calls even happen
- **Custom pricing** — override built-ins or add your own models
- **Pluggable storage** — in-memory by default, swap in Redis/SQLite/Postgres

## Quick Start

```ts
import { createGuard } from "llm-cost-guard";

const guard = createGuard({
  budgets: [
    { id: "global-hourly", limitUsd: 50, windowMs: 60 * 60 * 1000 },
    { id: "per-user-daily", limitUsd: 5, windowMs: 24 * 60 * 60 * 1000, scopeBy: "user" },
    { id: "per-feature", limitUsd: 10, windowMs: 60 * 60 * 1000, scopeBy: "feature" }
  ]
});

guard.onBudgetAlert((alert) => {
  console.log(`⚠️ [${alert.thresholdPercent}%] ${alert.scopeKey}: $${alert.usageUsd.toFixed(4)} / $${alert.limitUsd}`);
});

guard.onKill((event) => {
  console.error(`🛑 Kill switch: ${event.scopeKey} exceeded $${event.limitUsd}`);
});
```

## Core API

### `createGuard(config)`

Creates a guard instance. Config options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `budgets` | `BudgetRule[]` | *required* | Budget rules to enforce |
| `pricing` | `PricingCatalog` | built-in | Override or extend model pricing |
| `storage` | `StorageAdapter` | `MemoryStorageAdapter` | Custom persistence backend |
| `throwOnKill` | `boolean` | `true` | Throw `BudgetExceededError` when limit hit |
| `onUnknownModel` | `"error" \| "zero"` | `"error"` | Behavior for unrecognized models |
| `now` | `() => number` | `Date.now` | Injectable clock (useful for testing) |

### `guard.wrap(client, options?)`

Wraps any SDK client via Proxy — auto-extracts usage from responses:

- **OpenAI:** `usage.prompt_tokens` / `usage.completion_tokens`
- **Anthropic:** `usage.input_tokens` / `usage.output_tokens`
- **Google Gemini:** `usageMetadata.promptTokenCount` / `usageMetadata.candidatesTokenCount`

```ts
import OpenAI from "openai";

const openai = new OpenAI();
const wrapped = guard.wrap(openai, { userId: "user-123", feature: "chat" });

// Every call is now automatically tracked
await wrapped.responses.create({ model: "gpt-5", input: "Hello" });
```

### `guard.track(request)`

Manual tracking for any provider:

```ts
await guard.track({
  model: "claude-sonnet-4-6",
  inputTokens: 1200,
  outputTokens: 800,
  userId: "user-123",
  feature: "summarization"
});
```

### `guard.getUsage(filter?)`

Returns aggregated spend with `byModel`, `byUser`, `byFeature` breakdowns:

```ts
const usage = await guard.getUsage({ windowMs: 24 * 60 * 60 * 1000 });
console.log(`Last 24h: $${usage.totalSpendUsd.toFixed(4)} across ${usage.totalCalls} calls`);
```

### `guard.onBudgetAlert(callback)` / `guard.onKill(callback)`

Subscribe to threshold events. Returns an unsubscribe function.

## Budget Rules

Each rule supports:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `limitUsd` | `number` | Max spend in window |
| `windowMs` | `number` | Rolling window duration |
| `scopeBy` | `"global" \| "user" \| "feature" \| "user_feature"` | Scoping dimension |
| `model` | `string` | Optional model filter |
| `killSwitch` | `boolean` | Auto-kill on exceed (default: `true`) |

```ts
const guard = createGuard({
  budgets: [
    // Hard global cap
    { id: "global", limitUsd: 100, windowMs: 3_600_000 },
    // Per-user daily limit
    { id: "user-daily", limitUsd: 10, windowMs: 86_400_000, scopeBy: "user" },
    // Expensive model guard
    { id: "opus-guard", limitUsd: 25, windowMs: 3_600_000, model: "claude-opus-4-6" },
    // Soft warning only (no kill)
    { id: "soft-warn", limitUsd: 50, windowMs: 3_600_000, killSwitch: false }
  ]
});
```

---

## Built-in Pricing (46 models)

All prices are **USD per 1M tokens**. Override any entry or add your own via `pricing` config.

### OpenAI

| Model | Input | Output |
|-------|------:|-------:|
| `gpt-5.2-pro` | $21.00 | $168.00 |
| `gpt-5.2` | $1.75 | $14.00 |
| `gpt-5` | $1.25 | $10.00 |
| `gpt-5-mini` | $0.25 | $2.00 |
| `gpt-5-nano` | $0.05 | $0.40 |
| `gpt-4o` | $2.50 | $10.00 |
| `gpt-4o-mini` | $0.15 | $0.60 |
| `gpt-4-turbo` | $10.00 | $30.00 |
| `gpt-4.1` | $3.00 | $12.00 |
| `gpt-4.1-mini` | $0.80 | $3.20 |
| `gpt-4.1-nano` | $0.20 | $0.80 |
| `gpt-3.5-turbo` | $0.50 | $1.50 |
| `o1` | $15.00 | $60.00 |
| `o1-mini` | $3.00 | $12.00 |
| `o3-mini` | $1.10 | $4.40 |
| `gpt-realtime` | $4.00 | $16.00 |
| `gpt-realtime-mini` | $0.60 | $2.40 |

### Anthropic

| Model | Input | Output |
|-------|------:|-------:|
| `claude-opus-4-6` | $5.00 | $25.00 |
| `claude-opus-4-5` | $5.00 | $25.00 |
| `claude-sonnet-4-6` | $3.00 | $15.00 |
| `claude-sonnet-4-5` | $3.00 | $15.00 |
| `claude-haiku-4-5` | $1.00 | $5.00 |
| `claude-3.5-sonnet` | $3.00 | $15.00 |
| `claude-3-5-sonnet-20241022` | $3.00 | $15.00 |
| `claude-3.5-haiku` | $0.80 | $4.00 |
| `claude-3-5-haiku-20241022` | $0.80 | $4.00 |
| `claude-3-haiku` | $0.25 | $1.25 |
| `claude-opus-4-20250918` | $15.00 | $75.00 |
| `claude-sonnet-4-20250514` | $3.00 | $15.00 |

### Google Gemini

| Model | Input | Output |
|-------|------:|-------:|
| `gemini-3-pro` | $2.00 | $12.00 |
| `gemini-3-flash` | $0.50 | $3.00 |
| `gemini-2.5-pro` | $1.25 | $10.00 |
| `gemini-2.5-flash` | $0.30 | $2.50 |
| `gemini-2.5-flash-lite` | $0.10 | $0.40 |
| `gemini-2.0-flash` | $0.10 | $0.40 |
| `gemini-1.5-pro` | $3.50 | $10.50 |
| `gemini-1.5-flash` | $0.35 | $1.05 |

### DeepSeek

| Model | Input | Output |
|-------|------:|-------:|
| `deepseek-chat` | $0.27 | $1.10 |
| `deepseek-reasoner` | $0.55 | $2.19 |

### MiniMax

| Model | Input | Output |
|-------|------:|-------:|
| `minimax-m2.5` | $0.50 | $1.80 |

> **Pricing last updated:** February 2026. Prices change — verify with your provider. Use `pricing` config to override.

---

## Custom Pricing

Override built-in prices or add any model:

```ts
const guard = createGuard({
  budgets: [{ id: "global", limitUsd: 100, windowMs: 3_600_000 }],
  pricing: {
    // Override an existing model's price
    "gpt-5": { inputPerMillionUsd: 1.0, outputPerMillionUsd: 8.0 },
    // Add a model not in the catalog
    "my-fine-tune": { inputPerMillionUsd: 0.5, outputPerMillionUsd: 2.0 },
    // Local/free models
    "llama-3-70b": { inputPerMillionUsd: 0, outputPerMillionUsd: 0 }
  }
});
```

Your entries merge with (and override) built-ins. To start from scratch:

```ts
const guard = createGuard({
  budgets: [...],
  pricing: {
    // Only these models will be recognized
    "gpt-5": { inputPerMillionUsd: 1.25, outputPerMillionUsd: 10 }
  },
  onUnknownModel: "zero" // Don't throw on unknown models, just track at $0
});
```

---

## Storage Adapters

`MemoryStorageAdapter` ships by default (optimized with binary search for time-range queries). For production persistence, implement `StorageAdapter`:

```ts
import type { StorageAdapter, StorageQuery, UsageEvent } from "llm-cost-guard";

class RedisStorageAdapter implements StorageAdapter {
  async append(event: UsageEvent): Promise<void> {
    // Store event in Redis sorted set by createdAt
  }

  async list(filter?: StorageQuery): Promise<UsageEvent[]> {
    // Query by model/userId/feature/since/until
    return [];
  }

  async reset(): Promise<void> {
    // Optional: clear all data
  }
}

const guard = createGuard({
  budgets: [...],
  storage: new RedisStorageAdapter()
});
```

`StorageQuery` fields: `model`, `userId`, `feature`, `since`, `until`.

---

## Express Middleware

Gate requests before LLM calls happen:

```ts
import { createExpressMiddleware } from "llm-cost-guard";

app.use(
  createExpressMiddleware(guard, {
    precheck: {
      enabled: true,
      maxSpendUsd: 5,
      windowMs: 24 * 60 * 60 * 1000
    }
  })
);
```

Returns **429** if the user/feature is over budget. Reads `x-user-id` and `x-feature` headers by default (customizable via `userIdResolver`/`featureResolver`).

Attaches `req.llmCostGuard.track` and `req.llmCostGuard.getUsage` for in-route tracking.

## Fastify Hook

```ts
import { createFastifyPreHandler } from "llm-cost-guard";
fastify.addHook("preHandler", createFastifyPreHandler(guard));
```

---

## CLI

```bash
npx llm-cost-guard status
```

Prints built-in model pricing for quick reference.

---

## Error Handling

```ts
import { BudgetExceededError, UnknownModelPricingError } from "llm-cost-guard";

try {
  await guard.track({ model: "gpt-5", inputTokens: 1_000_000, outputTokens: 500_000 });
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.log(`Budget "${err.event.scopeKey}" exceeded: $${err.event.usageUsd}`);
  }
  if (err instanceof UnknownModelPricingError) {
    console.log("Add this model to your pricing config");
  }
}
```

Set `throwOnKill: false` to get `killTriggered: true` in the result instead of throwing.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## Contributing

```bash
git clone https://github.com/darks0l/llm-cost-guard.git
cd llm-cost-guard
npm install
npm test
npm run build
```

## License

MIT
