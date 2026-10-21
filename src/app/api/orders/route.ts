import { currentUserName, problemResponse, signInRequired } from "../../../lib/http";
import { createOrder, isProblem, toOrderView } from "../../../lib/orders";
import { getEventStore } from "../../../lib/store";

// POST /api/orders  body: { event_id, seats }
//   201 { order }  a new 10-minute hold was created
//   200 { order }  the student already had a hold on this event; returned as is
//   400 invalid seats (not 1-4) or unknown event
//   401 no name typed
//   409 not enough seats left; the body says to offer the waitlist
// Any price or total in the request body is ignored: the server computes it.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userName = currentUserName(request);
  if (!userName) return signInRequired();

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Not JSON: fall through with null, which fails validation below.
  }
  const fields = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const now = new Date();
  const store = getEventStore();
  const result = createOrder(store, { userName, eventId: fields.event_id, seats: fields.seats }, now);
  if (isProblem(result)) return problemResponse(result);

  return Response.json({ order: toOrderView(store, result.order, now) }, { status: result.created ? 201 : 200 });
}
