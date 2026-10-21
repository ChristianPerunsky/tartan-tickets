import type { EventView } from "../lib/events";
import { formatEventDate, formatPrice, formatSeats } from "../lib/format";
import { BuyForm } from "./BuyForm";

// All officer-entered text (title, location) is rendered as normal React text
// children, which React escapes automatically, so a "<script>" in a title shows
// up as text instead of running (SEC-20). Never use dangerouslySetInnerHTML here.

function EventCard({ event }: { event: EventView }) {
  const soldOut = event.seats_remaining === 0;
  return (
    <li className="card">
      <h2 className="card-title">{event.title}</h2>
      <dl className="details">
        <div>
          <dt>When</dt>
          <dd>
            <time dateTime={event.starts_at}>{formatEventDate(event.starts_at)}</time>
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{event.location}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{formatPrice(event.price_cents)}</dd>
        </div>
        <div>
          <dt>Seats</dt>
          <dd className={soldOut ? "sold-out" : undefined}>{formatSeats(event.seats_remaining)}</dd>
        </div>
      </dl>
      {/* Sold out: "Join waitlist" replaces "Buy". Buying works (Story 3); the
          waitlist button is visible but not wired up yet (Story 4). */}
      {soldOut ? (
        <button type="button" className="button" aria-label={`Join waitlist for ${event.title}`}>
          Join waitlist
        </button>
      ) : (
        <BuyForm eventId={event.event_id} title={event.title} seatsRemaining={event.seats_remaining} />
      )}
    </li>
  );
}

// Success state and empty state.
export function EventList({ events }: { events: EventView[] }) {
  if (events.length === 0) {
    return <p className="message">No upcoming events yet.</p>;
  }
  return (
    <ul className="grid">
      {events.map((event) => (
        <EventCard key={event.event_id} event={event} />
      ))}
    </ul>
  );
}

// Loading state (shown by loading.tsx while the server prepares the page).
export function LoadingState() {
  return (
    <p className="message" role="status">
      Loading events…
    </p>
  );
}

// Error state. Deliberately generic: never show stack traces or internals to students.
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="message" role="alert">
      <p>Something went wrong while loading events.</p>
      <button type="button" className="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
