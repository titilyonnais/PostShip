import Link from "next/link";
import { notFound } from "next/navigation";
import { Moon, Siren } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { TargetKindBadge, TARGET_KIND_LABEL } from "@/components/target-kind-badge";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { createClient } from "@/lib/db/server";
import { getProject, getViewerTimezone } from "@/lib/db/loaders";
import { getIncidentLog, getOpenIncidents } from "@/lib/incidents";
import { SilenceBar } from "./silence-bar";

export const metadata = {
  title: "Incidents",
};

const RANGES: Record<string, { label: string; days: number }> = {
  "24h": { label: "24 h", days: 1 },
  "7d": { label: "7 j", days: 7 },
  "30d": { label: "30 j", days: 30 },
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  discord: "Discord",
  slack: "Slack",
  telegram: "Telegram",
};

export default async function IncidentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { projectId } = await params;
  const { range: rawRange } = await searchParams;
  const range = rawRange && RANGES[rawRange] ? rawRange : "7d";

  const project = await getProject(projectId);
  if (!project) notFound();
  const timezone = await getViewerTimezone();

  const supabase = await createClient();
  const since = new Date(
    Date.now() - RANGES[range].days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [openIncidents, log] = await Promise.all([
    getOpenIncidents(supabase, projectId),
    getIncidentLog(supabase, projectId, since),
  ]);

  const hasQuietHours =
    project.quiet_hours_start !== null && project.quiet_hours_end !== null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
        <p className="text-sm text-muted-foreground">
          Ce qui est en échec en ce moment, et le journal des alertes envoyées.
        </p>
      </div>

      <SilenceBar
        projectId={projectId}
        silencedUntil={project.alerts_silenced_until}
        timezone={timezone}
      />

      {hasQuietHours && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Moon className="size-3.5" aria-hidden="true" />
          Heures calmes ·{" "}
          {String(project.quiet_hours_start).padStart(2, "0")}:00–
          {String(project.quiet_hours_end).padStart(2, "0")}:00{" "}
          {project.quiet_hours_tz}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Ouverts maintenant
        </h2>
        {openIncidents.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {openIncidents.map((incident) => (
              <li key={incident.targetId}>
                <Link
                  href={`/app/${projectId}/${incident.targetId}`}
                  className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 transition-colors hover:border-destructive/50"
                >
                  <TargetKindBadge
                    kind={incident.kind}
                    className="size-8 bg-destructive/10 text-destructive"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <StatusDot status={incident.outcome} />
                        <span className="min-w-0 truncate font-mono text-sm">
                          {incident.url}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {TARGET_KIND_LABEL[incident.kind] ?? incident.kind}
                      </span>
                    </div>
                    <p className="text-sm text-destructive">{incident.description}</p>
                    {incident.since && (
                      <p className="text-sm text-muted-foreground">
                        Depuis {formatRelativeTime(incident.since)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <Siren className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Aucun incident. Silence, c&apos;est le produit.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Journal
          </h2>
          <div className="flex gap-1">
            {Object.entries(RANGES).map(([key, { label }]) => (
              <Link
                key={key}
                href={`/app/${projectId}/incidents?range=${key}`}
                className={`rounded-sm px-2 py-1 text-xs transition-colors ${
                  key === range
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {log.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1.5 rounded-xl bg-secondary px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot status={entry.kind === "recovered" ? "pass" : "fail"} />
                  <span className="min-w-0 truncate font-mono">{entry.url}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                  <span>{entry.kind === "recovered" ? "Rétabli" : "En échec"}</span>
                  <span>{CHANNEL_LABEL[entry.channel] ?? entry.channel}</span>
                  <span>{formatRelativeTime(entry.sentAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Aucune alerte envoyée sur cette période.
          </p>
        )}
      </section>
    </div>
  );
}
