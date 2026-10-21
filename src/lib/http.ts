// Small helpers shared by the order API routes.
import type { Problem } from "./orders";
import { getUserNameFromRequest } from "./session";

// Turn a rule failure from orders.ts into a JSON error response.
export function problemResponse(p: Problem): Response {
  const { ok: _ok, status, ...body } = p;
  return Response.json(body, { status });
}

// 401 body. Does not say whether any name "exists" because anyone can type any name.
export function signInRequired(): Response {
  return Response.json(
    { error: "sign_in_required", message: "Type your name at the top of the page first." },
    { status: 401 },
  );
}

// Returns the typed name, or null (caller answers 401).
export function currentUserName(request: Request): string | null {
  return getUserNameFromRequest(request);
}
