// Story 3: Buy tickets: the HTTP API (POST /api/orders, GET /api/orders/{id},
// POST /api/orders/{id}/payment) exactly as a browser would call it, including the
// security and concurrency tests from docs/requirements.md sections 7 and 8.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { GET as listEvents } from "../src/app/api/events/route";
import { POST as createOrder } from "../src/app/api/orders/route";
import { GET as getOrder } from "../src/app/api/orders/[id]/route";
import { POST as pay } from "../src/app/api/orders/[id]/payment/route";
import Page from "../src/app/page";
import type { EventRecord } from "../src/lib/events";
import { getEventStore, resetEventStore } from "../src/lib/store";

const NOW = new Date("2026-10-06T12:00:00Z");

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

// ---- tiny helpers that build requests like a browser with a typed name ----

function cookieFor(name?: string): Record<string, string> {
  return name ? { cookie: `tt_name=${encodeURIComponent(name)}` } : {};
}

function post(url: string, name: string | undefined, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...cookieFor(name) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function get(url: string, name?: string) {
  return new Request(`http://localhost${url}`, { headers: cookieFor(name) });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const buyAs = (name: string | undefined, seats: unknown, eventId = "evt_test") =>
  createOrder(post("/api/orders", name, { event_id: eventId, seats }));
const readAs = (name: string | undefined, id: string) => getOrder(get(`/api/orders/${id}`, name), ctx(id));
const payAs = (name: string | undefined, id: string, outcome: unknown) =>
  pay(post(`/api/orders/${id}/payment`, name, { outcome }), ctx(id));

async function startOrder(name: string, seats: number) {
  const res = await buyAs(name, seats);
  expect(res.status).toBe(201);
  return (await res.json()).order as { order_id: string; total_cents: number; status: string };
}

async function seatsShown(eventId = "evt_test"): Promise<number | undefined> {
  const { events } = await (await listEvents()).json();
  return events.find((e: { event_id: string }) => e.event_id === eventId)?.seats_remaining;
}

// Freeze "now" (only the clock, so promises still run) and start with a clean store.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetEventStore([makeEvent()]);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Story 3: POST /api/orders (API contract: 201, 400, 401, 409)", () => {
  it("Story 3: 201 with a held order when a signed-in student buys 1 to 4 seats", async () => {
    const res = await buyAs("Ada", 2);
    expect(res.status).toBe(201);
    const { order } = await res.json();
    expect(order).toEqual(
      expect.objectContaining({
        status: "held",
        seats: 2,
        event_id: "evt_test",
        total_cents: 1600,
        expires_at: "2026-10-06T12:10:00.000Z", // exactly 10 minutes after the order
      }),
    );
    expect(order.tickets).toEqual([]);
  });

  it("Story 3: 400 when the order is over the 4-seat cap, and nothing is held", async () => {
    const res = await buyAs("Ada", 5);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_seats");
    expect(await seatsShown()).toBe(100);
  });

  it("Story 3: 400 for a missing seat count, a text seat count, an unknown event and a body that is not JSON", async () => {
    expect((await createOrder(post("/api/orders", "Ada", { event_id: "evt_test" }))).status).toBe(400);
    expect((await buyAs("Ada", "2")).status).toBe(400);
    expect((await buyAs("Ada", 1, "evt_nope")).status).toBe(400);
    expect((await createOrder(post("/api/orders", "Ada", "not json at all"))).status).toBe(400);
    expect(getEventStore().orders).toHaveLength(0);
  });

  it("Story 3: 401 when no name has been typed, and nothing is held", async () => {
    expect((await buyAs(undefined, 1)).status).toBe(401);
    const blank = new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "tt_name=" },
      body: JSON.stringify({ event_id: "evt_test", seats: 1 }),
    });
    expect((await createOrder(blank)).status).toBe(401);
    expect(getEventStore().orders).toHaveLength(0);
  });

  it("Story 3: 409 with a waitlist offer when the event has sold out", async () => {
    resetEventStore([makeEvent({ capacity: 2 })]);
    await startOrder("Ada", 2);
    const res = await buyAs("Grace", 1);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("sold_out");
    expect(body.offer_waitlist).toBe(true);
  });

  it("Story 3: a repeated request from the same student (double-click) returns the same order, not a second one", async () => {
    const first = await buyAs("Ada", 2);
    const second = await buyAs("Ada", 2);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).order.order_id).toBe((await first.json()).order.order_id);
    expect(getEventStore().orders).toHaveLength(1);
    expect(await seatsShown()).toBe(98);
  });
});

describe("Story 3: the server decides the price (SEC-8)", () => {
  it("Story 3: a price or total sent by the browser is ignored", async () => {
    const res = await createOrder(
      post("/api/orders", "Ada", {
        event_id: "evt_test",
        seats: 2,
        price_cents: 1,
        total_cents: 1,
        price: 0,
        amount: 0,
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).order.total_cents).toBe(1600); // 2 x the stored $8.00
  });
});

describe("Story 3: GET /api/orders/{id} (API contract: 200, 403, 404) and reading other people's orders", () => {
  it("Story 3: 200 for your own order", async () => {
    const { order_id } = await startOrder("Ada", 2);
    const res = await readAs("Ada", order_id);
    expect(res.status).toBe(200);
    expect((await res.json()).order.order_id).toBe(order_id);
  });

  it("Story 3: 403 when another student asks for it, and the answer reveals nothing about the order", async () => {
    const { order_id } = await startOrder("Ada Lovelace", 2);
    const res = await readAs("Grace Hopper", order_id);
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).not.toContain("Ada");
    expect(text).not.toContain("Test Event");
    expect(text).not.toContain(order_id);
  });

  it("Story 3: 404 for an order id that does not exist", async () => {
    expect((await readAs("Ada", "ord_doesnotexist")).status).toBe(404);
  });

  it("Story 3: 401 when no name has been typed", async () => {
    const { order_id } = await startOrder("Ada", 1);
    expect((await readAs(undefined, order_id)).status).toBe(401);
  });

  it("Story 3: another student cannot pay or decline your order either", async () => {
    const { order_id } = await startOrder("Ada", 2);
    expect((await payAs("Grace", order_id, "approved")).status).toBe(403);
    expect((await payAs("Grace", order_id, "declined")).status).toBe(403);
    expect(getEventStore().orders[0].status).toBe("held");
    expect(getEventStore().tickets).toHaveLength(0);
  });
});

describe("Story 3: WHEN a payment succeeds / IF a card is declined (simulated payment, via the API)", () => {
  it("Story 3: approved payment returns 200, a paid order, one ticket per seat, and a receipt", async () => {
    const { order_id } = await startOrder("Ada", 3);
    const res = await payAs("Ada", order_id, "approved");
    expect(res.status).toBe(200);
    const { order } = await res.json();
    expect(order.status).toBe("paid");
    expect(order.tickets).toHaveLength(3);
    expect(order.receipt_sent_at).toBe(NOW.toISOString());
    expect(getEventStore().outbox).toHaveLength(1);
    // The ticket codes also show up when the order is read again later.
    const again = await (await readAs("Ada", order_id)).json();
    expect(again.order.tickets).toHaveLength(3);
  });

  it("Story 3: declined payment returns 200, a declined order, and the seats are back on the events list", async () => {
    const { order_id } = await startOrder("Ada", 4);
    expect(await seatsShown()).toBe(96);
    const res = await payAs("Ada", order_id, "declined");
    expect(res.status).toBe(200);
    expect((await res.json()).order.status).toBe("declined");
    expect(await seatsShown()).toBe(100);
    expect(getEventStore().tickets).toHaveLength(0);
  });

  it("Story 3: 400 when the outcome is not approved or declined", async () => {
    const { order_id } = await startOrder("Ada", 1);
    expect((await payAs("Ada", order_id, "free-money")).status).toBe(400);
    expect((await payAs("Ada", order_id, undefined)).status).toBe(400);
    expect(getEventStore().orders[0].status).toBe("held");
  });

  it("Story 3: 401 when no name has been typed", async () => {
    const { order_id } = await startOrder("Ada", 1);
    expect((await payAs(undefined, order_id, "approved")).status).toBe(401);
  });

  it("Story 3: 409 when the order has already been paid", async () => {
    const { order_id } = await startOrder("Ada", 1);
    await payAs("Ada", order_id, "approved");
    const again = await payAs("Ada", order_id, "approved");
    expect(again.status).toBe(409);
    expect(getEventStore().tickets).toHaveLength(1);
  });
});

describe("Story 3: the 10-minute hold, end to end", () => {
  it("Story 3: held at 9:59, released at 10:00, and paying after that is refused", async () => {
    resetEventStore([makeEvent({ capacity: 5 })]);
    const { order_id } = await startOrder("Ada", 4);
    expect(await seatsShown()).toBe(1);

    vi.setSystemTime(new Date(NOW.getTime() + 9 * 60_000 + 59_000));
    expect(await seatsShown()).toBe(1);
    expect((await (await readAs("Ada", order_id)).json()).order.status).toBe("held");

    vi.setSystemTime(new Date(NOW.getTime() + 10 * 60_000));
    expect(await seatsShown()).toBe(5);
    expect((await (await readAs("Ada", order_id)).json()).order.status).toBe("expired");

    const late = await payAs("Ada", order_id, "approved");
    expect(late.status).toBe(409);
    expect((await late.json()).error).toBe("hold_expired");
    expect(getEventStore().tickets).toHaveLength(0);
  });

  it("Story 3: when the hold ran out and the seats were taken, the answer offers the waitlist", async () => {
    resetEventStore([makeEvent({ capacity: 2 })]);
    const { order_id } = await startOrder("Ada", 2);
    vi.setSystemTime(new Date(NOW.getTime() + 10 * 60_000));
    await startOrder("Grace", 2);
    const late = await payAs("Ada", order_id, "approved");
    expect(late.status).toBe(409);
    expect((await late.json()).offer_waitlist).toBe(true);
  });
});

describe("Story 3: concurrency: no event is ever oversold", () => {
  it("Story 3: 50 simultaneous buyers for the last seat give exactly 1 success", async () => {
    resetEventStore([makeEvent({ capacity: 10, seats_sold: 9 })]); // one seat left
    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, i) => buyAs(`Buyer ${i}`, 1)),
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(49);
    expect(getEventStore().orders).toHaveLength(1);
    expect(await seatsShown()).toBe(0);
  });

  it("Story 3: 50 simultaneous buyers wanting 2 seats each with 5 left never hold more than 5", async () => {
    resetEventStore([makeEvent({ capacity: 5 })]);
    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, i) => buyAs(`Buyer ${i}`, 2)),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(2); // 2 + 2 = 4 of 5 seats
    expect(responses.filter((r) => r.status === 409)).toHaveLength(48);
    expect(await seatsShown()).toBe(1);
  });

  it("Story 3: 50 simultaneous requests from one student still make only one order", async () => {
    const responses = await Promise.all(Array.from({ length: 50 }, () => buyAs("Ada", 2)));
    expect(responses.every((r) => r.ok)).toBe(true);
    expect(getEventStore().orders).toHaveLength(1);
    expect(await seatsShown()).toBe(98);
  });

  it("Story 3: 50 simultaneous payments of one order issue exactly one set of tickets", async () => {
    const { order_id } = await startOrder("Ada", 2);
    const responses = await Promise.all(Array.from({ length: 50 }, () => payAs("Ada", order_id, "approved")));
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(getEventStore().tickets).toHaveLength(2);
    expect(getEventStore().outbox).toHaveLength(1);
    expect(getEventStore().events[0].seats_sold).toBe(2);
  });
});

describe("Story 3: Story 1 keeps working with real orders", () => {
  it("Story 3: GET /api/events shows fewer seats after a purchase and stays accurate after payment", async () => {
    const { order_id } = await startOrder("Ada", 3);
    expect(await seatsShown()).toBe(97);
    await payAs("Ada", order_id, "approved");
    expect(await seatsShown()).toBe(97);
  });

  it("Story 3: the home page flips from Buy to Join waitlist once the last seat is sold", async () => {
    resetEventStore([makeEvent({ capacity: 1 })]);
    let html = renderToStaticMarkup(await Page());
    expect(html).toMatch(/<button[^>]*>Buy<\/button>/);
    await startOrder("Ada", 1);
    html = renderToStaticMarkup(await Page());
    expect(html).toContain(">Join waitlist</button>");
    expect(html).not.toMatch(/<button[^>]*>Buy<\/button>/);
  });
});
