import { EventList } from "../components/EventList";
import { NameBox } from "../components/NameBox";
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
      <NameBox />
      <EventList events={events} />
      <p className="note">
        Demo build: payments are simulated, your name is not verified, and Join waitlist is not
        wired up yet (Story 4).
      </p>
    </>
  );
}
