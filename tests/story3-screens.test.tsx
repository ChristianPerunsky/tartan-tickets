// Story 3: Buy tickets: the screens (UX spec: empty/loading/error/success states,
// Buy disabled after one click, keyboard use, colors as tokens).
// These render the screens to HTML, like the Story 1 tests. They do NOT click in a
// real browser; the "disabled after one click" rule is therefore proven in two
// halves: the screen shows a disabled button when it is waiting (here), and the
// server refuses to make a second order (tests/story3-api.test.tsx).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BuyForm, BuyFormView } from "../src/components/BuyForm";
import { EventList } from "../src/components/EventList";
import { NameBox } from "../src/components/NameBox";
import { OrderDetails } from "../src/components/OrderDetails";
import { OrderPanel } from "../src/components/OrderPanel";
import { WaitlistOffer } from "../src/components/WaitlistOffer";
import type { EventView } from "../src/lib/events";
import { formatCountdown } from "../src/lib/format";
import type { OrderView } from "../src/lib/orders";

const noop = () => {};

function makeOrder(overrides: Partial<OrderView> = {}): OrderView {
  return {
    order_id: "ord_abc",
    event_id: "evt_test",
    event_title: "Spring Gala",
    seats: 2,
    status: "held",
    total_cents: 1600,
    created_at: "2026-10-06T12:00:00.000Z",
    expires_at: "2026-10-06T12:10:00.000Z",
    paid_at: null,
    tickets: [],
    receipt_sent_at: null,
    offer_waitlist: false,
    ...overrides,
  };
}

function renderOrder(order: OrderView, extra: Partial<Parameters<typeof OrderDetails>[0]> = {}) {
  return renderToStaticMarkup(
    <OrderDetails order={order} msLeft={null} pending={false} message={null} onPay={noop} {...extra} />,
  );
}

describe("Story 3: Buy button (disabled after one click, seat picker capped at 4)", () => {
  const view = (overrides: Partial<Parameters<typeof BuyFormView>[0]> = {}) =>
    renderToStaticMarkup(
      <BuyFormView
        title="Spring Gala"
        maxSeats={4}
        seats={1}
        pending={false}
        problem={null}
        onSeatsChange={noop}
        onSubmit={noop}
        {...overrides}
      />,
    );

  it("Story 3: before any click the Buy button is enabled", () => {
    const html = view();
    expect(html).toMatch(/<button[^>]*>Buy<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>/);
  });

  it("Story 3: while the order is being placed the Buy button is disabled", () => {
    const html = view({ pending: true });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Buy<\/button>/);
    expect(html).toContain("Holding your seats");
  });

  it("Story 3: the seat picker never offers more than 4 seats, even with 100 left", () => {
    const html = renderToStaticMarkup(<BuyForm eventId="e" title="Spring Gala" seatsRemaining={100} />);
    expect(html.match(/<option/g)).toHaveLength(4);
    expect(html).not.toContain('value="5"');
  });

  it("Story 3: the seat picker never offers more seats than remain", () => {
    const html = renderToStaticMarkup(<BuyForm eventId="e" title="Spring Gala" seatsRemaining={2} />);
    expect(html.match(/<option/g)).toHaveLength(2);
  });

  it("Story 3: the seat picker has a label so screen readers can use it", () => {
    expect(view()).toMatch(/<label>Seats/);
  });

  it("Story 3: a sold-out reply shows the message and a Join waitlist button", () => {
    const html = view({ problem: { message: "Sorry, this event just sold out.", offerWaitlist: true } });
    expect(html).toContain("Sorry, this event just sold out.");
    expect(html).toContain(">Join waitlist</button>");
    expect(html).toContain('role="alert"');
  });

  it("Story 3: any other problem is announced but offers no waitlist", () => {
    const html = view({ problem: { message: "Type your name at the top of the page first.", offerWaitlist: false } });
    expect(html).toContain("Type your name at the top of the page first.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Join waitlist");
  });

  it("Story 3: the events list shows the Buy form for open events and only Join waitlist for sold-out ones", () => {
    const events: EventView[] = [
      { event_id: "open", club_id: "c", title: "Open Show", starts_at: "2026-10-16T23:00:00Z", location: "Hall", price_cents: 500, capacity: 10, seats_remaining: 3 },
      { event_id: "full", club_id: "c", title: "Full Show", starts_at: "2026-10-17T23:00:00Z", location: "Hall", price_cents: 500, capacity: 10, seats_remaining: 0 },
    ];
    const html = renderToStaticMarkup(<EventList events={events} />);
    expect(html.match(/>Buy<\/button>/g)).toHaveLength(1);
    expect(html.match(/>Join waitlist<\/button>/g)).toHaveLength(1);
  });
});

describe("Story 3: sign-in stand-in (a typed name)", () => {
  it("Story 3: the name box has a visible label, a text field, and says the name is not verified", () => {
    const html = renderToStaticMarkup(<NameBox />);
    expect(html).toContain('<label for="your-name">Your name</label>');
    expect(html).toMatch(/<input[^>]*id="your-name"[^>]*type="text"|<input[^>]*type="text"[^>]*id="your-name"/);
    expect(html).toContain("not verified");
  });
});

describe("Story 3: order page states (loading, error, success)", () => {
  it("Story 3: loading state: the order page first says it is loading, for screen readers too", () => {
    const html = renderToStaticMarkup(<OrderPanel orderId="ord_abc" />);
    expect(html).toContain("Loading your order");
    expect(html).toContain('role="status"');
  });

  it("Story 3: checkout state: summary, total, countdown and both simulated payment buttons", () => {
    const html = renderOrder(makeOrder(), { msLeft: 9 * 60_000 + 42_000 });
    expect(html).toContain("2 tickets for Spring Gala");
    expect(html).toContain("$16.00");
    expect(html).toContain("9:42");
    expect(html).toMatch(/<button[^>]*>Simulated payment<\/button>/);
    expect(html).toMatch(/<button[^>]*>Simulated decline<\/button>/);
    expect(html).toContain("no real payment");
  });

  it("Story 3: both payment buttons are disabled while a payment is being processed (no double payment)", () => {
    const html = renderOrder(makeOrder(), { pending: true });
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it("Story 3: a problem from the last click is announced", () => {
    const html = renderOrder(makeOrder(), { message: "Your 10-minute hold ran out. Please start again." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("hold ran out");
  });

  it("Story 3: success state: paid order shows the receipt, when it was sent, and every ticket code", () => {
    const html = renderOrder(
      makeOrder({
        status: "paid",
        paid_at: "2026-10-06T12:03:00.000Z",
        receipt_sent_at: "2026-10-06T12:03:00.000Z",
        tickets: [
          { ticket_id: "t1", qr_token: "CODE-ONE" },
          { ticket_id: "t2", qr_token: "CODE-TWO" },
        ],
      }),
    );
    expect(html).toContain("Payment received");
    expect(html).toContain("Receipt: 2 tickets for Spring Gala, total $16.00");
    expect(html).toContain("Receipt sent");
    expect(html).toContain("CODE-ONE");
    expect(html).toContain("CODE-TWO");
    expect(html).not.toContain("Simulated payment"); // nothing left to pay
  });

  it("Story 3: a free event's receipt shows Free", () => {
    const html = renderOrder(makeOrder({ status: "paid", total_cents: 0 }));
    expect(html).toContain("total Free");
  });

  it("Story 3: declined state: tells the student the seats were released and they were not charged", () => {
    const html = renderOrder(makeOrder({ status: "declined" }));
    expect(html).toContain("Card declined");
    expect(html).toContain("not charged");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Back to events");
  });

  it("Story 3: expired state without a sell-out: seats released, no waitlist button", () => {
    const html = renderOrder(makeOrder({ status: "expired", offer_waitlist: false }));
    expect(html).toContain("Hold expired");
    expect(html).not.toContain("Join waitlist");
  });

  it("Story 3: expired state after a sell-out: the waitlist is offered", () => {
    const html = renderOrder(makeOrder({ status: "expired", offer_waitlist: true }));
    expect(html).toContain("Hold expired");
    expect(html).toContain(">Join waitlist</button>");
  });

  it("Story 3: event text is shown as plain text, so a script tag cannot run (SEC-20)", () => {
    const html = renderOrder(makeOrder({ event_title: "<script>alert('x')</script>" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    const offer = renderToStaticMarkup(<WaitlistOffer message="<img src=x onerror=alert(1)>" title="t" />);
    expect(offer).not.toContain("<img");
  });

  it("Story 3: the countdown reads minutes:seconds and never goes below 0:00", () => {
    expect(formatCountdown(10 * 60_000)).toBe("10:00");
    expect(formatCountdown(9 * 60_000 + 42_000)).toBe("9:42");
    expect(formatCountdown(5_000)).toBe("0:05");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-3_000)).toBe("0:00");
  });
});

describe("Story 3: accessibility (UX spec)", () => {
  const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");

  it("Story 3: the new styles only use the named color tokens, never raw colors", () => {
    // Everything after the :root block must reference var(--ink|accent|surface|line),
    // so the contrast checks in the Story 1 tests cover the new screens too.
    const afterRoot = css.slice(css.indexOf("}", css.indexOf(":root")) + 1);
    expect(afterRoot).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(afterRoot).not.toMatch(/\brgba?\(/);
  });

  it("Story 3: everything clickable is a real button, link or form field, in a sensible tab order", () => {
    const html = renderOrder(makeOrder());
    expect(html).not.toMatch(/tabindex="[1-9]/i);
    expect(html).not.toMatch(/<div[^>]*onclick/i);
    expect(html.match(/<button/g)).toHaveLength(2);
  });
});
