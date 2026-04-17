#!/usr/bin/env node
import { BUILT_IN_PRICING, calculateCostUsd } from "./pricing";

function printHelp() {
  console.log(`llm-cost-guard

Usage:
  llm-cost-guard status [--json|--csv]
  llm-cost-guard report --model <name> --input <tokens> --output <tokens> [--json]
  llm-cost-guard --help

Commands:
  status   Show built-in model pricing and CLI notes
           --json  Output as JSON array
           --csv   Output as CSV

  report   Calculate cost for a given model and token usage
           --model <name>   Model name (e.g. gpt-5.2-pro)
           --input <tokens> Input token count
           --output <tokens> Output token count
           --json           Output as JSON

Runtime usage is process-local. Query usage through guard.getUsage() inside your app.`);
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function parseKeyValue(args: string[], key: string): string | undefined {
  const idx = args.indexOf(`--${key}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function parseNumber(args: string[], key: string): number | undefined {
  const val = parseKeyValue(args, key);
  return val !== undefined ? Number(val) : undefined;
}

function printStatus(args: string[]) {
  const isJson = args.includes("--json");
  const isCsv = args.includes("--csv");

  const entries = Object.entries(BUILT_IN_PRICING).map(([model, price]) => ({
    model,
    inputPerMillionUsd: price.inputPerMillionUsd,
    outputPerMillionUsd: price.outputPerMillionUsd
  }));

  if (isJson) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (isCsv) {
    console.log("model,input_per_million_usd,output_per_million_usd");
    for (const e of entries) {
      console.log(`${e.model},${e.inputPerMillionUsd},${e.outputPerMillionUsd}`);
    }
    return;
  }

  console.log("Built-in pricing (USD per 1M tokens):");
  for (const [model, price] of Object.entries(BUILT_IN_PRICING)) {
    console.log(`- ${model}: input ${formatUsd(price.inputPerMillionUsd)}, output ${formatUsd(price.outputPerMillionUsd)}`);
  }
  console.log("\nRuntime usage is process-local. Query usage through guard.getUsage() inside your app.");
}

function printReport(args: string[]) {
  const model = parseKeyValue(args, "model");
  const inputTokens = parseNumber(args, "input");
  const outputTokens = parseNumber(args, "output");
  const isJson = args.includes("--json");

  if (!model || inputTokens === undefined || outputTokens === undefined) {
    console.error("report: --model, --input, and --output are required");
    process.exit(1);
  }

  if (isNaN(inputTokens) || isNaN(outputTokens)) {
    console.error("report: --input and --output must be numbers");
    process.exit(1);
  }

  const cost = calculateCostUsd(model, inputTokens, outputTokens);

  if (cost === undefined) {
    console.error(`report: unknown model "${model}"`);
    process.exit(1);
  }

  if (isJson) {
    console.log(JSON.stringify({
      model,
      inputTokens,
      outputTokens,
      costUsd: parseFloat(cost.toFixed(6))
    }));
    return;
  }

  const inputCost = (inputTokens / 1_000_000) * (BUILT_IN_PRICING[model]?.inputPerMillionUsd ?? 0);
  const outputCost = (outputTokens / 1_000_000) * (BUILT_IN_PRICING[model]?.outputPerMillionUsd ?? 0);

  console.log(`${model}`);
  console.log(`  Input tokens:  ${inputTokens.toLocaleString()} × $${(BUILT_IN_PRICING[model]?.inputPerMillionUsd ?? 0).toFixed(2)}/1M = ${formatUsd(inputCost)}`);
  console.log(`  Output tokens: ${outputTokens.toLocaleString()} × $${(BUILT_IN_PRICING[model]?.outputPerMillionUsd ?? 0).toFixed(2)}/1M = ${formatUsd(outputCost)}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Total cost: ${formatUsd(cost)}`);
}

const command = process.argv[2];
if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "status") {
  printStatus(process.argv.slice(3));
  process.exit(0);
}

if (command === "report") {
  printReport(process.argv.slice(3));
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
printHelp();
process.exit(1);
