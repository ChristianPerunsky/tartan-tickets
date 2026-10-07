// In-memory event data for Story 1 (no database: everything lives in server memory
// and resets when the server restarts).

export type EventStatus = "published" | "cancelled";

// Matches the `events` table in docs/requirements.md, plus `seats_sold`,
// which later stories will derive from orders.
export interface EventRecord {
  event_id: string;
  club_id: string;
  title: string;
  starts_at: string; // ISO 8601, e.g. "2026-10-16T23:00:00Z"
  location: string;
  price_cents: number;
  capacity: number;
  status: EventStatus;
  seats_sold: number;
}

// What students (and the API) see: no internal bookkeeping, plus seats_remaining.
export interface EventView {
  event_id: string;
  club_id: string;
  title: string;
  starts_at: string;
  location: string;
  price_cents: number;
  capacity: number;
  seats_remaining: number;
}

export interface EventStore {
  events: EventRecord[];
}

export function createEventStore(events: EventRecord[]): EventStore {
  return { events: [...events] };
}

// Upcoming = published (not cancelled) and starting after `now`, soonest first.
export function listUpcomingEvents(store: EventStore, now: Date = new Date()): EventView[] {
  return store.events
    .filter((e) => e.status === "published" && new Date(e.starts_at).getTime() > now.getTime())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .map((e) => ({
      event_id: e.event_id,
      club_id: e.club_id,
      title: e.title,
      starts_at: e.starts_at,
      location: e.location,
      price_cents: e.price_cents,
      capacity: e.capacity,
      // Clamp at 0 so bad data can never show "-4 seats left".
      seats_remaining: Math.max(0, e.capacity - e.seats_sold),
    }));
}
