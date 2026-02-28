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

export class MemoryStorageAdapter implements StorageAdapter {
  private events: UsageEvent[] = [];

  append(event: UsageEvent): void {
    this.events.push(event);
  }

  list(filter?: StorageQuery): UsageEvent[] {
    return this.events.filter((event) => matchesFilter(event, filter));
  }

  reset(): void {
    this.events = [];
  }
}