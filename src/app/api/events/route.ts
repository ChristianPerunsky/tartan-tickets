import { listUpcomingEvents } from "../../../lib/events";
import { getEventStore } from "../../../lib/store";

// GET /api/events -> 200 { events: [...] }
// Public (no sign-in needed to browse). Seat counts change, so never cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const events = listUpcomingEvents(getEventStore());
  return Response.json({ events });
}
