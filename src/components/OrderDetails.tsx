import type { OrderView } from "../lib/orders";
import { formatCountdown, formatEventDate, formatPrice } from "../lib/format";
import { WaitlistOffer } from "./WaitlistOffer";

// What the student sees for one order. One layout per status:
//   held -> countdown + Simulated payment / Simulated decline
//   paid -> receipt and ticket codes (success)
//   declined / expired -> seats released, with a way back
// OrderPanel (the interactive wrapper) loads the order and handles the clicks.

function seatWord(n: number): string {
  return n === 1 ? "1 ticket" : `${n} tickets`;
}

export function OrderDetails(props: {
  order: OrderView;
  msLeft: number | null; // time left on the hold; only used while status is "held"
  pending: boolean; // a payment click is in flight: buttons disabled
  message: string | null; // problem from the last click, if any
  onPay: (outcome: "approved" | "declined") => void;
}) {
  const { order } = props;
  const summary = `${seatWord(order.seats)} for ${order.event_title}, total ${formatPrice(order.total_cents)}`;

  if (order.status === "paid") {
    return (
      <section aria-labelledby="receipt-heading">
        <h2 id="receipt-heading">Payment received</h2>
        <p>Receipt: {summary}.</p>
        {order.receipt_sent_at && (
          <p>
            Receipt sent {formatEventDate(order.receipt_sent_at)}. (Demo: no real email is sent.)
          </p>
        )}
        <h3>Your ticket codes</h3>
        <ul className="tickets">
          {order.tickets.map((t, i) => (
            <li key={t.ticket_id}>
              Ticket {i + 1}: <code className="ticket-code">{t.qr_token}</code>
            </li>
          ))}
        </ul>
        <p>
          <a href="/" className="link">
            Back to events
          </a>
        </p>
      </section>
    );
  }

  if (order.status === "declined") {
    return (
      <section aria-labelledby="declined-heading">
        <h2 id="declined-heading">Card declined</h2>
        <p role="alert">Your card was declined, so we let go of your seats. You were not charged.</p>
        <p>
          <a href="/" className="link">
            Back to events
          </a>
        </p>
      </section>
    );
  }

  if (order.status === "expired") {
    return (
      <section aria-labelledby="expired-heading">
        <h2 id="expired-heading">Hold expired</h2>
        {order.offer_waitlist ? (
          <WaitlistOffer
            message="Your 10-minute hold ran out and the seats are gone."
            title={order.event_title}
          />
        ) : (
          <p role="alert">Your 10-minute hold ran out and your seats were released.</p>
        )}
        <p>
          <a href="/" className="link">
            Back to events
          </a>
        </p>
      </section>
    );
  }

  // status === "held"
  return (
    <section aria-labelledby="checkout-heading">
      <h2 id="checkout-heading">Checkout</h2>
      <p>{summary}.</p>
      {props.msLeft !== null && (
        <p>
          Your seats are held for <strong className="countdown">{formatCountdown(props.msLeft)}</strong>.
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="button"
          disabled={props.pending}
          onClick={() => props.onPay("approved")}
        >
          Simulated payment
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={props.pending}
          onClick={() => props.onPay("declined")}
        >
          Simulated decline
        </button>
      </div>
      {props.message && (
        <p role="alert" className="problem">
          {props.message}
        </p>
      )}
      <p className="note">Demo only: no real payment is made and no card is used.</p>
    </section>
  );
}
