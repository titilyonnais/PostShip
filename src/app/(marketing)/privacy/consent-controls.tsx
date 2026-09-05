"use client";

import { useEffect, useState } from "react";
import { readConsent, writeConsent, type ConsentValue } from "@/components/cookie-banner";

// The withdrawal path the banner promises. A consent you cannot revisit
// as easily as you gave it is not a consent, and burying it behind an
// email to support is the usual way that promise gets broken.
export function ConsentControls() {
  const [consent, setConsent] = useState<ConsentValue | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  if (!ready) return null;

  function decide(value: ConsentValue) {
    writeConsent(value);
    setConsent(value);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4">
      <p className="flex-1 text-xs text-muted-foreground">
        Mesure d&apos;audience :{" "}
        <span className="text-foreground">
          {consent === "granted"
            ? "acceptée"
            : consent === "denied"
              ? "refusée"
              : "aucun choix enregistré"}
        </span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => decide("denied")}
          disabled={consent === "denied"}
          className="rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-foreground/25 disabled:opacity-40"
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={() => decide("granted")}
          disabled={consent === "granted"}
          className="rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-foreground/25 disabled:opacity-40"
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
