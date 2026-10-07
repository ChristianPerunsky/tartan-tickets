// Story 1: Browse events: the GET /api/events contract and the home page.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { GET } from "../src/app/api/events/route";
import Page from "../src/app/page";

describe("Story 1: GET /api/events (API contract: 200)", () => {
  it("Story 1: returns 200 with a JSON list of events", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBeGreaterThan(0);
  });

  it("Story 1: every event has the fields a student needs and only upcoming events appear", async () => {
    const { events } = await (await GET()).json();
    for (const e of events) {
      expect(e).toEqual(
        expect.objectContaining({
          event_id: expect.any(String),
          title: expect.any(String),
          starts_at: expect.any(String),
          location: expect.any(String),
          price_cents: expect.any(Number),
          seats_remaining: expect.any(Number),
        }),
      );
      expect(new Date(e.starts_at).getTime()).toBeGreaterThan(Date.now());
      expect(e.seats_remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it("Story 1: does not expose internal bookkeeping fields", async () => {
    const { events } = await (await GET()).json();
    for (const e of events) {
      expect(e).not.toHaveProperty("seats_sold");
      expect(e).not.toHaveProperty("status");
    }
  });

  it("Story 1: the demo data includes a sold-out event so the waitlist button can be seen", async () => {
    const { events } = await (await GET()).json();
    expect(events.some((e: { seats_remaining: number }) => e.seats_remaining === 0)).toBe(true);
    expect(events.some((e: { seats_remaining: number }) => e.seats_remaining > 0)).toBe(true);
  });
});

describe("Story 1: home page", () => {
  it("Story 1: renders the event list with both Buy and Join waitlist buttons from the demo data", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Upcoming events");
    expect(html).toContain(">Buy</button>");
    expect(html).toContain(">Join waitlist</button>");
  });
});
