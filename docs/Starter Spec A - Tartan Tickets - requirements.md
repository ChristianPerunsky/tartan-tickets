# Requirements Spec: Club Event Ticketing App

## 1. Problem, Users, and Goals
Student clubs sell event tickets through spreadsheets and payment apps. That leads to overselling, lost payments, and no attendance data.
- **Users:** Students (buyers) and club officers (organizers).
- **Goals:** Buying a ticket takes under 60 seconds. No event is ever oversold. Officers can see a live attendee list.

## 2. Non-Goals
- No resale or ticket transfers between students.
- No seat-map selection (general admission only).
- No native mobile app (a responsive web app only).
- No storage of card numbers.

## 3. User Stories and Acceptance Criteria (EARS)

### Story 1: Browse events
As a student, I want to see upcoming events so that I can choose one to attend.
- THE system SHALL list upcoming events with the date, location, price, and seats remaining.
- WHILE an event is sold out, THE system SHALL show a "Join waitlist" button instead of "Buy".

### Story 2: Sign in
As a student, I want to sign in with my university account so that my tickets are tied to me.
- THE system SHALL authenticate users through university SSO.
- IF there are 5 failed sign-in attempts within 10 minutes, THEN THE system SHALL lock the account for 15 minutes.

### Story 3: Buy tickets
As a student, I want to buy up to 4 tickets so that my friends can sit with me.
- WHEN a student buys tickets, THE system SHALL cap the order at 4 seats.
- WHEN a student starts checkout, THE system SHALL hold the seats for 10 minutes.
- WHEN a payment succeeds, THE system SHALL email a receipt with a QR code within 1 minute.
- IF a card is declined, THEN THE system SHALL release the held seats.
- IF the event sells out during checkout, THEN THE system SHALL offer the waitlist.

### Story 4: Waitlist
As a student, I want to join a waitlist so that I can get a seat if one opens up.
- WHEN a seat is released, THE system SHALL notify the next person on the waitlist and hold the seat for 30 minutes.

### Story 5: Manage events (officers)
As a club officer, I want to create events and see who is attending.
- WHERE a user is a club officer, THE system SHALL allow creating, editing, and cancelling events.
- WHERE a user is a club officer, THE system SHALL show the attendee list and allow exporting it as CSV.
- WHEN an event is cancelled, THE system SHALL refund all orders and email the attendees.

### Story 6: Check-in
As an officer, I want to scan tickets at the door.
- WHEN a QR code is scanned, THE system SHALL mark the ticket as used and reject any later scans of it.

## 4. Data Model
- `users(user_id, email, name, role)`
- `events(event_id, club_id, title, starts_at, location, price_cents, capacity, status)`
- `orders(order_id, user_id, event_id, seats, status, created_at)`
- `tickets(ticket_id, order_id, qr_token, checked_in_at)`
- `waitlist(event_id, user_id, position, created_at)`
- Personal data is deleted 1 year after the event.

## 5. API Contract
| Method | Endpoint | Success | Errors |
|---|---|---|---|
| GET | /api/events | 200 | — |
| POST | /api/orders | 201 | 400 (seats > 4), 401, 409 (sold out) |
| GET | /api/orders/{id} | 200 | 403, 404 |
| POST | /api/events | 201 | 400, 403 |
| POST | /api/waitlist | 201 | 401, 409 (already on the list) |
| POST | /api/checkin | 200 | 404, 409 (already used) |
| POST | /api/webhooks/stripe | 200 | 400 (bad signature) |

## 6. UX Spec
- Every screen defines empty, loading, error, and success states. For example, the empty state reads "No upcoming events yet."
- The Buy button is disabled after one click to prevent double orders.
- Colors are defined as named tokens (ink, accent, surface).
- Text contrast is at least 4.5:1, and the whole app is usable by keyboard.

## 7. Security Spec
- All traffic goes over HTTPS; payments go through Stripe Checkout.
- The server checks authorization on every request, so users can only read their own orders.
- Stripe webhook signatures are verified.
- Error messages never reveal whether an account exists.
- API requests are rate-limited to 100 per minute per user.

## 8. Test Harness Spec
- Every acceptance criterion has at least one automated test that references its story number.
- Concurrency test: 50 simultaneous buyers for the last seat result in exactly 1 success.
- Security tests cover accessing another user's order (IDOR), forged webhooks, and rate limits.

## 9. Constraints
- **Stack:** Next.js, PostgreSQL, Stripe.
- **Budget:** under $50/month in hosting costs.
- **Performance:** pages load in under 2 seconds at the 95th percentile, with 500 concurrent users.
- **Compliance:** FERPA-aware handling of student data.

## 10. Definition of Done
- All tests pass, including the security tests.
- A person has reviewed the code against this spec.
- The docs and the spec match the shipped behavior.
