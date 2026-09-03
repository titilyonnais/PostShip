"use client";

import { BellOff } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { formatDateTime } from "@/lib/timezone";
import { silenceAlerts } from "../actions";

// B2 (app-bar backlog): "Couper 1 h" — and "Reprendre" once silenced —
// live in the app-bar now (the same silenceAlerts action, hours=1 or 0).
// Kept out of this component so neither is offered twice; only the 4h/24h
// options and the plain status line stay here.
const OPTIONS = [
  { hours: 4, label: "4 h" },
  { hours: 24, label: "24 h" },
];

export function SilenceBar({
  projectId,
  silencedUntil,
  timezone,
}: {
  projectId: string;
  silencedUntil: string | null;
  timezone: string;
}) {
  const isSilenced = !!silencedUntil && new Date(silencedUntil).getTime() > Date.now();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <BellOff className="size-3.5" aria-hidden="true" />
        {isSilenced
          ? `Alertes coupées jusqu'à ${formatDateTime(silencedUntil!, timezone, { hour: "2-digit", minute: "2-digit" })}`
          : "Alertes actives"}
      </span>
      {!isSilenced && (
        <div className="flex gap-1.5">
          {OPTIONS.map((opt) => (
            <ActionForm key={opt.hours} action={silenceAlerts.bind(null, projectId, opt.hours)}>
              <SubmitButton variant="outline" size="sm" pendingText="..." className="h-10 md:h-7">
                Couper {opt.label}
              </SubmitButton>
            </ActionForm>
          ))}
        </div>
      )}
    </div>
  );
}
