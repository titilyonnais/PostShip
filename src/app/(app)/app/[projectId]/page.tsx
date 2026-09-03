import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Coins,
  Rocket,
  ScanSearch,
  ShieldAlert,
  Siren,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusDot } from "@/components/status-dot";
import { type CheckRunDetails } from "@/components/failure-details";
import { createClient } from "@/lib/db/server";
import { getAuthUser, getProfile, getProject } from "@/lib/db/loaders";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { getUptimeStats } from "@/lib/uptime";
import { getReliability } from "@/lib/reliability";
import { ReliabilityHeatmap } from "./reliability-heatmap";
import { ScanLaunchForm } from "./scan-launch-form";

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

  const project = await getProject(projectId);
  if (!project) notFound();

  const supabase = await createClient();

  const [
    user,
    { data: targets },
    { data: recentRuns },
    uptime,
    { count: urlCount },
    { data: latestScan },
    { data: lastDeploy },
    reliability,
  ] = await Promise.all([
    getAuthUser(),
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
    getUptimeStats(supabase, projectId),
    supabase.from("check_targets").select("id", { count: "exact", head: true }),
    supabase
      .from("site_scans")
      .select("id, status, pages_scanned, total_pages, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("deploy_events")
      .select("provider, kind, outcome, started_at")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getReliability(supabase, projectId),
  ]);

  const profile = user ? await getProfile(user.id) : null;
  const plan = (profile?.plan as Plan) ?? "free";
  const limits = getPlanLimits(plan);
  const tokenBalance = profile?.token_balance ?? 0;

  const latestRunByTarget = new Map<string, RunRow>();
  for (const run of (recentRuns ?? []) as RunRow[]) {
    if (!latestRunByTarget.has(run.target_id)) {
      latestRunByTarget.set(run.target_id, run);
    }
  }

  const urlsUsed = urlCount ?? 0;
  const nearUrlLimit = urlsUsed >= limits.urls * 0.8;

  const expiringSslTargets = (targets ?? []).filter((target) => {
    if (target.kind !== "ssl") return false;
    const run = latestRunByTarget.get(target.id);
    const days = run?.details?.daysRemaining;
    return typeof days === "number" && days < 14;
  });

  const scanActive =
    latestScan?.status === "queued" || latestScan?.status === "running";

  const backTo = `/app/${projectId}`;

  const openTargets = (targets ?? []).filter(
    (t) => t.last_outcome === "fail" || t.last_outcome === "error",
  );
  const openIncidentCount = openTargets.length;
  const botConnected = project.telegram_configured || project.discord_webhook_configured;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/${projectId}/incidents`}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <Siren className="size-3.5" aria-hidden="true" />
            {openIncidentCount > 0
              ? `${openIncidentCount} incident(s) ouvert(s)`
              : "Aucun incident ouvert"}
          </Link>
          <Link
            href={`/app/${projectId}/deploys`}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <Rocket className="size-3.5" aria-hidden="true" />
            {lastDeploy
              ? `Dernier deploy : ${lastDeploy.outcome === "fail" ? "échec" : "OK"}`
              : "Aucun deploy suivi"}
          </Link>
          <Link
            href={`/app/${projectId}/settings?tab=bot`}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <Bot className="size-3.5" aria-hidden="true" />
            {botConnected ? "Bot connecté" : "Bot non connecté"}
          </Link>
        </div>

        <Link
          href={`/app/${projectId}/urls`}
          className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Voir toutes les URLs ({(targets ?? []).length}/{limits.urls}) →
        </Link>

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

        <ReliabilityHeatmap
          heatmap={reliability.heatmap}
          mttrMinutes={reliability.mttrMinutes}
          incidents30d={reliability.incidents30d}
        />

        <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Ouverts
            </h2>
            <Link
              href={`/app/${projectId}/incidents`}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Voir les incidents
            </Link>
          </div>
          {openTargets.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {openTargets.slice(0, 5).map((target) => (
                <li key={target.id}>
                  <Link
                    href={`/app/${projectId}/${target.id}`}
                    className="flex min-w-0 items-center gap-2 text-sm hover:underline"
                  >
                    <StatusDot status={target.last_outcome} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {target.url}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun incident ouvert.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 rounded-md border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Dernier déploiement
            </h2>
            <Link
              href={`/app/${projectId}/deploys`}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Historique
            </Link>
          </div>
          {lastDeploy ? (
            <p className="flex items-center gap-2 text-sm">
              <StatusDot status={lastDeploy.outcome ?? null} />
              <span className="text-muted-foreground">
                {lastDeploy.provider} · {lastDeploy.kind === "preview" ? "preview" : "prod"} ·{" "}
                {new Date(lastDeploy.started_at).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun déploiement suivi pour le moment.
            </p>
          )}
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
