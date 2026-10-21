// "Signed in" for this demo means: a name typed into a text box, kept in a cookie.
// There is NO password and NO verification, so anyone can type anyone's name.
// Real authentication (university SSO, Story 2) is a listed non-goal.

export const NAME_COOKIE = "tt_name";
export const MAX_NAME_LENGTH = 60;

// Clean up a typed name: trim, squash repeated spaces, reject empty / too long /
// control characters. Returns null when the name is not usable.
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) return null;
  if (/[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

// The internal user id. "ada lovelace" and "Ada  Lovelace" are the same student.
export function userIdFromName(name: string): string {
  return name.toLowerCase();
}

// Read the typed name out of the request's Cookie header. Returns null when the
// student has not typed a name (the API then answers 401).
export function getUserNameFromRequest(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== NAME_COOKIE) continue;
    try {
      return normalizeName(decodeURIComponent(rest.join("=")));
    } catch {
      return null; // malformed %-escape in the cookie: treat as not signed in
    }
  }
  return null;
}
