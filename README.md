# llm-cost-guard

Drop-in middleware/wrapper for LLM API calls (OpenAI, Anthropic, Google, and compatible SDKs) that tracks spend in real-time with per-user/per-feature budgets and automatic kill switches.

- Author: `darksol`
- License: MIT
- Language: TypeScript
- Module formats: ESM + CJS
- Runtime dependencies: zero

## Install

```bash
npm install llm-cost-guard
```

## Quick start

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
Creates a guard instance with budget rules, pricing, storage, and behavior controls.

### `guard.wrap(llmClient, options?)`
Wraps a client object and auto-tracks usage from common response shapes:
- OpenAI-like: `usage.prompt_tokens`, `usage.completion_tokens`
- Anthropic-like: `usage.input_tokens`, `usage.output_tokens`
- Gemini-like: `usageMetadata.promptTokenCount`, `usageMetadata.candidatesTokenCount`

```ts
const wrappedClient = guard.wrap(openai, {
  userId: "user-123",
  feature: "chat"
});

await wrappedClient.responses.create({
  model: "gpt-4o-mini",
  input: "Hello"
});
```

### `guard.track({ model, inputTokens, outputTokens, userId?, feature? })`
Manual tracking for any provider.

```ts
await guard.track({
  model: "claude-sonnet-4-20250514",
  inputTokens: 1200,
  outputTokens: 800,
  userId: "user-123",
  feature: "summarization"
});
```

### `guard.getUsage(filter?)`
Returns aggregated usage/spend with `byModel`, `byUser`, `byFeature` breakdowns.

```ts
const usage = await guard.getUsage({ windowMs: 24 * 60 * 60 * 1000 });
console.log(usage.totalSpendUsd);
```

### `guard.onBudgetAlert(callback)`
Subscribes to 80/90/100% threshold events.

### `guard.onKill(callback)`
Subscribes to kill-switch events when a budget is exceeded.

## Built-in pricing

Included models:
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4-turbo`
- `gpt-3.5-turbo`
- `claude-opus-4-20250918`
- `claude-sonnet-4-20250514`
- `claude-3-haiku`
- `gemini-1.5-pro`
- `gemini-1.5-flash`

You can override or extend pricing via `createGuard({ pricing: { ... } })`.

## Rolling window budgets

Each budget rule has:
- `limitUsd`: max spend in window
- `windowMs`: rolling window duration
- optional filters: `model`, `userId`, `feature`
- `scopeBy`: `global` | `user` | `feature` | `user_feature`
- `killSwitch`: defaults to `true`

Example:

```ts
const guard = createGuard({
  budgets: [
    { id: "global", limitUsd: 100, windowMs: 3_600_000 },
    { id: "user", limitUsd: 10, windowMs: 86_400_000, scopeBy: "user" },
    { id: "feature", limitUsd: 20, windowMs: 3_600_000, scopeBy: "feature" }
  ]
});
```

## Storage adapter interface

`llm-cost-guard` ships with `MemoryStorageAdapter` and supports custom adapters.

```ts
import type { StorageAdapter, UsageEvent, StorageQuery } from "llm-cost-guard";

class MyStorageAdapter implements StorageAdapter {
  async append(event: UsageEvent) {
    // persist event
  }

  async list(filter?: StorageQuery) {
    // return matching events
    return [];
  }
}
```

## Express middleware

```ts
import express from "express";
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

Reads default headers:
- `x-user-id`
- `x-feature`

Attaches:
- `req.llmCostGuard.track`
- `req.llmCostGuard.getUsage`

## Fastify middleware

```ts
import { createFastifyPreHandler } from "llm-cost-guard";

fastify.addHook("preHandler", createFastifyPreHandler(guard));
```

## CLI

```bash
npx llm-cost-guard status
```

Displays built-in pricing and runtime notes.

## Development

```bash
npm install
npm test
npm run build
```

## License

MIT