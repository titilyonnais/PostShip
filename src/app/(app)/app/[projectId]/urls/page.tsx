import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Link2 } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { FailureDetails, type CheckRunDetails } from "@/components/failure-details";
import { createClient } from "@/lib/db/server";
import { getProject, getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { AddTargetForm } from "../add-target-form";
import { MoneyPathDialog } from "../money-path-dialog";
import { TargetActionsMenu } from "../target-actions-menu";

export const metadata = {
  title: "URLs",
};

type RunRow = {
  target_id: string;
  outcome: string;
  started_at: string;
  http_status: number | null;
  ttfb_ms: number | null;
  fingerprint: string;
  details: CheckRunDetails | null;
};

const KIND_FILTERS = ["http", "og", "sitemap", "ssl", "stripe_health"] as const;

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-foreground/30 bg-secondary font-medium text-foreground"
          : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function UrlsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  const { projectId } = await params;
  const { kind: kindFilter, status: statusFilter } = await searchParams;

  const project = await getProject(projectId);
  if (!project) notFound();

  const ownerPlan = await getProjectOwnerPlan(project.user_id);
  const limits = getPlanLimits(ownerPlan);

  const supabase = await createClient();
  const [{ data: targets }, { data: recentRuns }, { data: surfaces }, { data: recentProdDeploys }] =
    await Promise.all([
      supabase
        .from("check_targets")
        .select(
          "id, project_id, url, kind, expect_status, expect_contains, expect_not_contains, enabled, created_at, last_outcome, assertions, request_header_configured, silenced_until",
        )
        .eq("project_id", projectId)
        .order("created_at"),
      supabase
        .from("check_runs")
        .select(
          "target_id, outcome, started_at, http_status, ttfb_ms, fingerprint, details",
        )
        .eq("project_id", projectId)
        .order("started_at", { ascending: false })
        .limit(200),
      // V6 (ia-moderne backlog): last-seen h1 + whether it mutated,
      // per target.
      supabase.from("page_surfaces").select("target_id, h1, mutated_at").eq("project_id", projectId),
      // The 2 most recent production deploys — mutated_at is written
      // *during* runProjectChecks, a moment before deploy_events' own
      // started_at is inserted, so "mutated since the last deploy" has to
      // be read as "mutated after the *previous* one" rather than
      // compared straight against the latest row's own timestamp.
      supabase
        .from("deploy_events")
        .select("started_at")
        .eq("project_id", projectId)
        .eq("kind", "production")
        .order("started_at", { ascending: false })
        .limit(2),
    ]);

  const latestRunByTarget = new Map<string, RunRow>();
  for (const run of (recentRuns ?? []) as RunRow[]) {
    if (!latestRunByTarget.has(run.target_id)) {
      latestRunByTarget.set(run.target_id, run);
    }
  }

  const surfaceByTarget = new Map(
    (surfaces ?? []).map((s) => [s.target_id as string, s]),
  );
  // The deploy before the latest one, if any — a mutation timestamped
  // any time after that (including a few ms before the latest deploy's
  // own started_at) counts as "since the last deploy".
  const previousDeployAt = recentProdDeploys?.[1]?.started_at
    ? new Date(recentProdDeploys[1].started_at).getTime()
    : null;
  const hasProdDeploy = !!recentProdDeploys?.[0];

  const allTargets = targets ?? [];
  const activeKind =
    kindFilter && (KIND_FILTERS as readonly string[]).includes(kindFilter)
      ? kindFilter
      : null;
  const activeStatus = statusFilter === "fail" ? "fail" : null;

  const filteredTargets = allTargets.filter((target) => {
    if (activeKind && target.kind !== activeKind) return false;
    if (activeStatus === "fail") {
      const run = latestRunByTarget.get(target.id);
      const isFailing = run && (run.outcome === "fail" || run.outcome === "error");
      if (!isFailing) return false;
    }
    return true;
  });

  const baseHref = `/app/${projectId}/urls`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">URLs surveillées</h1>
          <p className="text-sm text-muted-foreground">
            {allTargets.length}/{limits.urls} URLs vérifiées après chaque déploiement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddTargetForm projectId={projectId} />
          <MoneyPathDialog projectId={projectId} baseUrl={project.base_url} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip href={baseHref} active={!activeKind && !activeStatus}>
          Tous
        </FilterChip>
        {KIND_FILTERS.map((k) => (
          <FilterChip key={k} href={`${baseHref}?kind=${k}`} active={activeKind === k}>
            {k}
          </FilterChip>
        ))}
        <FilterChip href={`${baseHref}?status=fail`} active={activeStatus === "fail"}>
          En échec
        </FilterChip>
      </div>

      {filteredTargets.length > 0 ? (
        // S7 (site backlog): stacked cards below md, a real table from md
        // up (native <table>/<td> so colSpan on the failure-details row
        // still works at md+) — a 6-column table doesn't survive a 390px
        // viewport.
        <div className="md:overflow-x-auto md:rounded-xl md:border md:border-border">
          <table className="flex flex-col gap-3 md:table md:w-full md:min-w-[640px] md:border-collapse">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">État</th>
                <th className="px-3 py-2 font-medium">URL</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Dernière vérif</th>
                <th className="px-3 py-2 font-medium">TTFB</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="flex flex-col gap-3 md:table-row-group">
              {filteredTargets.map((target) => {
                const run = latestRunByTarget.get(target.id);
                const isFailing =
                  run && (run.outcome === "fail" || run.outcome === "error");
                const surface = surfaceByTarget.get(target.id);
                const isMutatedSinceDeploy =
                  !!surface?.mutated_at &&
                  hasProdDeploy &&
                  (previousDeployAt === null ||
                    new Date(surface.mutated_at).getTime() >= previousDeployAt);

                return (
                  <Fragment key={target.id}>
                    <tr className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 md:table-row md:rounded-none md:border-0 md:border-b md:border-border md:bg-transparent md:p-0">
                      <td className="flex items-center justify-between gap-2 md:table-cell md:px-3 md:py-2 md:align-middle">
                        <StatusDot status={run?.outcome ?? null} />
                        <div className="md:hidden">
                          <TargetActionsMenu
                            projectId={projectId}
                            targetId={target.id}
                            url={target.url}
                            enabled={target.enabled}
                            silenced={
                              !!target.silenced_until &&
                              new Date(target.silenced_until).getTime() > Date.now()
                            }
                          />
                        </div>
                      </td>
                      <td className="min-w-0 md:table-cell md:px-3 md:py-2 md:align-middle">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Link
                            href={`/app/${projectId}/${target.id}`}
                            className="truncate font-mono text-sm hover:underline"
                          >
                            {target.url}
                          </Link>
                          <a
                            href={target.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={`Ouvrir ${target.url} dans un nouvel onglet`}
                          >
                            <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                          {isMutatedSinceDeploy && (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-amber-500"
                              title="Contenu modifié depuis le dernier déploiement"
                              aria-label="Contenu modifié depuis le dernier déploiement"
                            />
                          )}
                        </div>
                        {surface?.h1 && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            « {surface.h1} »
                          </p>
                        )}
                      </td>
                      <td className="flex items-center justify-between text-sm text-muted-foreground md:table-cell md:px-3 md:py-2 md:align-middle">
                        <span className="text-xs text-muted-foreground md:hidden">Type</span>
                        {target.kind}
                      </td>
                      <td className="flex items-center justify-between text-sm text-muted-foreground md:table-cell md:px-3 md:py-2 md:align-middle">
                        <span className="text-xs text-muted-foreground md:hidden">Dernière vérif</span>
                        {run
                          ? new Date(run.started_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Jamais vérifié"}
                      </td>
                      <td className="flex items-center justify-between text-sm text-muted-foreground md:table-cell md:px-3 md:py-2 md:align-middle">
                        <span className="text-xs text-muted-foreground md:hidden">TTFB</span>
                        {run?.ttfb_ms != null ? `${run.ttfb_ms} ms` : "—"}
                      </td>
                      <td className="hidden md:table-cell md:px-3 md:py-2 md:align-middle">
                        <TargetActionsMenu
                          projectId={projectId}
                          targetId={target.id}
                          url={target.url}
                          enabled={target.enabled}
                          silenced={
                            !!target.silenced_until &&
                            new Date(target.silenced_until).getTime() > Date.now()
                          }
                        />
                      </td>
                    </tr>
                    {isFailing && run?.details && (
                      <tr className="block md:table-row">
                        <td colSpan={6} className="block pb-1 md:table-cell md:px-3 md:pb-3">
                          <FailureDetails
                            details={run.details}
                            httpStatus={run.http_status}
                            expectStatus={target.expect_status}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <Link2 className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {allTargets.length === 0
              ? "Aucune URL surveillée pour le moment — ajoutez-en une ci-dessus pour démarrer."
              : "Aucune URL ne correspond à ce filtre."}
          </p>
        </div>
      )}
    </div>
  );
}
