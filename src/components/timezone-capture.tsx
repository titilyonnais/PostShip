"use client";

import { useEffect } from "react";
import { captureTimezone } from "@/app/(app)/app/account/actions";

// Renders nothing — fires once per browser/profile pair. The account
// Profil tab is the only place a saved timezone should ever change after
// that, so this only acts when hasTimezone is false (see captureTimezone's
// own no-op-if-already-set guard for the race between two tabs).
export function TimezoneCapture({ hasTimezone }: { hasTimezone: boolean }) {
  useEffect(() => {
    if (hasTimezone) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) captureTimezone(timezone);
  }, [hasTimezone]);

  return null;
}
