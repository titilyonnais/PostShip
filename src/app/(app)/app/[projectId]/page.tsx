import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  Play,
  RotateCw,
  Rocket,
  ShieldAlert,
  Trash2,
  Webhook,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/status-dot";
import { SubmitButton } from "@/components/submit-button";
import { FailureDetails, type CheckRunDetails } from "@/components/failure-details";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { getUptimeStats } from "@/lib/uptime";
import { deleteProject, renameProject } from "../actions";
import { AddTargetForm } from "./add-target-form";
import { ProjectTabs } from "./project-tabs";
import {
  runProjectNow,
  runTargetNow,
  setDiscordWebhook,
  setVercelHookSecret,
  toggleTarget,
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

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; success?: string; tab?: string }>;
}) {
  const { projectId } = await params;
  const { error, success, tab } = await searchParams;

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
    .select("plan")
    .eq("id", user?.id)
    .single();
  const plan = (profile?.plan as Plan) ?? "free";
  const limits = getPlanLimits(plan);

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
  const formatPct = (pct: number | null) =>
    pct === null ? "—" : `${pct.toFixed(1)}%`;

  // RLS scopes this to the current user's own targets across all projects,
  // same query addTarget uses to enforce the plan limit.
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-[#3fb950]">
          {success}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">
            {project.base_url}
          </p>
        </div>
        <div className="shrink-0">
          <form action={runProjectNow.bind(null, project.id)}>
            <SubmitButton pendingText="Vérification en cours...">
              <Play className="size-3.5" aria-hidden="true" />
              Lancer maintenant
            </SubmitButton>
          </form>
        </div>
      </div>

      <ProjectTabs
        defaultTab={tab}
        overview={
          <div className="flex flex-col gap-6">
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
                  <Link href="/app/billing" className="underline underline-offset-2">
                    Passer à un plan supérieur
                  </Link>
                </span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Disponibilité 24h</p>
                <p className="mt-1 font-mono text-xl">{formatPct(uptime.pct24h)}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Disponibilité 7j</p>
                <p className="mt-1 font-mono text-xl">{formatPct(uptime.pct7d)}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Disponibilité 30j</p>
                <p className="mt-1 font-mono text-xl">{formatPct(uptime.pct30d)}</p>
              </div>
            </div>

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
                            <form action={runTargetNow.bind(null, projectId, target.id)}>
                              <SubmitButton size="sm" variant="ghost" pendingText="...">
                                <RotateCw className="size-3.5" aria-hidden="true" />
                                <span className="sr-only"> Relancer {target.url}</span>
                              </SubmitButton>
                            </form>
                            <form
                              action={toggleTarget.bind(
                                null,
                                projectId,
                                target.id,
                                target.enabled,
                              )}
                            >
                              <SubmitButton size="sm" variant="ghost" pendingText="...">
                                {target.enabled ? "Désactiver" : "Activer"}
                                <span className="sr-only"> {target.url}</span>
                              </SubmitButton>
                            </form>
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
        }
        settings={
          <div className="flex flex-col gap-6">
            <form
              action={renameProject.bind(null, project.id)}
              className="flex max-w-sm items-end gap-2"
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
            </form>

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
                    <form
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
                    </form>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Disponible à partir du plan Solo.{" "}
                    <Link
                      href="/app/billing"
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
                    <form
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
                    </form>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Disponible à partir du plan Solo.{" "}
                    <Link
                      href="/app/billing"
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
