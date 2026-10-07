import type { EventRecord } from "./events";

// Demo events. Dates are relative to "now" so they are always upcoming
// no matter when you start the server.
const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number, hourUtc: number): string {
  const d = new Date(Date.now() + days * DAY_MS);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

export function buildSeedEvents(): EventRecord[] {
  return [
    {
      event_id: "evt_spring_concert",
      club_id: "club_orchestra",
      title: "Spring Concert: CMU Philharmonic",
      starts_at: daysFromNow(9, 23), // evening in Pittsburgh
      location: "Carnegie Music Hall",
      price_cents: 800,
      capacity: 120,
      status: "published",
      seats_sold: 45,
    },
    {
      event_id: "evt_hackathon_mixer",
      club_id: "club_acm",
      title: "Hack Night Mixer",
      starts_at: daysFromNow(3, 22),
      location: "Gates Center Atrium",
      price_cents: 0,
      capacity: 60,
      status: "published",
      seats_sold: 12,
    },
    {
      event_id: "evt_improv_showcase",
      club_id: "club_improv",
      title: "Improv Showcase",
      starts_at: daysFromNow(6, 0),
      location: "McConomy Auditorium",
      price_cents: 500,
      capacity: 40,
      status: "published",
      seats_sold: 40, // sold out: shows "Join waitlist"
    },
    {
      event_id: "evt_finance_gala",
      club_id: "club_finance",
      title: "Finance Club Networking Gala",
      starts_at: daysFromNow(14, 23),
      location: "Tepper Quad, Simmons Auditorium",
      price_cents: 2500,
      capacity: 80,
      status: "published",
      seats_sold: 79, // one seat left: shows "1 seat left"
    },
    {
      event_id: "evt_last_week_trivia",
      club_id: "club_trivia",
      title: "Trivia Night (already happened)",
      starts_at: daysFromNow(-5, 23),
      location: "The Underground",
      price_cents: 300,
      capacity: 50,
      status: "published",
      seats_sold: 31, // past event: must NOT appear in the list
    },
    {
      event_id: "evt_cancelled_film",
      club_id: "club_film",
      title: "Outdoor Film Screening (cancelled)",
      starts_at: daysFromNow(7, 1),
      location: "The Cut",
      price_cents: 0,
      capacity: 200,
      status: "cancelled",
      seats_sold: 0, // cancelled: must NOT appear in the list
    },
  ];
}
