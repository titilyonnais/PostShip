import { Metric, Panel, Tag } from "@/components/admin/console-ui";
import { formatDuration, getVercelSnapshot } from "@/lib/admin-vercel";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { DeploymentTable } from "./deployment-table";

export const metadata = { title: "Vercel" };
export const dynamic = "force-dynamic";

export default async function ConsoleVercel() {
  const snapshot = await getVercelSnapshot(50);

  if (!snapshot.configured) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-mono text-sm text-neutral-100">Vercel</h1>
        <Panel>
          <p className="font-mono text-xs text-neutral-600">
            Jeton absent — variable{" "}
            <span className="text-neutral-400">VERCEL_API_TOKEN</span>, plus{" "}
            <span className="text-neutral-400">VERCEL_TEAM_ID</span> si c&apos;est
            un jeton de projet.
          </p>
        </Panel>
      </div>
    );
  }

  if (snapshot.error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-mono text-sm text-neutral-100">Vercel</h1>
        <Panel>
          <Tag tone="bad">{snapshot.error}</Tag>
        </Panel>
      </div>
    );
  }

  const latest = snapshot.latest;
  const tone =
    latest?.state === "READY" ? "good" : latest?.state === "ERROR" ? "bad" : "warn";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-mono text-sm text-neutral-100">Vercel</h1>

      {latest && (
        <Panel title="Dernier déploiement">
          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <Tag tone={tone}>{latest.state.toLowerCase()}</Tag>
              <span className="text-neutral-400">{latest.target ?? "—"}</span>
              <span className="text-neutral-500">
                {latest.created ? formatRelativeTime(new Date(latest.created).toISOString()) : "—"}
              </span>
              <span className="text-neutral-500">{formatDuration(latest.durationMs)}</span>
              {latest.shaShort && (
                <span className="text-neutral-300">{latest.shaShort}</span>
              )}
            </div>
            <p className="break-all text-neutral-500">{latest.url}</p>
            {latest.commitMessage && (
              <p className="text-neutral-400">{latest.commitMessage}</p>
            )}
            {latest.inspectorUrl && (
              <a
                href={latest.inspectorUrl}
                target="_blank"
                rel="noreferrer"
                className="self-start text-neutral-500 underline underline-offset-2 hover:text-neutral-200"
              >
                inspecteur Vercel ↗
              </a>
            )}
          </div>
        </Panel>
      )}

      <div className="grid gap-px bg-neutral-900 sm:grid-cols-3">
        <Metric label="Déploiements 24 h" value={String(snapshot.counts.day)} />
        <Metric label="Déploiements 7 j" value={String(snapshot.counts.week)} />
        <Metric
          label="Échecs 7 j"
          value={String(snapshot.counts.failedWeek)}
          tone={snapshot.counts.failedWeek > 0 ? "bad" : "good"}
        />
      </div>

      <Panel title={`${snapshot.deployments.length} derniers déploiements`}>
        <DeploymentTable deployments={snapshot.deployments} />
      </Panel>

      <p className="font-mono text-[0.65rem] text-neutral-700">
        Les logs d&apos;exécution Vercel restent dans leur tableau de bord : les
        récupérer demande un log drain, que ce jeton ne fournit pas. Ici, ce sont
        les déploiements.
      </p>
    </div>
  );
}
