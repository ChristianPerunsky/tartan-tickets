// Story 3: Buy tickets. All the rules live here as plain functions so they can be
// tested without a web server. Every function takes `now` so tests can move the
// clock (for example 10 minutes ahead) instead of waiting.
//
// JavaScript runs one request at a time inside these functions (no `await`
// between "check seats" and "hold seats"), so two buyers can never both grab the
// last seat.
import { randomBytes } from "node:crypto";

import { seatsRemaining, type EventRecord, type EventStore } from "./events";
import { HOLD_MS, MAX_SEATS_PER_ORDER } from "./rules";
import { userIdFromName } from "./session";

export { HOLD_MS, MAX_SEATS_PER_ORDER, RECEIPT_DEADLINE_MS } from "./rules";

export type OrderStatus = "held" | "paid" | "declined" | "expired";

// Matches the `orders` table in docs/requirements.md, plus what the demo needs.
export interface OrderRecord {
  order_id: string;
  user_id: string; // lowercase typed name
  user_name: string; // name as typed
  event_id: string;
  seats: number;
  status: OrderStatus;
  total_cents: number; // always computed on the server, never taken from the browser
  created_at: string; // ISO 8601
  expires_at: string; // end of the 10-minute hold
  paid_at: string | null;
}

// Matches the `tickets` table. qr_token is the text a QR code would carry.
export interface TicketRecord {
  ticket_id: string;
  order_id: string;
  qr_token: string;
  checked_in_at: string | null;
}

// Demo stand-in for the receipt email: no real email is sent (we only have a typed
// name, not an address), so each "sent" receipt is recorded here instead.
export interface ReceiptEmail {
  order_id: string;
  to: string;
  subject: string;
  ticket_codes: string[];
  sent_at: string;
}

// What the API returns for an order.
export interface OrderView {
  order_id: string;
  event_id: string;
  event_title: string;
  seats: number;
  status: OrderStatus;
  total_cents: number;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  tickets: { ticket_id: string; qr_token: string }[]; // only filled once paid
  receipt_sent_at: string | null;
  // True when the hold ran out AND the event no longer has enough seats, so the
  // student should be offered the waitlist.
  offer_waitlist: boolean;
}

export interface Problem {
  ok: false;
  status: 400 | 403 | 404 | 409;
  error: string;
  message: string;
  // Present on sold-out style failures so the screen can offer the waitlist.
  offer_waitlist?: boolean;
  event_id?: string;
  seats_remaining?: number;
}

// True when a result is a failure. An explicit check like this lets TypeScript tell
// the two result shapes apart even with this project's non-strict settings.
export function isProblem(result: { ok: boolean }): result is Problem {
  return !result.ok;
}

function problem(p: Omit<Problem, "ok">): Problem {
  return { ok: false, ...p };
}

// Random, unguessable id/token. 24 bytes = 192 bits, no personal information in it.
function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

// Mark every hold whose 10 minutes are up as expired. Called at the start of each
// operation, so there is no background timer to manage.
export function releaseExpiredHolds(store: EventStore, now: Date): void {
  for (const order of store.orders) {
    if (order.status === "held" && new Date(order.expires_at).getTime() <= now.getTime()) {
      order.status = "expired";
    }
  }
}

function findEvent(store: EventStore, eventId: string): EventRecord | undefined {
  return store.events.find((e) => e.event_id === eventId);
}

// ---- Start checkout -------------------------------------------------------

export type CreateOrderResult =
  | { ok: true; created: boolean; order: OrderRecord }
  | Problem;

export function createOrder(
  store: EventStore,
  input: { userName: string; eventId: unknown; seats: unknown },
  now: Date = new Date(),
): CreateOrderResult {
  releaseExpiredHolds(store, now);

  // Whole numbers 1..4 only. Checked here on the server, so editing the page
  // in the browser cannot get around the cap.
  const seats = input.seats;
  if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS_PER_ORDER) {
    return problem({
      status: 400,
      error: "invalid_seats",
      message: `You can buy between 1 and ${MAX_SEATS_PER_ORDER} tickets per order.`,
    });
  }

  const event = typeof input.eventId === "string" ? findEvent(store, input.eventId) : undefined;
  if (
    !event ||
    event.status !== "published" ||
    new Date(event.starts_at).getTime() <= now.getTime()
  ) {
    return problem({ status: 400, error: "invalid_event", message: "That event is not available." });
  }

  // A student gets one active hold per event. A second request (for example from a
  // double-click) returns the hold they already have instead of taking more seats.
  const userId = userIdFromName(input.userName);
  const existing = store.orders.find(
    (o) => o.user_id === userId && o.event_id === event.event_id && o.status === "held",
  );
  if (existing) return { ok: true, created: false, order: existing };

  const remaining = seatsRemaining(store, event, now);
  if (seats > remaining) {
    return problem({
      status: 409,
      error: "sold_out",
      message:
        remaining === 0
          ? "Sorry, this event just sold out."
          : `Sorry, only ${remaining} ${remaining === 1 ? "seat is" : "seats are"} left.`,
      offer_waitlist: true,
      event_id: event.event_id,
      seats_remaining: remaining,
    });
  }

  const order: OrderRecord = {
    order_id: `ord_${randomToken(12)}`,
    user_id: userId,
    user_name: input.userName,
    event_id: event.event_id,
    seats,
    status: "held",
    total_cents: event.price_cents * seats, // price comes from the stored event only
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + HOLD_MS).toISOString(),
    paid_at: null,
  };
  store.orders.push(order);
  return { ok: true, created: true, order };
}

// ---- Read an order --------------------------------------------------------

export type GetOrderResult = { ok: true; order: OrderRecord } | Problem;

// Find an order and check it belongs to the person asking.
function findOwnedOrder(store: EventStore, orderId: string, userName: string): GetOrderResult {
  const order = store.orders.find((o) => o.order_id === orderId);
  if (!order) {
    return problem({ status: 404, error: "not_found", message: "We could not find that order." });
  }
  if (order.user_id !== userIdFromName(userName)) {
    return problem({ status: 403, error: "forbidden", message: "That order belongs to someone else." });
  }
  return { ok: true, order };
}

export function getOrder(
  store: EventStore,
  orderId: string,
  userName: string,
  now: Date = new Date(),
): GetOrderResult {
  releaseExpiredHolds(store, now);
  return findOwnedOrder(store, orderId, userName);
}

// ---- Pay (simulated) ------------------------------------------------------

export type PaymentOutcome = "approved" | "declined";

export function payOrder(
  store: EventStore,
  orderId: string,
  userName: string,
  outcome: PaymentOutcome,
  now: Date = new Date(),
): GetOrderResult {
  releaseExpiredHolds(store, now);
  const found = findOwnedOrder(store, orderId, userName);
  if (!found.ok) return found;
  const order = found.order;
  const event = findEvent(store, order.event_id)!;

  if (order.status === "expired") {
    // The hold ran out before payment. If someone else took the seats meanwhile,
    // say so and offer the waitlist.
    const sellsOut = seatsRemaining(store, event, now) < order.seats;
    return problem({
      status: 409,
      error: "hold_expired",
      message: sellsOut
        ? "Your 10-minute hold ran out and the seats are gone."
        : "Your 10-minute hold ran out. Please start again.",
      offer_waitlist: sellsOut,
      event_id: order.event_id,
    });
  }
  if (order.status !== "held") {
    return problem({
      status: 409,
      error: "already_finished",
      message: `This order is already ${order.status}.`,
    });
  }

  if (outcome === "declined") {
    // Changing the status is all it takes: held seats are counted only for
    // "held" orders, so the seats go back on sale immediately.
    order.status = "declined";
    return { ok: true, order };
  }

  order.status = "paid";
  order.paid_at = now.toISOString();
  event.seats_sold += order.seats;

  // One ticket per seat, each with its own random code.
  const codes: string[] = [];
  for (let i = 0; i < order.seats; i++) {
    const ticket: TicketRecord = {
      ticket_id: `tkt_${randomToken(12)}`,
      order_id: order.order_id,
      qr_token: randomToken(),
      checked_in_at: null,
    };
    store.tickets.push(ticket);
    codes.push(ticket.qr_token);
  }

  // Receipt goes out immediately (well inside the 1-minute requirement).
  store.outbox.push({
    order_id: order.order_id,
    to: order.user_name,
    subject: `Your tickets for ${event.title}`,
    ticket_codes: codes,
    sent_at: now.toISOString(),
  });
  return { ok: true, order };
}

// ---- Shape an order for the API / screen ----------------------------------

export function toOrderView(store: EventStore, order: OrderRecord, now: Date = new Date()): OrderView {
  const event = findEvent(store, order.event_id)!;
  const paid = order.status === "paid";
  const receipt = store.outbox.find((r) => r.order_id === order.order_id);
  return {
    order_id: order.order_id,
    event_id: order.event_id,
    event_title: event.title,
    seats: order.seats,
    status: order.status,
    total_cents: order.total_cents,
    created_at: order.created_at,
    expires_at: order.expires_at,
    paid_at: order.paid_at,
    tickets: paid
      ? store.tickets
          .filter((t) => t.order_id === order.order_id)
          .map((t) => ({ ticket_id: t.ticket_id, qr_token: t.qr_token }))
      : [],
    receipt_sent_at: receipt ? receipt.sent_at : null,
    offer_waitlist: order.status === "expired" && seatsRemaining(store, event, now) < order.seats,
  };
}
