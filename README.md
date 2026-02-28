# llm-cost-guard

TypeScript guardrails for LLM API spend. Wrap clients or track calls manually, enforce rolling budgets, and trigger kill switches before costs drift.

- Author: `darksol`
- License: MIT
- Runtime dependencies: zero
- Package formats: ESM + CJS

## Install

```bash
npm install llm-cost-guard
```

## Quick Start

```ts
import { createGuard } from "llm-cost-guard";

const guard = createGuard({
  budgets: [
    { id: "global-hourly", limitUsd: 50, windowMs: 60 * 60 * 1000 },
    { id: "per-user-daily", limitUsd: 5, windowMs: 24 * 60 * 60 * 1000, scopeBy: "user" },
    { id: "per-feature-hourly", limitUsd: 10, windowMs: 60 * 60 * 1000, scopeBy: "feature" }
  ]
});

guard.onBudgetAlert((alert) => {
  console.log(`[${alert.thresholdPercent}%] ${alert.scopeKey}: $${alert.usageUsd.toFixed(4)} / $${alert.limitUsd.toFixed(4)}`);
});

guard.onKill((event) => {
  console.error(`Kill switch: ${event.scopeKey} exceeded budget`);
});
```

## Core API

### `createGuard(config)`
Creates a guard instance with budgets, pricing, storage adapter, and runtime behavior.

### `guard.wrap(client, options?)`
Proxies a client and auto-tracks usage from common response payloads:

- OpenAI-like: `usage.prompt_tokens`, `usage.completion_tokens`
- Anthropic-like: `usage.input_tokens`, `usage.output_tokens`
- Gemini-like: `usageMetadata.promptTokenCount`, `usageMetadata.candidatesTokenCount`

```ts
const wrappedClient = guard.wrap(openai, { userId: "u-123", feature: "chat" });
await wrappedClient.responses.create({ model: "gpt-4o-mini", input: "Hello" });
```

### `guard.track(request)`
Manual usage tracking for any provider.

```ts
await guard.track({
  model: "claude-sonnet-4-20250514",
  inputTokens: 1200,
  outputTokens: 800,
  userId: "u-123",
  feature: "summarization"
});
```

### `guard.getUsage(filter?)`
Returns aggregated usage and spend with breakdowns by model, user, and feature.

### `guard.onBudgetAlert(callback)`
Subscribes to threshold alerts at 80%, 90%, and 100%.

### `guard.onKill(callback)`
Subscribes to budget kill-switch events.

## Supported Models and Built-in Pricing

Prices are USD per 1M tokens.

| Provider | Model | Input | Output | Notes |
| --- | --- | ---: | ---: | --- |
| OpenAI | `gpt-4o` | 2.50 | 10.00 | |
| OpenAI | `gpt-4o-mini` | 0.15 | 0.60 | |
| OpenAI | `gpt-4-turbo` | 10.00 | 30.00 | legacy |
| OpenAI | `gpt-3.5-turbo` | 0.50 | 1.50 | legacy |
| OpenAI | `gpt-4.1` | 2.00 | 8.00 | |
| OpenAI | `gpt-4.1-mini` | 0.80 | 3.20 | |
| OpenAI | `gpt-4.1-nano` | 0.20 | 0.80 | |
| OpenAI | `gpt-5` | 1.25 | 10.00 | |
| OpenAI | `gpt-5-mini` | 0.25 | 2.00 | |
| OpenAI | `o1` | 15.00 | 60.00 | |
| OpenAI | `o1-mini` | 1.10 | 4.40 | |
| OpenAI | `o3-mini` | 1.10 | 4.40 | |
| Anthropic | `claude-opus-4-20250918` | 15.00 | 75.00 | legacy ID |
| Anthropic | `claude-sonnet-4-20250514` | 3.00 | 15.00 | legacy ID |
| Anthropic | `claude-3-haiku` | 0.25 | 1.25 | |
| Anthropic | `claude-3.5-sonnet` | 3.00 | 15.00 | |
| Anthropic | `claude-3-5-sonnet-20241022` | 3.00 | 15.00 | |
| Anthropic | `claude-3.5-haiku` | 0.80 | 4.00 | |
| Anthropic | `claude-3-5-haiku-20241022` | 0.80 | 4.00 | |
| Anthropic | `claude-opus-4-6` | 15.00 | 75.00 | |
| Anthropic | `claude-sonnet-4-6` | 3.00 | 15.00 | |
| Google | `gemini-1.5-pro` | 3.50 | 10.50 | |
| Google | `gemini-1.5-flash` | 0.35 | 1.05 | |
| Google | `gemini-2.0-flash` | 0.10 | 0.40 | |
| Google | `gemini-2.5-pro` | 1.25 | 10.00 | |
| Google | `gemini-2.5-flash` | 0.30 | 2.50 | |
| Google | `gemini-2.5-flash-lite` | 0.10 | 0.40 | |
| DeepSeek | `deepseek-chat` | 0.27 | 1.10 | |
| DeepSeek | `deepseek-reasoner` | 0.55 | 2.19 | |
| MiniMax | `minimax-m2.5` | 0.50 | 1.80 | |

## Custom Pricing

`createGuard` merges your `pricing` map on top of built-ins. This lets you override defaults or add private model IDs.

```ts
import { createGuard, BUILT_IN_PRICING } from "llm-cost-guard";

const guard = createGuard({
  budgets: [{ id: "global", limitUsd: 100, windowMs: 3_600_000 }],
  pricing: {
    ...BUILT_IN_PRICING,
    "gpt-5": { inputPerMillionUsd: 1.1, outputPerMillionUsd: 9.5 },
    "my-internal-model": { inputPerMillionUsd: 0.2, outputPerMillionUsd: 0.8 }
  }
});
```

## Storage Adapters

`MemoryStorageAdapter` is included for process-local usage. For production, you can supply any adapter that implements `StorageAdapter`.

```ts
export interface StorageAdapter {
  append(event: UsageEvent): void | Promise<void>;
  list(filter?: StorageQuery): UsageEvent[] | Promise<UsageEvent[]>;
  reset?(): void | Promise<void>;
}
```

`StorageQuery` supports `model`, `userId`, `feature`, `since`, and `until`. `guard.getUsage({ windowMs })` is converted internally to a `since` timestamp.

Example custom adapter:

```ts
import type { StorageAdapter, StorageQuery, UsageEvent } from "llm-cost-guard";

class MyStorageAdapter implements StorageAdapter {
  async append(event: UsageEvent): Promise<void> {
    // Persist event in DB or queue.
  }

  async list(filter?: StorageQuery): Promise<UsageEvent[]> {
    // Return matching events from your store.
    return [];
  }

  async reset(): Promise<void> {
    // Optional test helper.
  }
}
```

## Express Middleware

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

Default headers:

- `x-user-id`
- `x-feature`

Request helpers:

- `req.llmCostGuard.track`
- `req.llmCostGuard.getUsage`

## Fastify Hook

```ts
import { createFastifyPreHandler } from "llm-cost-guard";

fastify.addHook("preHandler", createFastifyPreHandler(guard));
```

## CLI

```bash
npx llm-cost-guard status
```

Prints built-in pricing and runtime notes.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## Development

```bash
npm install
npm test
npm run build
```
