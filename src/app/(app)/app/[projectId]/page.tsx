import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Coins,
  ExternalLink,
  MessageSquare,
  PauseCircle,
  Play,
  PlayCircle,
  Rocket,
  ScanSearch,
  ShieldAlert,
  Trash2,
  Webhook,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/status-dot";
import { SubmitButton } from "@/components/submit-button";
import { FailureDetails, type CheckRunDetails } from "@/components/failure-details";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { getUptimeStats } from "@/lib/uptime";
import { deleteProject, renameProject, toggleProjectPause, updateProjectBaseUrl } from "../actions";
import { AddTargetForm } from "./add-target-form";
import { ProjectTabs } from "./project-tabs";
import { TargetActionsMenu } from "./target-actions-menu";
import { startSiteScan } from "./scan-actions";
import {
  runProjectNow,
  setDiscordWebhook,
  setVercelHookSecret,
} from "./actions";

type RunRow = {
  target_id: string;
  outcome: string;
  started_at: string;
  http_status: number | null;
  ttfb_ms: number | null;
  fingerprint: string;
  details: CheckRunDetails | null;
};

const SCAN_STATUS_LABEL: Record<string, string> = {
  queued: "En attente",
  running: "En cours",
  done: "Terminé",
  error: "Erreur",
};

function formatPct(window: { pct: number | null; count: number }): string {
  if (window.pct === null) return "—";
  return `${window.pct.toFixed(1)}%`;
}

export default async function ProjectPage({
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

  const { data: recentScans } = await supabase
    .from("site_scans")
    .select("id, seed_url, status, pages_scanned, pages_ok, pages_failed, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);

  const backTo = `/app/${projectId}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{project.name}</h1>
            {project.paused && (
              <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400">
                <PauseCircle className="size-3" aria-hidden="true" />
                En pause
              </Badge>
            )}
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {project.base_url}
          </p>
        </div>
        <div className="shrink-0">
          <ActionForm action={runProjectNow.bind(null, project.id)}>
            <SubmitButton pendingText="Vérification en cours...">
              <Play className="size-3.5" aria-hidden="true" />
              Lancer maintenant
            </SubmitButton>
          </ActionForm>
        </div>
      </div>

      <ProjectTabs
        overview={
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
                % de vérifications réussies dans chaque fenêtre. Les valeurs
                se ressemblent tant que votre historique est plus jeune que
                7 ou 30 jours — c&apos;est normal, il n&apos;y a simplement
                pas encore assez de données pour les distinguer.
              </p>

              <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
                <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <ScanSearch className="size-3.5" aria-hidden="true" />
                  Scanner tout le site
                </h2>
                <p className="text-xs text-muted-foreground">
                  Découvre et vérifie l&apos;état de chaque page du site à
                  l&apos;instant T (jusqu&apos;à 500 pages). Ne modifie pas
                  vos URLs surveillées — c&apos;est un rapport ponctuel.
                  Coûte 1 token par page.
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Coins className="size-3.5" aria-hidden="true" />
                  Solde : {tokenBalance} token(s)
                  {tokenBalance === 0 && (
                    <Link
                      href={`/app/account?tab=tokens&from=${encodeURIComponent(backTo)}`}
                      className="text-foreground underline underline-offset-2"
                    >
                      en acheter
                    </Link>
                  )}
                </p>
                <ActionForm
                  action={startSiteScan.bind(null, projectId)}
                  className="flex gap-2"
                >
                  <label htmlFor="seed_url" className="sr-only">
                    URL de départ
                  </label>
                  <Input
                    id="seed_url"
                    name="seed_url"
                    type="url"
                    defaultValue={project.base_url}
                    className="flex-1"
                  />
                  <SubmitButton
                    variant="outline"
                    disabled={tokenBalance < 1}
                    pendingText="..."
                  >
                    Lancer
                  </SubmitButton>
                </ActionForm>

                {recentScans && recentScans.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
                    {recentScans.map((scan) => (
                      <li key={scan.id} className="text-xs">
                        <Link
                          href={`/app/${projectId}/scans/${scan.id}`}
                          className="flex items-center justify-between gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <span className="truncate">
                            {new Date(scan.created_at).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="shrink-0">
                            {SCAN_STATUS_LABEL[scan.status] ?? scan.status}
                            {scan.status !== "queued" &&
                              ` — ${scan.pages_ok}/${scan.pages_scanned} OK`}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        }
        settings={
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <ActionForm
                action={renameProject.bind(null, project.id)}
                className="flex items-end gap-2"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor="project-name"
                    className="text-xs text-muted-foreground"
                  >
                    Nom du projet
                  </label>
                  <Input id="project-name" name="name" defaultValue={project.name} />
                </div>
                <SubmitButton variant="outline" pendingText="...">
                  Renommer
                </SubmitButton>
              </ActionForm>

              <ActionForm
                action={updateProjectBaseUrl.bind(null, project.id)}
                className="flex items-end gap-2"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor="project-base-url"
                    className="text-xs text-muted-foreground"
                  >
                    URL de base
                  </label>
                  <Input
                    id="project-base-url"
                    name="base_url"
                    type="url"
                    defaultValue={project.base_url}
                  />
                </div>
                <SubmitButton variant="outline" pendingText="...">
                  Enregistrer
                </SubmitButton>
              </ActionForm>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {project.paused ? (
                  <PauseCircle className="size-3.5" aria-hidden="true" />
                ) : (
                  <PlayCircle className="size-3.5" aria-hidden="true" />
                )}
                Mode maintenance
              </h2>
              <p className="text-xs text-muted-foreground">
                Suspend les vérifications automatiques et les alertes pour ce
                projet — utile pendant un déploiement planifié. &laquo;
                Lancer maintenant &raquo; reste disponible pendant la pause.
              </p>
              <div>
                <ActionForm
                  action={toggleProjectPause.bind(null, project.id, project.paused)}
                >
                  <SubmitButton variant="outline" pendingText="...">
                    {project.paused
                      ? "Réactiver les vérifications"
                      : "Activer le mode maintenance"}
                  </SubmitButton>
                </ActionForm>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
                <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  Alertes Discord
                </h2>
                {limits.discord ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Collez l&apos;URL d&apos;un webhook Discord (Paramètres
                      du salon → Intégrations → Webhooks) pour recevoir les
                      alertes en plus de l&apos;email. Laissez vide et
                      enregistrez pour désactiver.
                    </p>
                    <ActionForm
                      action={setDiscordWebhook.bind(null, projectId)}
                      className="flex gap-2"
                    >
                      <label htmlFor="discord-webhook" className="sr-only">
                        URL du webhook Discord
                      </label>
                      <Input
                        id="discord-webhook"
                        name="discord_webhook_url"
                        type="url"
                        defaultValue={project.discord_webhook_url ?? ""}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="flex-1"
                      />
                      <SubmitButton variant="outline" pendingText="Enregistrement...">
                        Enregistrer
                      </SubmitButton>
                    </ActionForm>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Disponible à partir du plan Solo.{" "}
                    <Link
                      href={`/app/billing?from=${encodeURIComponent(backTo)}`}
                      className="text-foreground underline underline-offset-2"
                    >
                      Passer à Solo/Team
                    </Link>
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
                <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Webhook className="size-3.5" aria-hidden="true" />
                  Webhook Vercel
                </h2>
                {limits.vercelHook ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Dans Vercel, créez un webhook sur l&apos;événement{" "}
                      <code className="rounded-sm bg-secondary px-1 py-0.5 font-mono">
                        deployment.ready
                      </code>{" "}
                      pointant vers l&apos;URL ci-dessous, puis collez le
                      secret généré par Vercel.
                    </p>
                    <p className="break-all rounded-sm bg-secondary px-2 py-1 font-mono text-xs text-muted-foreground">
                      {process.env.NEXT_PUBLIC_APP_URL}/api/vercel/deploy/
                      {projectId}
                    </p>
                    <ActionForm
                      action={setVercelHookSecret.bind(null, projectId)}
                      className="flex gap-2"
                    >
                      <label htmlFor="vercel-secret" className="sr-only">
                        Secret du webhook Vercel
                      </label>
                      <Input
                        id="vercel-secret"
                        name="vercel_hook_secret"
                        type="password"
                        placeholder={
                          project.vercel_hook_secret
                            ? "•••••••• (déjà configuré)"
                            : "Secret Vercel"
                        }
                        className="flex-1"
                      />
                      <SubmitButton variant="outline" pendingText="Enregistrement...">
                        Enregistrer
                      </SubmitButton>
                    </ActionForm>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Disponible à partir du plan Solo.{" "}
                    <Link
                      href={`/app/billing?from=${encodeURIComponent(backTo)}`}
                      className="text-foreground underline underline-offset-2"
                    >
                      Passer à Solo/Team
                    </Link>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-destructive uppercase">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                Zone dangereuse
              </h2>
              <p className="text-xs text-muted-foreground">
                Supprime définitivement ce projet, ses URLs surveillées et
                tout l&apos;historique de vérification associé.
              </p>
              <div>
                <form action={deleteProject.bind(null, project.id)}>
                  <SubmitButton variant="destructive" pendingText="Suppression...">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Supprimer le projet
                  </SubmitButton>
                </form>
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}
