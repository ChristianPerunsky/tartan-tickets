import { currentUserName, problemResponse, signInRequired } from "../../../../../lib/http";
import { isProblem, payOrder, toOrderView, type PaymentOutcome } from "../../../../../lib/orders";
import { getEventStore } from "../../../../../lib/store";

// POST /api/orders/{id}/payment  body: { outcome: "approved" | "declined" }
// SIMULATED payment: this stands in for Stripe. No card is ever involved.
//   200 { order }  approved -> order is paid and tickets exist; declined -> seats released
//   400 outcome is not "approved" or "declined"
//   401 no name typed
//   403 the order belongs to someone else
//   404 no such order
//   409 the hold already expired / the order is already finished
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userName = currentUserName(request);
  if (!userName) return signInRequired();

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Not JSON: handled by the outcome check below.
  }
  const outcome = (body as { outcome?: unknown } | null)?.outcome;
  if (outcome !== "approved" && outcome !== "declined") {
    return Response.json(
      { error: "invalid_outcome", message: 'outcome must be "approved" or "declined".' },
      { status: 400 },
    );
  }

  const { id } = await params;
  const now = new Date();
  const store = getEventStore();
  const result = payOrder(store, id, userName, outcome as PaymentOutcome, now);
  if (isProblem(result)) return problemResponse(result);

  return Response.json({ order: toOrderView(store, result.order, now) });
}
