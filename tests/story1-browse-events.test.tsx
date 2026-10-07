// Story 1: Browse events
// Each acceptance criterion in docs/requirements.md (Story 1 and the UX spec)
// has at least one test here, and every test name starts with "Story 1".
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createEventStore,
  listUpcomingEvents,
  type EventRecord,
} from "../src/lib/events";
import { formatEventDate, formatPrice, formatSeats } from "../src/lib/format";
import { EventList, ErrorState, LoadingState } from "../src/components/EventList";

// A fixed "now" so the tests never depend on the real clock.
const NOW = new Date("2026-10-06T12:00:00Z");

// Small helper: build a valid event record, overriding only what a test cares about.
function makeEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    event_id: "evt_test",
    club_id: "club_test",
    title: "Test Event",
    starts_at: "2026-10-16T23:00:00Z", // 7:00 PM Pittsburgh time
    location: "McConomy Auditorium",
    price_cents: 500,
    capacity: 100,
    status: "published",
    seats_sold: 0,
    ...overrides,
  };
}

// Run the full pipeline the page uses: store -> upcoming list -> HTML.
function renderEvents(records: EventRecord[]): string {
  const events = listUpcomingEvents(createEventStore(records), NOW);
  return renderToStaticMarkup(<EventList events={events} />);
}

describe("Story 1: THE system SHALL list upcoming events with date, location, price, seats remaining", () => {
  it("Story 1: shows the date, location, price and seats remaining for an event", () => {
    const html = renderEvents([
      makeEvent({ title: "Spring Gala", price_cents: 1250, capacity: 100, seats_sold: 58 }),
    ]);
    expect(html).toContain("Spring Gala");
    expect(html).toContain("Fri, Oct 16, 7:00 PM"); // date + time in Pittsburgh time
    expect(html).toContain("McConomy Auditorium");
    expect(html).toContain("$12.50");
    expect(html).toContain("42 seats left");
  });

  it("Story 1: lists only upcoming events, soonest first", () => {
    const events = listUpcomingEvents(
      createEventStore([
        makeEvent({ event_id: "late", title: "Late", starts_at: "2026-11-20T23:00:00Z" }),
        makeEvent({ event_id: "past", title: "Past", starts_at: "2026-09-01T23:00:00Z" }),
        makeEvent({ event_id: "soon", title: "Soon", starts_at: "2026-10-10T23:00:00Z" }),
      ]),
      NOW,
    );
    expect(events.map((e) => e.event_id)).toEqual(["soon", "late"]);
  });

  it("Story 1: does not list cancelled events", () => {
    const events = listUpcomingEvents(
      createEventStore([
        makeEvent({ event_id: "ok" }),
        makeEvent({ event_id: "cancelled", status: "cancelled" }),
      ]),
      NOW,
    );
    expect(events.map((e) => e.event_id)).toEqual(["ok"]);
  });

  it("Story 1: seats remaining is capacity minus seats sold, and never negative", () => {
    const [normal, oversold] = listUpcomingEvents(
      createEventStore([
        makeEvent({ event_id: "a", capacity: 50, seats_sold: 12, starts_at: "2026-10-10T23:00:00Z" }),
        makeEvent({ event_id: "b", capacity: 10, seats_sold: 14, starts_at: "2026-10-11T23:00:00Z" }),
      ]),
      NOW,
    );
    expect(normal.seats_remaining).toBe(38);
    expect(oversold.seats_remaining).toBe(0);
  });

  it("Story 1: formats a free event as Free and singular seats as '1 seat left'", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(500)).toBe("$5.00");
    expect(formatSeats(1)).toBe("1 seat left");
    expect(formatSeats(2)).toBe("2 seats left");
    expect(formatSeats(0)).toBe("Sold out");
  });

  it("Story 1: shows event times in Pittsburgh time, not the server's time zone", () => {
    // 2026-12-05 00:30 UTC is still the evening of Dec 4 in Pittsburgh (EST, UTC-5).
    expect(formatEventDate("2026-12-05T00:30:00Z")).toBe("Fri, Dec 4, 7:30 PM");
  });
});

describe("Story 1: WHILE an event is sold out, THE system SHALL show 'Join waitlist' instead of 'Buy'", () => {
  it("Story 1: an event with seats left shows a Buy button and no waitlist button", () => {
    const html = renderEvents([makeEvent({ capacity: 10, seats_sold: 3 })]);
    expect(html).toMatch(/<button[^>]*>Buy<\/button>/);
    expect(html).not.toContain("Join waitlist");
  });

  it("Story 1: a sold-out event shows 'Join waitlist' and no Buy button", () => {
    const html = renderEvents([makeEvent({ capacity: 10, seats_sold: 10 })]);
    expect(html).toMatch(/<button[^>]*>Join waitlist<\/button>/);
    expect(html).toContain("Sold out");
    expect(html).not.toMatch(/<button[^>]*>Buy<\/button>/);
  });

  it("Story 1: each event gets its own button, so one sold-out event does not affect another", () => {
    const html = renderEvents([
      makeEvent({ event_id: "open", title: "Open Show", capacity: 10, seats_sold: 0 }),
      makeEvent({ event_id: "full", title: "Full Show", capacity: 10, seats_sold: 10 }),
    ]);
    expect(html.match(/>Buy<\/button>/g)).toHaveLength(1);
    expect(html.match(/>Join waitlist<\/button>/g)).toHaveLength(1);
  });
});

describe("Story 1: UX states (empty, loading, error, success)", () => {
  it("Story 1: empty state reads 'No upcoming events yet.'", () => {
    expect(renderEvents([])).toContain("No upcoming events yet.");
    // A list of only past events is also "empty" from the student's point of view.
    expect(renderEvents([makeEvent({ starts_at: "2026-01-01T00:00:00Z" })])).toContain(
      "No upcoming events yet.",
    );
  });

  it("Story 1: success state does not show the empty message", () => {
    expect(renderEvents([makeEvent()])).not.toContain("No upcoming events yet.");
  });

  it("Story 1: loading state tells screen readers that content is loading", () => {
    const html = renderToStaticMarkup(<LoadingState />);
    expect(html).toContain("Loading events");
    expect(html).toContain('role="status"');
  });

  it("Story 1: error state is announced, offers a retry, and leaks no technical details", () => {
    const html = renderToStaticMarkup(<ErrorState onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again");
    expect(html).not.toMatch(/stack|undefined|TypeError|ECONN/i);
  });
});

describe("Story 1: accessibility (UX spec)", () => {
  const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");

  // Read a CSS custom property such as --ink: #1a1a2e; out of globals.css.
  function token(name: string): string {
    const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!match) throw new Error(`Design token --${name} is missing from globals.css`);
    return match[1];
  }

  // WCAG 2.x relative luminance and contrast ratio.
  function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  it("Story 1: colors are named tokens (ink, accent, surface)", () => {
    for (const name of ["ink", "accent", "surface"]) {
      expect(() => token(name)).not.toThrow();
    }
  });

  it("Story 1: every text/background color pair has contrast of at least 4.5:1", () => {
    const ink = token("ink");
    const accent = token("accent");
    const surface = token("surface");
    expect(contrast(ink, surface)).toBeGreaterThanOrEqual(4.5); // body text
    expect(contrast(surface, accent)).toBeGreaterThanOrEqual(4.5); // button label on accent
    expect(contrast(accent, surface)).toBeGreaterThanOrEqual(4.5); // accent used as text
  });

  it("Story 1: the app is keyboard usable: real buttons and a visible focus style", () => {
    const html = renderEvents([
      makeEvent({ event_id: "a", capacity: 5, seats_sold: 0 }),
      makeEvent({ event_id: "b", capacity: 5, seats_sold: 5 }),
    ]);
    expect(html).toContain("<button"); // native buttons are keyboard-focusable
    expect(html).not.toMatch(/tabindex="[1-9]/i); // no positive tabindex that scrambles tab order
    expect(css).toContain(":focus-visible");
  });
});

describe("Story 1: security (SEC-20) officer-entered text is shown as plain text", () => {
  it("Story 1: a <script> tag in an event title is displayed as text, not run", () => {
    const html = renderEvents([
      makeEvent({ title: "<script>alert('x')</script>", location: "<img src=x onerror=alert(1)>" }),
    ]);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});
