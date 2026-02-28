#!/usr/bin/env node
import { BUILT_IN_PRICING } from "./pricing";

function printHelp() {
  console.log(`llm-cost-guard\n\nUsage:\n  llm-cost-guard status\n  llm-cost-guard --help\n\nCommands:\n  status   Show built-in model pricing and CLI notes`);
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function printStatus() {
  console.log("Built-in pricing (USD per 1M tokens):");
  for (const [model, price] of Object.entries(BUILT_IN_PRICING)) {
    console.log(`- ${model}: input ${formatUsd(price.inputPerMillionUsd)}, output ${formatUsd(price.outputPerMillionUsd)}`);
  }

  console.log("\nRuntime usage is process-local. Query usage through guard.getUsage() inside your app.");
}

const command = process.argv[2];
if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "status") {
  printStatus();
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
printHelp();
process.exit(1);