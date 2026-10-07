"use client"; // Next.js requires error boundaries to be client components.

import { ErrorState } from "../components/EventList";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  // The error itself is ignored on purpose: students only see a generic message.
  return <ErrorState onRetry={reset} />;
}
