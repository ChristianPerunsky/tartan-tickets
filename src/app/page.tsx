import { EventList } from "../components/EventList";
import { listUpcomingEvents } from "../lib/events";
import { getEventStore } from "../lib/store";

// Seat counts change as tickets sell, so render fresh on every request.
export const dynamic = "force-dynamic";

export default async function Page() {
  // Reads the same in-memory store as GET /api/events.
  const events = listUpcomingEvents(getEventStore());
  return (
    <>
      <h1>Upcoming events</h1>
      <EventList events={events} />
      <p className="note">
        Demo build: Buy and Join waitlist are shown but not wired up yet (Stories 3 and 4).
      </p>
    </>
  );
}
