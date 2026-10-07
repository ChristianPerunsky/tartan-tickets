# Tartan Tickets: Security Spec

All requirements use EARS syntax. Assumption IDs (A1–A12) refer to the list in `requirements.md`.

## Authentication

- **SEC-1** The system shall authenticate every user through CMU SSO and shall not store any passwords. (A1, A12)
- **SEC-2** The system shall expire a session after 8 hours of inactivity and require the user to sign in again.
- **SEC-3** The system shall serve all pages and API endpoints over HTTPS only, with HSTS enabled.

## Authorization

- **SEC-4** The system shall check the user's role and club membership on the server for every request, never relying on what the browser shows or hides.
- **SEC-5** If a user requests an event, attendee list, ticket, or refund belonging to a club they are not authorized for, then the system shall return an access-denied response and log the attempt.
- **SEC-6** If a user requests a ticket that belongs to another student, then the system shall return "not found" without revealing that the ticket exists.

## Payments

- **SEC-7** The system shall use Stripe-hosted Checkout so that card numbers never touch Tartan Tickets servers or logs.
- **SEC-8** The system shall calculate every charge amount on the server from the stored event price and quantity, and shall ignore any amount sent by the browser.
- **SEC-9** When the system receives a Stripe webhook, it shall verify the Stripe signature before acting; if the signature is invalid, then the system shall reject the webhook and log it.
- **SEC-10** The system shall process each Stripe event ID at most once, so that a repeated webhook never issues duplicate tickets or duplicate refunds.
- **SEC-11** The system shall store Stripe secret keys only in a secrets manager, never in source code or the repository, and shall use live keys only in production.
- **SEC-12** If anyone attempts to change a club's connected Stripe account, then the system shall require approval from both the club president and a platform admin before payouts are redirected. (A3)

## Tickets and check-in

- **SEC-13** The system shall encode each QR code as a random token of at least 128 bits that contains no personal information and is looked up on the server.
- **SEC-14** When two scans of the same ticket arrive at the same moment, the system shall mark the ticket checked in exactly once and report "Already used" to the other scan.
- **SEC-15** If a single account submits more than 10 invalid scans within one minute, then the system shall pause scanning for that account for 5 minutes and notify the club's officers.
- **SEC-16** If a single account starts more than 5 checkouts for one event within 10 minutes, then the system shall block further checkouts for that account for 30 minutes, to prevent reservation hoarding.

## Data protection

- **SEC-17** The system shall collect only name, Andrew email, ticket status, and Stripe payment ID for each purchase. (A8)
- **SEC-18** When 90 days have passed since an event ended, the system shall remove attendee names and emails from that event's records. (A8)
- **SEC-19** The system shall allow attendee list exports only for officers of the hosting club, limited to name, email, and check-in status, and shall log every export.
- **SEC-20** The system shall display all officer-entered text (event names, descriptions) as plain text so that it cannot run as code in another user's browser.

## Audit logging

- **SEC-21** When a role change, refund, event cancellation, Stripe account change, or attendee export occurs, the system shall write an audit log entry recording who did it, what changed, and when.
- **SEC-22** The system shall keep audit logs append-only, readable only by platform admins, for one year.
