import { notFound } from "next/navigation";
import { Rocket } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { createClient } from "@/lib/db/server";
import { getProject } from "@/lib/db/loaders";
import { getRecentDeployEvents, type DeployProvider } from "@/lib/deploys";

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
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-12 text-center">
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
      {events.map((event) => {
        const shortSha = event.sha ? event.sha.slice(0, 7) : null;
        const commitUrl =
          project.github_repo && event.sha
            ? `https://github.com/${project.github_repo}/commit/${event.sha}`
            : null;

        return (
          <li
            key={event.id}
            className="flex flex-col gap-1 rounded-md border border-border bg-card px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
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
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {shortSha &&
                (commitUrl ? (
                  <a
                    href={commitUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-mono underline underline-offset-2 hover:text-foreground"
                  >
                    {shortSha}
                  </a>
                ) : (
                  <span className="font-mono">{shortSha}</span>
                ))}
              {event.fail_count > 0 && (
                <span className="text-destructive">
                  {event.fail_count} URL(s) en échec
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
