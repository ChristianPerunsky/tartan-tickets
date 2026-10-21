// In-memory event data for Stories 1 and 3 (no database: everything lives in server
// memory and resets when the server restarts).
import type { OrderRecord, ReceiptEmail, TicketRecord } from "./orders";

export type EventStatus = "published" | "cancelled";

// Matches the `events` table in docs/requirements.md, plus `seats_sold`,
// which counts seats from paid orders (Story 3 adds to it when a payment succeeds).
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

// Everything lives in server memory. Orders, tickets and the receipt "outbox"
// (Story 3) sit next to the events so one store holds the whole demo.
export interface EventStore {
  events: EventRecord[];
  orders: OrderRecord[];
  tickets: TicketRecord[];
  outbox: ReceiptEmail[];
}

export function createEventStore(events: EventRecord[]): EventStore {
  return { events: [...events], orders: [], tickets: [], outbox: [] };
}

// Seats currently held by checkouts that are still inside their 10-minute window.
// Compared against `now` (not just the status) so a hold that has timed out stops
// counting right away, even if nothing has marked it "expired" yet.
function heldSeats(store: EventStore, eventId: string, now: Date): number {
  return store.orders
    .filter(
      (o) =>
        o.event_id === eventId &&
        o.status === "held" &&
        new Date(o.expires_at).getTime() > now.getTime(),
    )
    .reduce((total, o) => total + o.seats, 0);
}

// Seats a student could still get: capacity minus paid seats minus seats on hold.
// Clamped at 0 so bad data can never show "-4 seats left".
export function seatsRemaining(store: EventStore, event: EventRecord, now: Date = new Date()): number {
  return Math.max(0, event.capacity - event.seats_sold - heldSeats(store, event.event_id, now));
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
      seats_remaining: seatsRemaining(store, e, now),
    }));
}
