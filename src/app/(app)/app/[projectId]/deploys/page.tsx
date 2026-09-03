import Link from "next/link";
import { notFound } from "next/navigation";
import { Rocket } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { createClient } from "@/lib/db/server";
import { getProject } from "@/lib/db/loaders";
import { getRecentDeployEvents, type DeployProvider } from "@/lib/deploys";
import { diffDeploySnapshots } from "@/lib/deploy-diff";

export const metadata = {
  title: "Déplois",
};

const PROVIDER_LABEL: Record<DeployProvider, string> = {
  vercel: "Vercel",
  netlify: "Netlify",
  cloudflare: "Cloudflare Pages",
};

export default async function DeploysPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) notFound();

  const supabase = await createClient();
  const events = await getRecentDeployEvents(supabase, projectId);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
        <Rocket className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Aucun déploiement suivi pour le moment — configurez un webhook
          Vercel, Netlify ou Cloudflare Pages depuis Paramètres.
        </p>
      </div>
    );
  }

  return (
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
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
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
                  {new Date(event.started_at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </summary>

              <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
                {commitUrl && (
                  <a
                    href={commitUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="self-start font-mono text-xs underline underline-offset-2 hover:text-foreground"
                  >
                    Voir le commit {shortSha}
                  </a>
                )}

                {diff && diff.addedFails.length > 0 && (
                  <p className="text-xs text-destructive">
                    Cassé depuis : {diff.addedFails.map((i) => i.url).join(", ")}
                  </p>
                )}
                {diff && diff.recovered.length > 0 && (
                  <p className="text-xs text-emerald-500">
                    Rétabli depuis : {diff.recovered.map((i) => i.url).join(", ")}
                  </p>
                )}

                {event.fail_count > 0 && (
                  <Link
                    href={`/app/${projectId}/incidents`}
                    className="self-start text-xs text-destructive underline underline-offset-2"
                  >
                    Voir les incidents →
                  </Link>
                )}

                {event.snapshot.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {event.snapshot.map((item) => (
                      <li
                        key={item.targetId}
                        className="flex items-center gap-2 text-xs"
                      >
                        <StatusDot status={item.outcome} />
                        <span className="min-w-0 truncate font-mono">
                          {item.url}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
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
  );
}
