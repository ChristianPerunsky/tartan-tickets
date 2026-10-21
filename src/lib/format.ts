// Display helpers for the event list.

// Student events happen in Pittsburgh, so always show Pittsburgh time,
// whatever time zone the server or the viewer's browser is in.
const EVENT_TIME_ZONE = "America/New_York";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: EVENT_TIME_ZONE,
});

export function formatEventDate(iso: string): string {
  // Newer Node versions put a narrow no-break space before "PM"; swap any
  // such whitespace for a normal space so the text is predictable.
  return dateFormatter.format(new Date(iso)).replace(/\s/g, " ");
}

export function formatPrice(priceCents: number): string {
  if (priceCents === 0) return "Free";
  return `$${(priceCents / 100).toFixed(2)}`;
}

// Countdown shown while seats are held: 9:42, 0:05, 0:00.
export function formatCountdown(msLeft: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msLeft / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatSeats(seatsRemaining: number): string {
  if (seatsRemaining === 0) return "Sold out";
  return seatsRemaining === 1 ? "1 seat left" : `${seatsRemaining} seats left`;
}
