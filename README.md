<p align="center">
  <img src="./assets/darksol-logo.png" alt="DARKSOL" width="140" />
</p>

# llm-cost-guard

Drop-in spend tracking, rolling budgets, and kill switches for LLM API calls.

[![npm version](https://img.shields.io/npm/v/llm-cost-guard)](https://www.npmjs.com/package/llm-cost-guard)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node >=18](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org)

## Why this exists

LLM bills can spike from runaway loops, prompt explosions, or accidental load. `llm-cost-guard` gives you hard limits and visibility without locking you into one provider SDK.

## What it does

- Tracks spend from token usage with built-in model pricing
- Enforces rolling-window budgets globally or by user/feature
- Triggers threshold alerts (80/90/100%) and kill events
- Wraps SDK clients (OpenAI/Anthropic/Gemini-style usage fields)
- Supports manual usage tracking for any provider
- Provides Express/Fastify precheck guards
- Uses pluggable storage (in-memory included)

## Quickstart

```bash
npm install llm-cost-guard
```

```ts
import { createGuard } from "llm-cost-guard";

const guard = createGuard({
  budgets: [{ id: "global-hourly", limitUsd: 50, windowMs: 60 * 60 * 1000 }]
});

await guard.track({
  model: "gpt-5",
  inputTokens: 1200,
  outputTokens: 800,
  userId: "u_123",
  feature: "chat"
});
```

## Real examples

```ts
import OpenAI from "openai";
import { createGuard } from "llm-cost-guard";

const guard = createGuard({
  budgets: [
    { id: "global", limitUsd: 100, windowMs: 3_600_000 },
    { id: "user-daily", limitUsd: 10, windowMs: 86_400_000, scopeBy: "user" }
  ]
});

const wrapped = guard.wrap(new OpenAI(), { userId: "u_42", feature: "assistant" });
await wrapped.responses.create({ model: "gpt-5", input: "Summarize this transcript" });
```

```ts
guard.onBudgetAlert((event) => {
  console.log(`[${event.thresholdPercent}%] ${event.scopeKey}: $${event.usageUsd.toFixed(4)} / $${event.limitUsd}`);
});

guard.onKill((event) => {
  console.error(`Kill switch: ${event.scopeKey} exceeded $${event.limitUsd}`);
});
```

## Config / options

| Option | Type | Default | Description |
|---|---|---|---|
| `budgets` | `BudgetRule[]` | required | Rules to enforce |
| `pricing` | `PricingCatalog` | built-in | Override/add model pricing |
| `storage` | `StorageAdapter` | `MemoryStorageAdapter` | Persist usage events |
| `throwOnKill` | `boolean` | `true` | Throw `BudgetExceededError` when exceeded |
| `onUnknownModel` | `"error" \| "zero"` | `"error"` | Unknown model behavior |
| `now` | `() => number` | `Date.now` | Injectable clock for testing |

## Architecture / flow

1. Ingest usage via `guard.wrap(...)` or `guard.track(...)`.
2. Resolve model pricing and compute cost.
3. Store usage event in selected adapter.
4. Evaluate matching budget scopes/windows.
5. Emit alert/kill events and optionally throw.

## Benchmarks / perf notes

- Zero runtime dependencies.
- Default `MemoryStorageAdapter` keeps chronological events and optimizes time-window queries.
- For multi-instance deployments, use a shared `StorageAdapter` (Redis/Postgres/etc.) to keep budget state consistent.

## Limitations + roadmap

### Current limitations

- Built-in pricing is static; provider pricing changes require updates/overrides
- SDK auto-wrap depends on providers exposing token usage in response payloads
- In-memory adapter is process-local (not distributed)

### Roadmap

- Additional ready-made storage adapters
- More provider-specific usage extractors
- Optional sampled telemetry/export hooks

## License + links

- License: [MIT](./LICENSE)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- npm: <https://www.npmjs.com/package/llm-cost-guard>
- Issues: <https://github.com/darks0l/llm-cost-guard/issues>
