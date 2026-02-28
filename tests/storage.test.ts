import { describe, expect, it } from "vitest";
import { MemoryStorageAdapter } from "../src/storage";
import { UsageEvent } from "../src/types";

function makeEvent(createdAt: number, model = "gpt-4o-mini", userId = "u1", feature = "chat"): UsageEvent {
  return {
    model,
    inputTokens: 100,
    outputTokens: 50,
    userId,
    feature,
    timestamp: createdAt,
    createdAt,
    costUsd: 0.001
  };
}

describe("MemoryStorageAdapter", () => {
  it("returns the correct events for since/until filters", () => {
    const storage = new MemoryStorageAdapter();
    const events = [100, 200, 300, 400, 500].map((time) => makeEvent(time));
    for (const event of events) {
      storage.append(event);
    }

    expect(storage.list({ since: 300 }).map((event) => event.createdAt)).toEqual([300, 400, 500]);
    expect(storage.list({ since: 250, until: 450 }).map((event) => event.createdAt)).toEqual([300, 400]);
    expect(storage.list({ since: 501 })).toEqual([]);
  });

  it("keeps non-time filters working when using time bounds", () => {
    const storage = new MemoryStorageAdapter();
    storage.append(makeEvent(100, "gpt-4o-mini", "u1", "chat"));
    storage.append(makeEvent(200, "gpt-5", "u1", "chat"));
    storage.append(makeEvent(300, "gpt-5", "u2", "summarize"));
    storage.append(makeEvent(400, "gpt-5", "u1", "chat"));

    const result = storage.list({ since: 150, model: "gpt-5", userId: "u1", feature: "chat" });
    expect(result.map((event) => event.createdAt)).toEqual([200, 400]);
  });
});
