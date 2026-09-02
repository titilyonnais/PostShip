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
  const [{ data: targets }, { data: recentRuns }] = await Promise.all([
    supabase
      .from("check_targets")
      .select(
        "id, project_id, url, kind, expect_status, expect_contains, expect_not_contains, enabled, created_at, last_outcome, assertions, request_header_configured",
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
  ]);

  const latestRunByTarget = new Map<string, RunRow>();
  for (const run of (recentRuns ?? []) as RunRow[]) {
    if (!latestRunByTarget.has(run.target_id)) {
      latestRunByTarget.set(run.target_id, run);
    }
  }

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-medium">URLs surveillées</h1>
          <span className="text-xs text-muted-foreground">
            {allTargets.length}/{limits.urls}
          </span>
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
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">État</th>
                <th className="px-3 py-2 font-medium">URL</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Dernière vérif</th>
                <th className="px-3 py-2 font-medium">TTFB</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredTargets.map((target) => {
                const run = latestRunByTarget.get(target.id);
                const isFailing =
                  run && (run.outcome === "fail" || run.outcome === "error");

                return (
                  <Fragment key={target.id}>
                    <tr className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <StatusDot status={run?.outcome ?? null} />
                      </td>
                      <td className="min-w-0 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Link
                            href={`/app/${projectId}/${target.id}`}
                            className="truncate font-mono text-xs hover:underline"
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
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {target.kind}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {run
                          ? new Date(run.started_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Jamais vérifié"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {run?.ttfb_ms != null ? `${run.ttfb_ms} ms` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <TargetActionsMenu
                          projectId={projectId}
                          targetId={target.id}
                          url={target.url}
                          enabled={target.enabled}
                        />
                      </td>
                    </tr>
                    {isFailing && run?.details && (
                      <tr className="border-b border-border last:border-0">
                        <td colSpan={6} className="px-3 pb-3">
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
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-10 text-center">
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
