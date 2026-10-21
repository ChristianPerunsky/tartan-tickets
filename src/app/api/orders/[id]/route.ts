import { currentUserName, problemResponse, signInRequired } from "../../../../lib/http";
import { getOrder, isProblem, toOrderView } from "../../../../lib/orders";
import { getEventStore } from "../../../../lib/store";

// GET /api/orders/{id}
//   200 { order }  your own order (tickets are included once it is paid)
//   401 no name typed
//   403 the order belongs to someone else
//   404 no such order
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userName = currentUserName(request);
  if (!userName) return signInRequired();

  const { id } = await params; // params is a Promise in this version of Next.js
  const now = new Date();
  const store = getEventStore();
  const result = getOrder(store, id, userName, now);
  if (isProblem(result)) return problemResponse(result);

  return Response.json({ order: toOrderView(store, result.order, now) });
}
