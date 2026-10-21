"use client";

import { useRef, useState, type FormEvent } from "react";

import { MAX_SEATS_PER_ORDER } from "../lib/rules";
import { WaitlistOffer } from "./WaitlistOffer";

interface BuyProblem {
  message: string;
  offerWaitlist: boolean;
}

// The part you see: a seat picker, the Buy button and any problem message.
// Kept separate from the click handling so tests can render each state.
export function BuyFormView(props: {
  title: string;
  maxSeats: number; // most seats this student can pick right now (1 to 4)
  seats: number;
  pending: boolean; // true after the first click: the button is disabled
  problem: BuyProblem | null;
  onSeatsChange: (seats: number) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const options = Array.from({ length: props.maxSeats }, (_, i) => i + 1);
  return (
    <form className="buy-form" onSubmit={props.onSubmit}>
      <label>
        Seats{" "}
        <select
          value={props.seats}
          disabled={props.pending}
          onChange={(e) => props.onSeatsChange(Number(e.target.value))}
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {/* Disabled while the order is being created so a double-click cannot place
          two orders. The label stays "Buy" so the button never changes shape. */}
      <button
        type="submit"
        className="button"
        disabled={props.pending}
        aria-label={`Buy tickets for ${props.title}`}
      >
        Buy
      </button>
      {props.pending && (
        <span role="status" className="note-inline">
          Holding your seats…
        </span>
      )}
      {props.problem &&
        (props.problem.offerWaitlist ? (
          <WaitlistOffer message={props.problem.message} title={props.title} />
        ) : (
          <p role="alert" className="problem">
            {props.problem.message}
          </p>
        ))}
    </form>
  );
}

export function BuyForm({
  eventId,
  title,
  seatsRemaining,
}: {
  eventId: string;
  title: string;
  seatsRemaining: number;
}) {
  const [seats, setSeats] = useState(1);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<BuyProblem | null>(null);
  // A ref changes instantly, so a very fast second click is blocked even before
  // React has redrawn the disabled button.
  const submitting = useRef(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setProblem(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_id: eventId, seats }),
      });
      const data = await res.json();
      if (res.ok) {
        // Go to the checkout page. The button stays disabled while the browser leaves.
        window.location.assign(`/orders/${data.order.order_id}`);
        return;
      }
      setProblem({
        message: data.message ?? "Something went wrong. Please try again.",
        offerWaitlist: data.offer_waitlist === true,
      });
    } catch {
      setProblem({ message: "Something went wrong. Please try again.", offerWaitlist: false });
    }
    submitting.current = false;
    setPending(false);
  }

  return (
    <BuyFormView
      title={title}
      maxSeats={Math.max(1, Math.min(MAX_SEATS_PER_ORDER, seatsRemaining))}
      seats={seats}
      pending={pending}
      problem={problem}
      onSeatsChange={setSeats}
      onSubmit={handleSubmit}
    />
  );
}
