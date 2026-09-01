"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls the server for fresh data while a background job (a site scan, a
// cron-processed check) is still in flight — no websocket infra in this
// codebase, so a light interval + router.refresh() is the pragmatic fit.
export function AutoRefresh({
  intervalMs = 5000,
  active = true,
}: {
  intervalMs?: number;
  active?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
