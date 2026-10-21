// Story 3: Buy tickets: the rules in src/lib/orders.ts.
// One section per acceptance criterion in docs/requirements.md. Every test name
// starts with "Story 3". A fake clock (`at(minutes)`) moves time forward so no
// test ever waits 10 real minutes.
import { describe, expect, it } from "vitest";

import { createEventStore, listUpcomingEvents, type EventRecord } from "../src/lib/events";
import {
  RECEIPT_DEADLINE_MS,
  createOrder,
  getOrder,
  isProblem,
  payOrder,
  toOrderView,
  type OrderRecord,
} from "../src/lib/orders";
import { getUserNameFromRequest, normalizeName } from "../src/lib/session";

const NOW = new Date("2026-10-06T12:00:00Z");
const at = (minutes: number, seconds = 0) => new Date(NOW.getTime() + minutes * 60_000 + seconds * 1000);

function makeEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    event_id: "evt_test",
    club_id: "club_test",
    title: "Test Event",
    starts_at: "2026-10-16T23:00:00Z",
    location: "McConomy Auditorium",
    price_cents: 800,
    capacity: 100,
    status: "published",
    seats_sold: 0,
    ...overrides,
  };
}

function makeStore(overrides: Partial<EventRecord> = {}) {
  return createEventStore([makeEvent(overrides)]);
}

// Seats a student would see left for the (only) event at a given time.
function seatsLeft(store: ReturnType<typeof makeStore>, when: Date) {
  return listUpcomingEvents(store, when)[0].seats_remaining;
}

// Start a checkout and fail the test loudly if it was refused.
function buy(store: ReturnType<typeof makeStore>, userName: string, seats: number, when: Date = NOW): OrderRecord {
  const result = createOrder(store, { userName, eventId: "evt_test", seats }, when);
  if (isProblem(result)) throw new Error(`expected checkout to start, got ${result.error}`);
  return result.order;
}

describe("Story 3: WHEN a student buys tickets, THE system SHALL cap the order at 4 seats", () => {
  it("Story 3: orders of 1, 2, 3 and 4 seats are accepted", () => {
    for (const seats of [1, 2, 3, 4]) {
      const store = makeStore();
      expect(buy(store, "Ada", seats).seats).toBe(seats);
    }
  });

  it("Story 3: an order of 5 seats is refused with a 400 and takes no seats", () => {
    const store = makeStore();
    const result = createOrder(store, { userName: "Ada", eventId: "evt_test", seats: 5 }, NOW);
    expect(isProblem(result) && result.status).toBe(400);
    expect(isProblem(result) && result.error).toBe("invalid_seats");
    expect(store.orders).toHaveLength(0);
    expect(seatsLeft(store, NOW)).toBe(100);
  });

  it("Story 3: zero, negative, fractional and non-number seat counts are refused", () => {
    const store = makeStore();
    for (const seats of [0, -1, 2.5, NaN, "3", null, undefined]) {
      const result = createOrder(store, { userName: "Ada", eventId: "evt_test", seats }, NOW);
      expect(isProblem(result) && result.status).toBe(400);
    }
    expect(store.orders).toHaveLength(0);
  });
});

describe("Story 3: WHEN a student starts checkout, THE system SHALL hold the seats for 10 minutes", () => {
  it("Story 3: starting checkout takes the seats off sale immediately", () => {
    const store = makeStore();
    buy(store, "Ada", 3);
    expect(seatsLeft(store, NOW)).toBe(97);
  });

  it("Story 3: the seats are still held at 9 minutes 59 seconds", () => {
    const store = makeStore({ capacity: 3 });
    buy(store, "Ada", 3);
    expect(seatsLeft(store, at(9, 59))).toBe(0);
    // Someone else cannot take them yet.
    const other = createOrder(store, { userName: "Grace", eventId: "evt_test", seats: 1 }, at(9, 59));
    expect(isProblem(other) && other.status).toBe(409);
  });

  it("Story 3: at 10 minutes the seats go back on sale and someone else can buy them", () => {
    const store = makeStore({ capacity: 3 });
    buy(store, "Ada", 3);
    expect(seatsLeft(store, at(10))).toBe(3);
    const other = createOrder(store, { userName: "Grace", eventId: "evt_test", seats: 3 }, at(10));
    expect(isProblem(other)).toBe(false);
  });

  it("Story 3: the order is marked expired once the hold runs out", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 2);
    const result = getOrder(store, order.order_id, "Ada", at(10));
    expect(isProblem(result) ? null : result.order.status).toBe("expired");
  });

  it("Story 3: paying after the hold expired is refused and sells nothing", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 2);
    const result = payOrder(store, order.order_id, "Ada", "approved", at(10, 1));
    expect(isProblem(result) && result.status).toBe(409);
    expect(isProblem(result) && result.error).toBe("hold_expired");
    expect(store.tickets).toHaveLength(0);
    expect(store.events[0].seats_sold).toBe(0);
    expect(store.outbox).toHaveLength(0);
  });

  it("Story 3: a student has one active hold per event, so a repeat request returns the same order", () => {
    // This is also what protects against a double-click placing two orders.
    const store = makeStore();
    const first = createOrder(store, { userName: "Ada", eventId: "evt_test", seats: 2 }, NOW);
    const second = createOrder(store, { userName: "ada", eventId: "evt_test", seats: 2 }, at(0, 1));
    expect(!isProblem(first) && first.created).toBe(true);
    expect(!isProblem(second) && second.created).toBe(false);
    expect(store.orders).toHaveLength(1);
    expect(seatsLeft(store, NOW)).toBe(98);
  });
});

describe("Story 3: WHEN a payment succeeds, THE system SHALL email a receipt with a QR code within 1 minute", () => {
  it("Story 3: an approved payment marks the order paid and counts the seats as sold", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 2);
    const result = payOrder(store, order.order_id, "Ada", "approved", at(3));
    expect(isProblem(result) ? null : result.order.status).toBe("paid");
    expect(store.events[0].seats_sold).toBe(2);
    // Still 98 left: the seats moved from "held" to "sold", they did not come back.
    expect(seatsLeft(store, at(3))).toBe(98);
    expect(seatsLeft(store, at(30))).toBe(98);
  });

  it("Story 3: one ticket is issued per seat, each with its own code", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 4);
    payOrder(store, order.order_id, "Ada", "approved", at(1));
    expect(store.tickets).toHaveLength(4);
    expect(new Set(store.tickets.map((t) => t.qr_token)).size).toBe(4);
    expect(store.tickets.every((t) => t.order_id === order.order_id && t.checked_in_at === null)).toBe(true);
  });

  it("Story 3: the receipt is sent within 1 minute of payment and lists the ticket codes", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 2);
    payOrder(store, order.order_id, "Ada", "approved", at(5));
    expect(store.outbox).toHaveLength(1);
    const receipt = store.outbox[0];
    const delay = new Date(receipt.sent_at).getTime() - at(5).getTime();
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(RECEIPT_DEADLINE_MS);
    expect(receipt.ticket_codes).toEqual(store.tickets.map((t) => t.qr_token));
    expect(receipt.subject).toContain("Test Event");
  });

  it("Story 3: ticket codes are random, at least 128 bits, unique, and contain no personal information", () => {
    const store = makeStore({ capacity: 5000 });
    const name = "Zebediah Quillfeather";
    for (let i = 0; i < 250; i++) {
      const order = buy(store, `${name} ${i}`, 4, at(0, i));
      payOrder(store, order.order_id, `${name} ${i}`, "approved", at(0, i));
    }
    const tokens = store.tickets.map((t) => t.qr_token);
    expect(tokens).toHaveLength(1000);
    expect(new Set(tokens).size).toBe(1000);
    for (const token of tokens) {
      expect(Buffer.from(token, "base64url").length).toBeGreaterThanOrEqual(16); // 16 bytes = 128 bits
      expect(token.toLowerCase()).not.toContain("zebediah");
      expect(token).not.toContain("evt_test");
    }
  });

  it("Story 3: tickets are only shown on the order once it is paid", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 2);
    expect(toOrderView(store, order, NOW).tickets).toHaveLength(0);
    payOrder(store, order.order_id, "Ada", "approved", at(1));
    const view = toOrderView(store, order, at(1));
    expect(view.status).toBe("paid");
    expect(view.tickets).toHaveLength(2);
    expect(view.receipt_sent_at).toBe(at(1).toISOString());
  });

  it("Story 3: paying twice does not issue a second set of tickets", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 2);
    payOrder(store, order.order_id, "Ada", "approved", at(1));
    const again = payOrder(store, order.order_id, "Ada", "approved", at(2));
    expect(isProblem(again) && again.status).toBe(409);
    expect(store.tickets).toHaveLength(2);
    expect(store.outbox).toHaveLength(1);
    expect(store.events[0].seats_sold).toBe(2);
  });

  it("Story 3: the total is the stored price times seats, and a free event costs $0", () => {
    const paid = makeStore({ price_cents: 1250 });
    expect(buy(paid, "Ada", 3).total_cents).toBe(3750);
    const free = makeStore({ price_cents: 0 });
    expect(buy(free, "Ada", 3).total_cents).toBe(0);
  });
});

describe("Story 3: IF a card is declined, THEN THE system SHALL release the held seats", () => {
  it("Story 3: a declined payment puts the seats straight back on sale", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 4);
    expect(seatsLeft(store, NOW)).toBe(96);
    const result = payOrder(store, order.order_id, "Ada", "declined", at(2));
    expect(isProblem(result) ? null : result.order.status).toBe("declined");
    expect(seatsLeft(store, at(2))).toBe(100);
  });

  it("Story 3: a declined payment creates no tickets, no receipt and sells nothing", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 2);
    payOrder(store, order.order_id, "Ada", "declined", at(1));
    expect(store.tickets).toHaveLength(0);
    expect(store.outbox).toHaveLength(0);
    expect(store.events[0].seats_sold).toBe(0);
  });

  it("Story 3: after a decline the student can start a new checkout", () => {
    const store = makeStore();
    const first = buy(store, "Ada", 2);
    payOrder(store, first.order_id, "Ada", "declined", at(1));
    const second = createOrder(store, { userName: "Ada", eventId: "evt_test", seats: 2 }, at(2));
    expect(!isProblem(second) && second.created).toBe(true);
  });

  it("Story 3: a declined order cannot be paid afterwards", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 2);
    payOrder(store, order.order_id, "Ada", "declined", at(1));
    const result = payOrder(store, order.order_id, "Ada", "approved", at(2));
    expect(isProblem(result) && result.status).toBe(409);
    expect(store.tickets).toHaveLength(0);
  });
});

describe("Story 3: IF the event sells out during checkout, THEN THE system SHALL offer the waitlist", () => {
  it("Story 3: asking for seats when none are left gives a 409 that offers the waitlist", () => {
    const store = makeStore({ capacity: 2 });
    buy(store, "Ada", 2);
    const result = createOrder(store, { userName: "Grace", eventId: "evt_test", seats: 1 }, at(1));
    expect(isProblem(result) && result.status).toBe(409);
    expect(isProblem(result) && result.error).toBe("sold_out");
    expect(isProblem(result) && result.offer_waitlist).toBe(true);
    expect(isProblem(result) && result.seats_remaining).toBe(0);
    expect(store.orders).toHaveLength(1); // Grace's attempt held nothing
  });

  it("Story 3: asking for more seats than remain says how many are left and still offers the waitlist", () => {
    const store = makeStore({ capacity: 10, seats_sold: 9 });
    const result = createOrder(store, { userName: "Ada", eventId: "evt_test", seats: 3 }, NOW);
    expect(isProblem(result) && result.status).toBe(409);
    expect(isProblem(result) && result.message).toContain("1 seat is left");
    expect(isProblem(result) && result.offer_waitlist).toBe(true);
  });

  it("Story 3: if the hold ran out and the seats were taken, payment fails and the waitlist is offered", () => {
    const store = makeStore({ capacity: 2 });
    const ada = buy(store, "Ada", 2);
    buy(store, "Grace", 2, at(10)); // Ada's hold ended at 10:00, Grace gets the seats
    const result = payOrder(store, ada.order_id, "Ada", "approved", at(11));
    expect(isProblem(result) && result.status).toBe(409);
    expect(isProblem(result) && result.offer_waitlist).toBe(true);
    const view = toOrderView(store, store.orders[0], at(11));
    expect(view.status).toBe("expired");
    expect(view.offer_waitlist).toBe(true);
  });

  it("Story 3: if the hold ran out but seats are still free, no waitlist is offered", () => {
    const store = makeStore();
    const ada = buy(store, "Ada", 2);
    const result = payOrder(store, ada.order_id, "Ada", "approved", at(11));
    expect(isProblem(result) && result.offer_waitlist).toBe(false);
    expect(toOrderView(store, store.orders[0], at(11)).offer_waitlist).toBe(false);
  });

  it("Story 3: a sold-out event shows 0 seats left, which is what turns Buy into Join waitlist", () => {
    const store = makeStore({ capacity: 4 });
    const order = buy(store, "Ada", 4);
    payOrder(store, order.order_id, "Ada", "approved", at(1));
    expect(seatsLeft(store, at(2))).toBe(0);
  });
});

describe("Story 3: other rules that touch buying", () => {
  it("Story 3: an unknown, cancelled or already-started event cannot be bought", () => {
    const store = createEventStore([
      makeEvent({ event_id: "cancelled", status: "cancelled" }),
      makeEvent({ event_id: "past", starts_at: "2026-09-01T23:00:00Z" }),
    ]);
    for (const eventId of ["nope", "cancelled", "past", undefined, 42]) {
      const result = createOrder(store, { userName: "Ada", eventId, seats: 1 }, NOW);
      expect(isProblem(result) && result.status).toBe(400);
    }
  });

  it("Story 3: you can read your own order (any capitalisation of your name) but not someone else's", () => {
    const store = makeStore();
    const order = buy(store, "Ada Lovelace", 1);
    expect(isProblem(getOrder(store, order.order_id, "ada lovelace", NOW))).toBe(false);
    const other = getOrder(store, order.order_id, "Grace Hopper", NOW);
    expect(isProblem(other) && other.status).toBe(403);
  });

  it("Story 3: an order id that does not exist is a 404", () => {
    const store = makeStore();
    const result = getOrder(store, "ord_nope", "Ada", NOW);
    expect(isProblem(result) && result.status).toBe(404);
  });

  it("Story 3: someone else cannot pay or decline your order", () => {
    const store = makeStore();
    const order = buy(store, "Ada", 2);
    const result = payOrder(store, order.order_id, "Grace", "approved", at(1));
    expect(isProblem(result) && result.status).toBe(403);
    expect(store.tickets).toHaveLength(0);
    expect(store.orders[0].status).toBe("held");
  });

  it("Story 3: order ids are random, not guessable counters", () => {
    const store = makeStore();
    const a = buy(store, "Ada", 1);
    const b = buy(store, "Grace", 1);
    expect(a.order_id).not.toBe(b.order_id);
    expect(a.order_id).toMatch(/^ord_[A-Za-z0-9_-]{16}$/);
  });
});

describe("Story 3: the typed name that stands in for sign-in", () => {
  it("Story 3: names are trimmed and tidied; empty, too long and control characters are rejected", () => {
    expect(normalizeName("  Ada   Lovelace ")).toBe("Ada Lovelace");
    expect(normalizeName("")).toBeNull();
    expect(normalizeName("   ")).toBeNull();
    expect(normalizeName("x".repeat(61))).toBeNull();
    expect(normalizeName("bad\u0000name")).toBeNull();
    expect(normalizeName(42)).toBeNull();
  });

  it("Story 3: the name is read from the cookie; a missing or damaged cookie means not signed in", () => {
    const withCookie = (cookie?: string) =>
      new Request("http://localhost/api/orders", { headers: cookie ? { cookie } : {} });
    expect(getUserNameFromRequest(withCookie("other=1; tt_name=Ada%20Lovelace"))).toBe("Ada Lovelace");
    expect(getUserNameFromRequest(withCookie())).toBeNull();
    expect(getUserNameFromRequest(withCookie("other=1"))).toBeNull();
    expect(getUserNameFromRequest(withCookie("tt_name="))).toBeNull();
    expect(getUserNameFromRequest(withCookie("tt_name=%E0%A4%A"))).toBeNull(); // broken %-escape
  });
});
