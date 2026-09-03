"use client";

import { BellOff } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { silenceAlerts } from "../actions";

const OPTIONS = [
  { hours: 1, label: "1 h" },
  { hours: 4, label: "4 h" },
  { hours: 24, label: "24 h" },
];

export function SilenceBar({
  projectId,
  silencedUntil,
}: {
  projectId: string;
  silencedUntil: string | null;
}) {
  const isSilenced = !!silencedUntil && new Date(silencedUntil).getTime() > Date.now();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <BellOff className="size-3.5" aria-hidden="true" />
        {isSilenced
          ? `Alertes coupées jusqu'à ${new Date(silencedUntil!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
          : "Alertes actives"}
      </span>
      {isSilenced ? (
        <ActionForm action={silenceAlerts.bind(null, projectId, 0)}>
          <SubmitButton variant="outline" size="sm" pendingText="...">
            Reprendre
          </SubmitButton>
        </ActionForm>
      ) : (
        <div className="flex gap-1.5">
          {OPTIONS.map((opt) => (
            <ActionForm key={opt.hours} action={silenceAlerts.bind(null, projectId, opt.hours)}>
              <SubmitButton variant="outline" size="sm" pendingText="...">
                Couper {opt.label}
              </SubmitButton>
            </ActionForm>
          ))}
        </div>
      )}
    </div>
  );
}
