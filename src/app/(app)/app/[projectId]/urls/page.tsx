import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ExternalLink, Gauge, Link2 } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { TargetKindBadge, TARGET_KIND_LABEL } from "@/components/target-kind-badge";
import { FailureDetails, type CheckRunDetails } from "@/components/failure-details";
import { createClient } from "@/lib/db/server";
import { getProject, getProjectOwnerPlan, getViewerTimezone } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { formatDateTime } from "@/lib/timezone";
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
  searchParams: Promise<{ kind?: string; status?: string; add?: string }>;
}) {
  const { projectId } = await params;
  const { kind: kindFilter, status: statusFilter, add } = await searchParams;

  const project = await getProject(projectId);
  if (!project) notFound();

  const ownerPlan = await getProjectOwnerPlan(project.user_id);
  const limits = getPlanLimits(ownerPlan);
  const timezone = await getViewerTimezone();

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
          <AddTargetForm projectId={projectId} autoFocus={add === "1"} />
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
        <ul className="flex flex-col gap-3">
          {filteredTargets.map((target, index) => {
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
              <li
                key={target.id}
                className="rounded-2xl border border-border bg-card p-4 transition-colors duration-200 hover:border-foreground/20 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <TargetKindBadge kind={target.kind} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/app/${projectId}/${target.id}`}
                          className="min-w-0 max-w-full truncate font-mono text-sm font-medium hover:underline"
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
                        <p className="max-w-full truncate text-xs text-muted-foreground">
                          « {surface.h1} »
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <StatusDot status={run?.outcome ?? null} />
                        <span>{TARGET_KIND_LABEL[target.kind] ?? target.kind}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />
                          {run
                            ? formatDateTime(run.started_at, timezone, {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Jamais vérifié"}
                        </span>
                        {run?.ttfb_ms != null && (
                          <span className="inline-flex items-center gap-1">
                            <Gauge className="size-3" aria-hidden="true" />
                            {run.ttfb_ms} ms
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
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
                {isFailing && run?.details && (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <FailureDetails
                      details={run.details}
                      httpStatus={run.http_status}
                      expectStatus={target.expect_status}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
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
