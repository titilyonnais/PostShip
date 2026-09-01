import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Coins,
  ExternalLink,
  Rocket,
  ScanSearch,
  ShieldAlert,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/status-dot";
import { FailureDetails, type CheckRunDetails } from "@/components/failure-details";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { getUptimeStats } from "@/lib/uptime";
import { AddTargetForm } from "./add-target-form";
import { ScanLaunchForm } from "./scan-launch-form";
import { TargetActionsMenu } from "./target-actions-menu";

type RunRow = {
  target_id: string;
  outcome: string;
  started_at: string;
  http_status: number | null;
  ttfb_ms: number | null;
  fingerprint: string;
  details: CheckRunDetails | null;
};

function formatPct(window: { pct: number | null; count: number }): string {
  if (window.pct === null) return "—";
  return `${window.pct.toFixed(1)}%`;
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, token_balance")
    .eq("id", user?.id)
    .single();
  const plan = (profile?.plan as Plan) ?? "free";
  const limits = getPlanLimits(plan);
  const tokenBalance = profile?.token_balance ?? 0;

  const { data: targets } = await supabase
    .from("check_targets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");

  const { data: recentRuns } = await supabase
    .from("check_runs")
    .select("target_id, outcome, started_at, http_status, ttfb_ms, fingerprint, details")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(200);

  const latestRunByTarget = new Map<string, RunRow>();
  for (const run of (recentRuns ?? []) as RunRow[]) {
    if (!latestRunByTarget.has(run.target_id)) {
      latestRunByTarget.set(run.target_id, run);
    }
  }

  const uptime = await getUptimeStats(supabase, projectId);

  const { count: urlCount } = await supabase
    .from("check_targets")
    .select("id", { count: "exact", head: true });

  const urlsUsed = urlCount ?? 0;
  const nearUrlLimit = urlsUsed >= limits.urls * 0.8;

  const expiringSslTargets = (targets ?? []).filter((target) => {
    if (target.kind !== "ssl") return false;
    const run = latestRunByTarget.get(target.id);
    const days = run?.details?.daysRemaining;
    return typeof days === "number" && days < 14;
  });

  const { data: latestScan } = await supabase
    .from("site_scans")
    .select("id, status, pages_scanned, total_pages, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const scanActive =
    latestScan?.status === "queued" || latestScan?.status === "running";

  const backTo = `/app/${projectId}`;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        {expiringSslTargets.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Certificat SSL bientôt expiré pour{" "}
              {expiringSslTargets.map((t) => t.url).join(", ")}.
            </span>
          </div>
        )}
        {nearUrlLimit && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {urlsUsed}/{limits.urls} URLs utilisées sur votre plan.{" "}
              <Link
                href={`/app/billing?from=${encodeURIComponent(backTo)}`}
                className="underline underline-offset-2"
              >
                Passer à un plan supérieur
              </Link>
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              URLs surveillées
            </h2>
            <span className="text-xs text-muted-foreground">
              {urlsUsed}/{limits.urls}
            </span>
          </div>

          {targets && targets.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {targets.map((target) => {
                const run = latestRunByTarget.get(target.id);
                const isFailing =
                  run && (run.outcome === "fail" || run.outcome === "error");

                return (
                  <li
                    key={target.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:border-foreground/20"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-xs text-muted-foreground">
                          [{target.kind}]
                        </span>
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
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        {run ? (
                          <span className="text-xs text-muted-foreground">
                            {run.http_status ?? "—"} ·{" "}
                            {run.ttfb_ms != null ? `${run.ttfb_ms} ms` : "—"} ·{" "}
                            {new Date(run.started_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Jamais vérifié
                          </span>
                        )}
                        <StatusDot status={run?.outcome ?? null} />
                        <Badge variant={target.enabled ? "default" : "outline"}>
                          {target.enabled ? "Actif" : "Désactivé"}
                        </Badge>
                        <TargetActionsMenu
                          projectId={projectId}
                          targetId={target.id}
                          url={target.url}
                          enabled={target.enabled}
                        />
                      </div>
                    </div>

                    {isFailing && run?.details && (
                      <FailureDetails
                        details={run.details}
                        httpStatus={run.http_status}
                        expectStatus={target.expect_status}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-10 text-center">
              <Rocket className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Aucune URL surveillée pour le moment — ajoutez-en une
                ci-dessous pour démarrer.
              </p>
            </div>
          )}

          <AddTargetForm projectId={projectId} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              Taux de réussite — 24h
            </p>
            <p className="mt-1 font-mono text-lg">{formatPct(uptime.h24)}</p>
            <p className="text-[0.7rem] text-muted-foreground">
              {uptime.h24.count} vérification(s)
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              Taux de réussite — 7j
            </p>
            <p className="mt-1 font-mono text-lg">{formatPct(uptime.d7)}</p>
            <p className="text-[0.7rem] text-muted-foreground">
              {uptime.d7.count} vérification(s)
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              Taux de réussite — 30j
            </p>
            <p className="mt-1 font-mono text-lg">{formatPct(uptime.d30)}</p>
            <p className="text-[0.7rem] text-muted-foreground">
              {uptime.d30.count} vérification(s)
            </p>
          </div>
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          % de vérifications réussies dans chaque fenêtre. Les valeurs se
          ressemblent tant que votre historique est plus jeune que 7 ou 30
          jours — c&apos;est normal, il n&apos;y a simplement pas encore
          assez de données pour les distinguer.
        </p>

        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
          {scanActive && <AutoRefresh intervalMs={5000} />}
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <ScanSearch className="size-3.5" aria-hidden="true" />
              Scanner tout le site
            </h2>
            <Link
              href={`/app/${projectId}/scans`}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Historique
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Vérifie l&apos;état de chaque page (jusqu&apos;à 500) à
            l&apos;instant T — un rapport ponctuel, indépendant de vos URLs
            surveillées. 1 token/page, traité par lots toutes les ~5 min.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5" aria-hidden="true" />
            Solde : {tokenBalance} token(s)
            {tokenBalance === 0 && (
              <Link
                href={`/app/account/tokens?from=${encodeURIComponent(backTo)}`}
                className="text-foreground underline underline-offset-2"
              >
                en acheter
              </Link>
            )}
          </p>
          <ScanLaunchForm
            projectId={projectId}
            baseUrl={project.base_url}
            tokenBalance={tokenBalance}
          />

          {latestScan && (
            <Link
              href={`/app/${projectId}/scans/${latestScan.id}`}
              className="flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center justify-between gap-2">
                <span>Dernier scan</span>
                <span className="font-mono">
                  {latestScan.status === "queued"
                    ? "Découverte..."
                    : latestScan.status === "error"
                      ? "Erreur"
                      : `${latestScan.pages_scanned}/${latestScan.total_pages || "?"}`}
                </span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
