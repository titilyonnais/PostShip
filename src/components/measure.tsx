"use client";

import { useEffect } from "react";
import { readConsent } from "@/components/cookie-banner";

// The measurement half of the consent banner, and the only thing that
// banner actually asks for. Everything the server already records arrives
// in request headers and rides on legitimate interest; none of it needs
// permission. What follows does not exist server-side, so it is gated on
// a yes and sent once, when the visitor leaves the page.
//
// Sent on pagehide rather than on load, because the one number worth
// having — how long the page was actually looked at — is only known at
// the end. sendBeacon survives the navigation that unload does not.
export function Measure({ path }: { path: string }) {
  useEffect(() => {
    if (readConsent() !== "granted") return;

    const startedAt = Date.now();
    let visibleMs = 0;
    let lastVisible = document.visibilityState === "visible" ? Date.now() : null;

    function onVisibility() {
      if (document.visibilityState === "visible") {
        lastVisible = Date.now();
      } else if (lastVisible) {
        // Only time the tab was actually in front counts. A page left
        // open in a background tab for an hour is not an hour of reading.
        visibleMs += Date.now() - lastVisible;
        lastVisible = null;
      }
    }

    function send() {
      if (lastVisible) {
        visibleMs += Date.now() - lastVisible;
        lastVisible = null;
      }

      const connection = (
        navigator as Navigator & { connection?: { effectiveType?: string } }
      ).connection;

      const payload = JSON.stringify({
        path,
        screenW: window.screen.width,
        screenH: window.screen.height,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        connection: connection?.effectiveType ?? null,
        engagementMs: Math.min(visibleMs, Date.now() - startedAt),
      });

      navigator.sendBeacon?.("/api/track/client", new Blob([payload], {
        type: "application/json",
      }));
    }

    document.addEventListener("visibilitychange", onVisibility);
    // pagehide, not beforeunload: it fires on mobile Safari's back/forward
    // cache, which beforeunload does not.
    window.addEventListener("pagehide", send);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      send();
    };
  }, [path]);

  return null;
}
