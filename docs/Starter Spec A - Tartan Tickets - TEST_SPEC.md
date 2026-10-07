# Tartan Tickets: Test Spec

Every requirement in `requirements.md` and `SECURITY_SPEC.md` maps to at least one named test. Test types: **Unit** (single function), **Integration** (app + database + Stripe test mode), **E2E** (full browser flow).

## Functional requirements

| Req | Test name | Type | What it proves |
|-----|-----------|------|----------------|
| REQ-1.1 | test_admin_approves_registered_club | Integration | Club is created with registry ID and the named president. |
| REQ-1.2 | test_admin_approval_rejects_unregistered_club | Integration | Unknown club is rejected with the correct message. |
| REQ-1.3 | test_paid_event_blocked_until_stripe_onboarded | Integration | Paid publish fails before Stripe onboarding, succeeds after. |
| REQ-2.1 | test_officer_role_scoped_to_one_club | Integration | New officer can manage their club but not another club. |
| REQ-2.2 | test_volunteer_access_expires_24h_after_event | Unit | Check-in permission works during event and fails at end + 24h. |
| REQ-2.3 | test_removed_officer_loses_access_next_request | Integration | Removed officer's very next request is denied. |
| REQ-3.1 | test_non_officer_cannot_create_event | Integration | Student and other-club officer are denied. |
| REQ-3.2 | test_published_event_shows_all_fields | E2E | Public page shows every required field and remaining count. |
| REQ-3.3 | test_event_rejects_invalid_capacity_and_price | Unit | Capacity 0, price $0.50, and negative price are rejected. |
| REQ-3.4 | test_price_and_capacity_locked_after_first_sale | Integration | Price change and capacity below sold count are refused. |
| REQ-3.5 | test_ticket_limit_default_and_range | Unit | Default is 4; 0 and 11 are rejected; 1 and 10 are accepted. |
| REQ-4.1 | test_checkout_reserves_tickets_for_10_minutes | Integration | Inventory drops on Buy and redirect goes to Stripe Checkout. |
| REQ-4.2 | test_successful_payment_issues_and_emails_tickets | Integration | Correct number of unique QR tickets emailed within 60 s. |
| REQ-4.3 | test_failed_or_expired_checkout_releases_inventory | Integration | Inventory returns and no tickets exist after failure or timeout. |
| REQ-4.4 | test_purchase_over_limit_rejected | Integration | Over-limit purchase fails and shows remaining allowance. |
| REQ-4.5 | test_sold_out_disables_buy | E2E | Buy button disabled and "Sold out" shown at zero inventory. |
| REQ-4.6 | test_late_payment_after_expiry_auto_refunds | Integration | Late success with no inventory triggers refund and email. |
| REQ-5.1 | test_free_event_claim_skips_stripe | Integration | Ticket issued with no Stripe call made. |
| REQ-5.2 | test_free_event_enforces_limit_and_capacity | Integration | Free claims stop at limit and capacity. |
| REQ-6.1 | test_student_sees_only_own_tickets | E2E | Ticket list shows the student's tickets and nobody else's. |
| REQ-6.2 | test_refunded_ticket_hides_qr | E2E | Refunded and cancelled tickets show status and no QR. |
| REQ-7.1 | test_officer_refund_before_48h | Integration | Full Stripe refund issued and ticket invalidated. |
| REQ-7.2 | test_officer_refund_blocked_within_48h | Integration | Officer refund fails at 47h; admin refund succeeds. |
| REQ-7.3 | test_event_cancellation_refunds_all | Integration | Every paid ticket refunded, invalidated, and emailed. |
| REQ-7.4 | test_failed_refund_retries_and_alerts_admin | Integration | Status becomes pending; admin alerted after third failure. |
| REQ-8.1 | test_valid_scan_checks_in | E2E | Valid ticket marked checked in and name displayed. |
| REQ-8.2 | test_duplicate_scan_shows_already_used | E2E | Second scan shows "Already used" with first scan time. |
| REQ-8.3 | test_invalid_wrong_event_refunded_scans_rejected | Integration | All three cases show "Invalid ticket" and change nothing. |
| REQ-8.4 | test_unassigned_volunteer_cannot_scan | Integration | Volunteer for another event is denied. |
| REQ-8.5 | test_offline_scan_shows_no_connection | E2E | With network disabled, no admit result is ever shown. |

## Security requirements

| Req | Test name | Type | What it proves |
|-----|-----------|------|----------------|
| SEC-1 | test_all_routes_require_sso | Integration | Every non-public route redirects unauthenticated users to SSO. |
| SEC-2 | test_session_expires_after_8h_idle | Unit | Session is valid at 7h 59m idle and invalid at 8h. |
| SEC-3 | test_http_redirects_to_https_with_hsts | Integration | HTTP requests redirect; HSTS header present. |
| SEC-4 | test_authorization_enforced_server_side | Integration | Direct API calls without permission fail even if UI is bypassed. |
| SEC-5 | test_cross_club_access_denied_and_logged | Integration | Other-club resource requests are denied and logged. |
| SEC-6 | test_other_students_ticket_returns_not_found | Integration | Response is identical to a nonexistent ticket. |
| SEC-7 | test_no_card_data_in_db_or_logs | Integration | Search of database and logs after test purchases finds no card data. |
| SEC-8 | test_tampered_client_price_ignored | Integration | Modified price in request is charged at stored price. |
| SEC-9 | test_unsigned_webhook_rejected | Integration | Webhook with bad or missing signature issues no tickets. |
| SEC-10 | test_duplicate_webhook_is_idempotent | Integration | Same Stripe event delivered twice yields one set of tickets. |
| SEC-11 | test_no_secrets_in_repository | Unit (CI) | Secret scanner finds no Stripe keys in the codebase. |
| SEC-12 | test_stripe_account_change_needs_two_approvals | Integration | Change stays pending until both president and admin approve. |
| SEC-13 | test_qr_token_random_and_pii_free | Unit | Token is ≥128 bits, unique across 100k samples, contains no PII. |
| SEC-14 | test_concurrent_scans_single_checkin | Integration | Two simultaneous scans produce exactly one check-in. |
| SEC-15 | test_invalid_scan_rate_limit | Integration | 11th invalid scan in a minute pauses scanning and notifies officers. |
| SEC-16 | test_checkout_hoarding_rate_limit | Integration | 6th checkout in 10 minutes is blocked for 30 minutes. |
| SEC-17 | test_only_minimal_fields_stored | Unit | Purchase record schema contains only the allowed fields. |
| SEC-18 | test_attendee_data_anonymized_after_90_days | Integration | Names and emails removed at day 90, present at day 89. |
| SEC-19 | test_export_restricted_and_logged | Integration | Only hosting officers can export; export is logged. |
| SEC-20 | test_event_text_rendered_as_plain_text | E2E | A script tag in an event description displays as text. |
| SEC-21 | test_sensitive_actions_write_audit_log | Integration | Each listed action creates a complete log entry. |
| SEC-22 | test_audit_log_append_only_admin_read | Integration | Edits and deletes fail; non-admins cannot read. |
