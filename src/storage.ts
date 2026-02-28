import { StorageAdapter, StorageQuery, UsageEvent } from "./types";

function matchesFilter(event: UsageEvent, filter?: StorageQuery): boolean {
  if (!filter) {
    return true;
  }

  if (filter.model && event.model !== filter.model) {
    return false;
  }

  if (filter.userId && event.userId !== filter.userId) {
    return false;
  }

  if (filter.feature && event.feature !== filter.feature) {
    return false;
  }

  if (typeof filter.since === "number" && event.createdAt < filter.since) {
    return false;
  }

  if (typeof filter.until === "number" && event.createdAt > filter.until) {
    return false;
  }

  return true;
}

function lowerBoundByCreatedAt(events: UsageEvent[], target: number): number {
  let low = 0;
  let high = events.length;

  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if (events[mid].createdAt < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function upperBoundByCreatedAt(events: UsageEvent[], target: number): number {
  let low = 0;
  let high = events.length;

  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if (events[mid].createdAt <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private events: UsageEvent[] = [];

  append(event: UsageEvent): void {
    this.events.push(event);
  }

  list(filter?: StorageQuery): UsageEvent[] {
    const hasSince = typeof filter?.since === "number";
    const hasUntil = typeof filter?.until === "number";
    const startIndex = hasSince ? lowerBoundByCreatedAt(this.events, filter.since as number) : 0;
    const endExclusive = hasUntil ? upperBoundByCreatedAt(this.events, filter.until as number) : this.events.length;

    const result: UsageEvent[] = [];
    for (let i = startIndex; i < endExclusive; i += 1) {
      const event = this.events[i];
      if (matchesFilter(event, filter)) {
        result.push(event);
      }
    }

    return result;
  }

  reset(): void {
    this.events = [];
  }
}
