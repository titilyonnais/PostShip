"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// A GDPR/ePrivacy banner that is honest about what it is asking for.
//
// PostShip sets exactly one category of cookie without asking: the
// Supabase session cookie, which is strictly necessary — a login cannot
// work without it, and article 82 of the loi Informatique et Libertés
// (and the ePrivacy directive it transposes) exempts exactly that. Server
// logs of IP and user agent, used for security and fraud prevention, are
// not storage on the visitor's device at all: they are covered by
// legitimate interest and are described on the privacy page rather than
// consented to here.
//
// What the banner is actually for: the optional measurement cookie. It is
// off until someone says yes, "Refuser" is as easy to reach as
// "Accepter" — the CNIL's position since 2020 is that a refusal must cost
// no more clicks than an acceptance — and the choice can be changed
// later from the privacy page.

const STORAGE_KEY = "postship_consent";
const VERSION = 1;

export type ConsentValue = "granted" | "denied";

type StoredConsent = { version: number; value: ConsentValue; at: string };

export function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    // A changed version invalidates the old answer rather than silently
    // reusing consent given for a different set of purposes.
    return parsed.version === VERSION ? parsed.value : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: ConsentValue): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: VERSION, value, at: new Date().toISOString() }),
    );
  } catch {
    // A browser refusing storage is itself a refusal to be measured.
  }
  window.dispatchEvent(new CustomEvent("postship:consent", { detail: value }));
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Read after mount, never during render: the server has no
    // localStorage and a mismatch would flash the banner at everyone who
    // already answered.
    setVisible(readConsent() === null);
  }, []);

  if (!visible) return null;

  function decide(value: ConsentValue) {
    writeConsent(value);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Préférences de confidentialité"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
          PostShip dépose un cookie de session, indispensable pour vous garder
          connecté — il n&apos;est pas soumis à votre accord. Nous aimerions y
          ajouter une mesure d&apos;audience anonyme, pour savoir quelles pages
          servent. Elle reste désactivée tant que vous n&apos;avez pas accepté.{" "}
          <Link
            href="/privacy"
            className="text-foreground underline underline-offset-2"
          >
            Détails et retrait
          </Link>
          .
        </p>

        {/* Refusing costs exactly one click, like accepting. */}
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-full border border-border px-4 py-2 text-xs font-medium transition-colors hover:border-foreground/25"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
