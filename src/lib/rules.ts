// Story 3 numbers from docs/requirements.md. Kept in their own file (no Node-only
// imports) so both the server logic and the browser screens can use them.
export const MAX_SEATS_PER_ORDER = 4; // "cap the order at 4 seats"
export const HOLD_MS = 10 * 60 * 1000; // "hold the seats for 10 minutes"
export const RECEIPT_DEADLINE_MS = 60 * 1000; // "email a receipt ... within 1 minute"
