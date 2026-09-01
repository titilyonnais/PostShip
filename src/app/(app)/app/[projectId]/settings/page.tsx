import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Trash2,
  Webhook,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import {
  deleteProject,
  renameProject,
  toggleProjectPause,
  updateProjectBaseUrl,
} from "../../actions";
import { setDiscordWebhook, setVercelHookSecret } from "../actions";

export const metadata = {
  title: "Paramètres du projet",
};

export default async function ProjectSettingsPage({
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
    .select("plan")
    .eq("id", user?.id)
    .single();
  const plan = (profile?.plan as Plan) ?? "free";
  const limits = getPlanLimits(plan);
  const backTo = `/app/${projectId}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <ActionForm
          action={renameProject.bind(null, project.id)}
          className="flex items-end gap-2"
        >
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="project-name" className="text-xs text-muted-foreground">
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
          projet — utile pendant un déploiement planifié. &laquo; Lancer
          maintenant &raquo; reste disponible pendant la pause.
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
                Collez l&apos;URL d&apos;un webhook Discord (Paramètres du
                salon → Intégrations → Webhooks) pour recevoir les alertes en
                plus de l&apos;email. Laissez vide et enregistrez pour
                désactiver.
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
                pointant vers l&apos;URL ci-dessous, puis collez le secret
                généré par Vercel.
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
          Supprime définitivement ce projet, ses URLs surveillées et tout
          l&apos;historique de vérification associé.
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
  );
}
