"use client";

import { useCallback, useEffect, useState } from "react";

import type { OrderView } from "../lib/orders";
import { OrderDetails } from "./OrderDetails";

// Loading / error / success states for the order page. The order itself is
// fetched from GET /api/orders/{id}, so the server stays the only source of truth.
type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; order: OrderView };

const GENERIC_ERROR = "Something went wrong while loading your order.";

export function OrderPanel({ orderId }: { orderId: string }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (res.ok) setLoad({ kind: "ready", order: data.order });
      else setLoad({ kind: "error", message: data.message ?? GENERIC_ERROR });
    } catch {
      setLoad({ kind: "error", message: GENERIC_ERROR });
    }
  }, [orderId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // While seats are held, tick once a second for the countdown. When the time is
  // up, ask the server again: it decides whether the hold really expired.
  const heldUntil =
    load.kind === "ready" && load.order.status === "held" ? new Date(load.order.expires_at).getTime() : null;
  useEffect(() => {
    if (heldUntil === null) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= heldUntil) {
        clearInterval(timer);
        reload();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [heldUntil, reload]);

  async function pay(outcome: "approved" | "declined") {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json();
      if (res.ok) {
        setLoad({ kind: "ready", order: data.order });
      } else {
        setMessage(data.message ?? "Something went wrong. Please try again.");
        await reload(); // e.g. the hold expired: show the expired screen
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  if (load.kind === "loading") {
    return (
      <p className="message" role="status">
        Loading your order…
      </p>
    );
  }
  if (load.kind === "error") {
    return (
      <div className="message" role="alert">
        <p>{load.message}</p>
        <p>
          <a href="/" className="link">
            Back to events
          </a>
        </p>
      </div>
    );
  }
  return (
    <OrderDetails
      order={load.order}
      msLeft={heldUntil !== null && now !== null ? heldUntil - now : null}
      pending={pending}
      message={message}
      onPay={pay}
    />
  );
}
