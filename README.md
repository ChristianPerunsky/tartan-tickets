# Tartan Tickets

A small web app where students browse club events and buy tickets. This is a
**demo build** of Stories 1 (browse events) and 3 (buy tickets) from
[the requirements](docs/Starter%20Spec%20A%20-%20Tartan%20Tickets%20-%20requirements.md).

## Run it

```bash
npm install        # first time only
npm run dev        # then open http://localhost:3000
npm test           # run all automated tests
```

1. Type a name in the **Your name** box (any name works).
2. Pick 1 to 4 seats and press **Buy**. Your seats are held for 10 minutes.
3. On the checkout page press **Simulated payment** (success: you get ticket codes
   and a receipt) or **Simulated decline** (the card is "declined" and the seats go
   back on sale).

## Non-goals (what this demo deliberately does NOT do)

- **No real payments.** There is no Stripe and no card entry. The "Simulated
  payment" and "Simulated decline" buttons stand in for the payment provider.
- **No real authentication.** There is no university sign-in and no password.
  "Signed in" just means a name typed into a text box, saved in a cookie. Anyone
  can type anyone's name, so this must never hold real data.
- **No database.** All data (events, orders, tickets) lives in the server's memory.
  **It resets every time the server restarts or is deployed.**

Also not included in this build:

- **No real email.** The receipt is shown on screen and recorded in an in-memory
  "outbox" (we only have a typed name, not an email address).
- **No drawn QR image.** Each ticket shows its unique code as text; that code is
  what a QR image would carry. Drawing the image (and the door scanner, Story 6)
  comes later.
- **Join waitlist does nothing yet.** It appears where the spec says it should
  (sold-out events, and when seats run out during checkout), but the waitlist
  itself is Story 4.
- Stories 2 (real sign-in), 4 (waitlist), 5 (officer tools) and 6 (check-in) are
  not built. Rate limits, data deletion and Stripe webhooks are not built either.

## How buying works (Story 3)

| Rule from the spec | How it works here |
|---|---|
| Cap the order at 4 seats | The server refuses anything outside 1 to 4 (HTTP 400). The seat picker also stops at 4. |
| Hold seats for 10 minutes | Starting checkout takes the seats off sale at once. Expired holds are released the next time anyone asks. |
| Receipt with QR code within 1 minute | Sent the moment a payment succeeds (demo: on screen and in the outbox). |
| Declined card releases the seats | "Simulated decline" frees the seats immediately. |
| Sells out during checkout, offer the waitlist | The reply says to offer the waitlist and the screen shows a "Join waitlist" button. |

Extra rules worth knowing:

- A student has **one active hold per event**. Pressing Buy twice returns the same
  hold instead of creating a second order. The cap is **per order**, so a student
  could pay for one order and then start another.
- The **server calculates the price** (stored price x seats). Any price sent by
  the browser is ignored.
- You can only read or pay for **your own** orders (others get 403).
- One typed name can hold every seat of an event for 10 minutes. Limits against
  that (the spec's anti-hoarding and rate limits) are not built.

## API

| Method | Endpoint | Success | Errors |
|---|---|---|---|
| GET | /api/events | 200 | |
| POST | /api/orders | 201 (200 if you already had a hold) | 400 (seats not 1-4, unknown event), 401 (no name), 409 (not enough seats, waitlist offered) |
| GET | /api/orders/{id} | 200 | 401, 403 (someone else's), 404 |
| POST | /api/orders/{id}/payment | 200 | 400, 401, 403, 404, 409 (hold expired / already finished) |

The last row is **simulated** and is not part of the original spec's contract:
it replaces the Stripe webhook for this demo. Body: `{"outcome": "approved"}` or
`{"outcome": "declined"}`.

## Deploying: a warning

Because data is kept in memory, this only behaves correctly as **one running
server**. On serverless hosts (for example Vercel) separate requests can land on
separate copies, so holds and orders would appear and vanish. Use it locally.

## Tests

`npm test` runs every test. Test names start with their story number
("Story 1: ...", "Story 3: ..."). The screen tests render HTML but do not click in
a real browser; the end-to-end clicking was checked by hand against the running API.

| File | What it covers |
|---|---|
| tests/story1-*.test.tsx | Story 1: event list, waitlist button, UX states, accessibility |
| tests/story3-buy-tickets.test.ts | Story 3 rules: cap, 10-minute hold, receipt and tickets, decline, sell-out |
| tests/story3-api.test.tsx | Story 3 over HTTP: status codes, other people's orders, tampered prices, 50 simultaneous buyers |
| tests/story3-screens.test.tsx | Story 3 screens: states, disabled buttons, plain-text safety, color tokens |
