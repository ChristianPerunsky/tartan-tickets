import { createEventStore, type EventStore } from "./events";
import { buildSeedEvents } from "./seed";

// Keep one store for the whole server process. In `next dev`, modules are
// reloaded often, so the store is parked on globalThis to survive reloads.
const globalForStore = globalThis as unknown as { tartanEventStore?: EventStore };

export function getEventStore(): EventStore {
  if (!globalForStore.tartanEventStore) {
    globalForStore.tartanEventStore = createEventStore(buildSeedEvents());
  }
  return globalForStore.tartanEventStore;
}
