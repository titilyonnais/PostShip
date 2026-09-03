import Link from "next/link";
import { notFound } from "next/navigation";
import { Rocket } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { createClient } from "@/lib/db/server";
import { getProject, getViewerTimezone } from "@/lib/db/loaders";
import { formatDateTime } from "@/lib/timezone";
import {
  getDeployWatchesByEvent,
  getRecentDeployEvents,
  type DeployProvider,
  type DeployWatchStatus,
} from "@/lib/deploys";
import { diffDeploySnapshots } from "@/lib/deploy-diff";
import type { WatchReason } from "@/lib/deploy-watches";

export const metadata = {
  title: "Déplois",
};

const PROVIDER_LABEL: Record<DeployProvider, string> = {
  vercel: "Vercel",
  netlify: "Netlify",
  cloudflare: "Cloudflare Pages",
};

// V5 (ia-moderne backlog): "OK" / "échec" once the watch has run, "en
// attente" while still queued/running, "—" if none was scheduled at all
// (Free plan, or a deploy from before this feature).
function watchLabel(watches: DeployWatchStatus[] | undefined, reason: WatchReason): string {
  const entry = watches?.find((w) => w.reason === reason);
  if (!entry) return "—";
  if (entry.status === "queued" || entry.status === "running") return "en attente";
  if (entry.outcome === "pass") return "OK";
  if (entry.outcome === "fail") return "échec";
  return "—";
}

export default async function DeploysPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) notFound();
  const timezone = await getViewerTimezone();

  const supabase = await createClient();
  const events = await getRecentDeployEvents(supabase, projectId);
  const watchesByEvent = await getDeployWatchesByEvent(
    supabase,
    events.filter((e) => e.kind === "production").map((e) => e.id),
  );

  const header = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Déplois</h1>
      <p className="text-sm text-muted-foreground">
        L&apos;historique de chaque déclenchement Vercel, Netlify ou
        Cloudflare Pages, avec le résultat des checks.
      </p>
    </div>
  );

  if (events.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <Rocket className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Aucun déploiement suivi pour le moment — configurez un webhook
            Vercel, Netlify ou Cloudflare Pages depuis Paramètres.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {header}
      <ul className="flex flex-col gap-2">
      {events.map((event, index) => {
        const shortSha = event.sha ? event.sha.slice(0, 7) : null;
        const commitUrl =
          project.github_repo && event.sha
            ? `https://github.com/${project.github_repo}/commit/${event.sha}`
            : null;

        // events is newest-first — the "previous deploy" for a diff is the
        // next-older row in this same list, regardless of provider.
        const previousEvent = events[index + 1] ?? null;
        const diff =
          previousEvent && event.snapshot.length > 0
            ? diffDeploySnapshots(previousEvent.snapshot, event.snapshot)
            : null;

        return (
          <li
            key={event.id}
            className="rounded-2xl border border-border bg-card"
          >
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-col gap-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm">
                    <StatusDot status={event.outcome ?? "pending"} />
                    <span className="font-medium">
                      {PROVIDER_LABEL[event.provider]}
                    </span>
                    {event.kind === "preview" && (
                      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Preview
                      </span>
                    )}
                    {shortSha && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {shortSha}
                      </span>
                    )}
                    {event.fail_count > 0 && (
                      <span className="text-xs text-destructive">
                        {event.fail_count} URL(s) en échec
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(event.started_at, timezone, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                {event.kind === "production" && (
                  <span className="pl-5.5 font-mono text-[0.7rem] text-muted-foreground">
                    T+0{" "}
                    {event.outcome === "fail" ? "échec" : event.outcome === "pass" ? "OK" : "—"}
                    {" · T+2 "}
                    {watchLabel(watchesByEvent.get(event.id), "watch_t2")}
                    {" · T+8 "}
                    {watchLabel(watchesByEvent.get(event.id), "watch_t8")}
                  </span>
                )}
              </summary>

              <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
                {commitUrl && (
                  <a
                    href={commitUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="self-start font-mono text-sm underline underline-offset-2 hover:text-foreground"
                  >
                    Voir le commit {shortSha}
                  </a>
                )}

                {diff && diff.addedFails.length > 0 && (
                  <p className="text-sm text-destructive">
                    Cassé depuis : {diff.addedFails.map((i) => i.url).join(", ")}
                  </p>
                )}
                {diff && diff.recovered.length > 0 && (
                  <p className="text-sm text-emerald-500">
                    Rétabli depuis : {diff.recovered.map((i) => i.url).join(", ")}
                  </p>
                )}

                {event.fail_count > 0 && (
                  <Link
                    href={`/app/${projectId}/incidents`}
                    className="self-start text-sm text-destructive underline underline-offset-2"
                  >
                    Voir les incidents →
                  </Link>
                )}

                {event.snapshot.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {event.snapshot.map((item) => (
                      <li
                        key={item.targetId}
                        className="flex items-center gap-2 text-sm"
                      >
                        <StatusDot status={item.outcome} />
                        <span className="min-w-0 truncate font-mono">
                          {item.url}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Détail par URL indisponible pour ce déploiement (antérieur
                    à cette fonctionnalité).
                  </p>
                )}
              </div>
            </details>
          </li>
        );
      })}
      </ul>
    </div>
  );
}
