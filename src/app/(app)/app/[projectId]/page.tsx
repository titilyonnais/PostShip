import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/status-dot";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { deleteProject, renameProject } from "../actions";
import { AddTargetForm } from "./add-target-form";
import {
  runProjectNow,
  setDiscordWebhook,
  setVercelHookSecret,
  toggleTarget,
} from "./actions";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { projectId } = await params;
  const { error } = await searchParams;

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
  const hasVercelHook = getPlanLimits(plan).vercelHook;
  const hasDiscord = getPlanLimits(plan).discord;

  const { data: targets } = await supabase
    .from("check_targets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");

  const { data: recentRuns } = await supabase
    .from("check_runs")
    .select("target_id, outcome, started_at")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(200);

  const latestOutcomeByTarget = new Map<string, string>();
  for (const run of recentRuns ?? []) {
    if (!latestOutcomeByTarget.has(run.target_id)) {
      latestOutcomeByTarget.set(run.target_id, run.outcome);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">
            {project.base_url}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={runProjectNow.bind(null, project.id)}>
            <Button type="submit">Lancer maintenant</Button>
          </form>
          <form action={deleteProject.bind(null, project.id)}>
            <Button type="submit" variant="outline">
              Supprimer le projet
            </Button>
          </form>
        </div>
      </div>

      <form
        action={renameProject.bind(null, project.id)}
        className="flex max-w-sm gap-2"
      >
        <Input name="name" defaultValue={project.name} />
        <Button type="submit" variant="outline">
          Renommer
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          URLs surveillées
        </h2>

        {targets && targets.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {targets.map((target) => (
              <li
                key={target.id}
                className="flex items-center justify-between border border-border px-3 py-2"
              >
                <Link
                  href={`/app/${projectId}/${target.id}`}
                  className="flex items-center gap-2 font-mono text-sm hover:underline"
                >
                  <span className="text-xs text-muted-foreground">
                    [{target.kind}]
                  </span>
                  {target.url}
                </Link>
                <div className="flex items-center gap-3">
                  <StatusDot
                    status={latestOutcomeByTarget.get(target.id) ?? null}
                  />
                  <Badge variant={target.enabled ? "default" : "outline"}>
                    {target.enabled ? "Actif" : "Désactivé"}
                  </Badge>
                  <form
                    action={toggleTarget.bind(
                      null,
                      projectId,
                      target.id,
                      target.enabled,
                    )}
                  >
                    <Button type="submit" size="sm" variant="ghost">
                      {target.enabled ? "Désactiver" : "Activer"}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune URL surveillée pour le moment.
          </p>
        )}

        <AddTargetForm projectId={projectId} />
      </div>

      {hasDiscord && (
        <div className="flex flex-col gap-2 border border-border p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Alertes Discord
          </h2>
          <p className="text-xs text-muted-foreground">
            Collez l&apos;URL d&apos;un webhook Discord (Paramètres du salon
            → Intégrations → Webhooks) pour recevoir les alertes en plus de
            l&apos;email. Laissez vide et enregistrez pour désactiver.
          </p>
          <form
            action={setDiscordWebhook.bind(null, projectId)}
            className="flex max-w-sm gap-2"
          >
            <Input
              name="discord_webhook_url"
              type="url"
              defaultValue={project.discord_webhook_url ?? ""}
              placeholder="https://discord.com/api/webhooks/..."
            />
            <Button type="submit" variant="outline">
              Enregistrer
            </Button>
          </form>
        </div>
      )}

      {hasVercelHook && (
        <div className="flex flex-col gap-2 border border-border p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Webhook Vercel
          </h2>
          <p className="text-xs text-muted-foreground">
            Dans Vercel, créez un webhook sur l&apos;événement{" "}
            <code className="font-mono">deployment.ready</code> pointant vers
            l&apos;URL ci-dessous, puis collez le secret généré par Vercel.
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {process.env.NEXT_PUBLIC_APP_URL}/api/vercel/deploy/{projectId}
          </p>
          <form
            action={setVercelHookSecret.bind(null, projectId)}
            className="flex max-w-sm gap-2"
          >
            <Input
              name="vercel_hook_secret"
              type="password"
              placeholder={
                project.vercel_hook_secret ? "•••••••• (déjà configuré)" : "Secret Vercel"
              }
            />
            <Button type="submit" variant="outline">
              Enregistrer
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
