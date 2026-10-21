// Shown when a student wanted seats that are gone (Story 3: "IF the event sells out
// during checkout, THEN offer the waitlist"). The button is visible but not wired
// up yet: the waitlist itself is Story 4, same as the one on the events list.
export function WaitlistOffer({ message, title }: { message: string; title: string }) {
  return (
    <div className="alert" role="alert">
      <p>{message}</p>
      <button type="button" className="button" aria-label={`Join waitlist for ${title}`}>
        Join waitlist
      </button>
    </div>
  );
}
