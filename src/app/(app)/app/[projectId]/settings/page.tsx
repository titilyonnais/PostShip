import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Trash2,
  UserPlus,
  Webhook,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import {
  getAuthUser,
  getProject,
  getProjectMembers,
  getProjectOwnerPlan,
} from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import {
  deleteProject,
  renameProject,
  toggleProjectPause,
  updateProjectBaseUrl,
} from "../../actions";
import {
  disableDiscordWebhook,
  disableSlackWebhook,
  setCloudflareHookSecret,
  setDiscordWebhook,
  setNetlifyHookSecret,
  setSlackWebhook,
  setVercelHookSecret,
} from "../actions";
import {
  inviteProjectMember,
  leaveProject,
  removeProjectMember,
} from "../members-actions";
import type { ActionResult } from "@/lib/use-toast-action";

export const metadata = {
  title: "Paramètres du projet",
};

function DeployHookSection({
  title,
  routePath,
  instructions,
  action,
  inputName,
  configured,
}: {
  title: string;
  routePath: string;
  instructions: React.ReactNode;
  action: (
    prevState: ActionResult,
    formData: FormData,
  ) => Promise<ActionResult>;
  inputName: string;
  configured: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Webhook className="size-3.5" aria-hidden="true" />
        {title}
      </h2>
      <p className="text-xs text-muted-foreground">{instructions}</p>
      <p className="break-all rounded-sm bg-secondary px-2 py-1 font-mono text-xs text-muted-foreground">
        {process.env.NEXT_PUBLIC_APP_URL}
        {routePath}
      </p>
      <ActionForm action={action} className="flex gap-2">
        <label htmlFor={inputName} className="sr-only">
          Secret {title}
        </label>
        <Input
          id={inputName}
          name={inputName}
          type="password"
          placeholder={configured ? "•••••••• (déjà configuré)" : "Secret"}
          className="flex-1"
        />
        <SubmitButton variant="outline" pendingText="Enregistrement...">
          Enregistrer
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

function ChatWebhookSection({
  title,
  instructions,
  placeholder,
  action,
  disableAction,
  inputName,
  configured,
}: {
  title: string;
  instructions: React.ReactNode;
  placeholder: string;
  action: (
    prevState: ActionResult,
    formData: FormData,
  ) => Promise<ActionResult>;
  disableAction: (prevState: ActionResult) => Promise<ActionResult>;
  inputName: string;
  configured: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <MessageSquare className="size-3.5" aria-hidden="true" />
        {title}
      </h2>
      <p className="text-xs text-muted-foreground">{instructions}</p>
      <ActionForm action={action} className="flex gap-2">
        <label htmlFor={inputName} className="sr-only">
          URL du webhook {title}
        </label>
        <Input
          id={inputName}
          name={inputName}
          type="url"
          placeholder={configured ? "•••••••• (déjà configuré)" : placeholder}
          className="flex-1"
        />
        <SubmitButton variant="outline" pendingText="Enregistrement...">
          Enregistrer
        </SubmitButton>
      </ActionForm>
      {configured && (
        <ActionForm action={disableAction}>
          <SubmitButton
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            pendingText="..."
          >
            Désactiver
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [project, user] = await Promise.all([
    getProject(projectId),
    getAuthUser(),
  ]);

  if (!project) notFound();

  const isOwner = user?.id === project.user_id;

  // The project OWNER's plan gates its features (interval, Discord/Slack,
  // deploy hooks, collaborators) — never the current viewer's own plan,
  // which for a collaborator can be Free while the project itself is on
  // Team. See the comment on getProjectOwnerPlan.
  const [ownerPlan, members] = await Promise.all([
    getProjectOwnerPlan(project.user_id),
    isOwner ? getProjectMembers(projectId) : Promise.resolve([]),
  ]);
  const limits = getPlanLimits(ownerPlan);
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

      <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <MessageSquare className="size-3.5" aria-hidden="true" />
          Alertes chat
        </h2>
        {limits.chatWebhooks ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ChatWebhookSection
              title="Discord"
              instructions="Collez l'URL d'un webhook Discord (Paramètres du salon → Intégrations → Webhooks). Laissez le champ vide pour ne rien changer."
              placeholder="https://discord.com/api/webhooks/..."
              action={setDiscordWebhook.bind(null, projectId)}
              disableAction={disableDiscordWebhook.bind(null, projectId)}
              inputName="discord_webhook_url"
              configured={!!project.discord_webhook_configured}
            />
            <ChatWebhookSection
              title="Slack"
              instructions="Collez l'URL d'un webhook entrant Slack (créé depuis api.slack.com/apps → Incoming Webhooks). Laissez le champ vide pour ne rien changer."
              placeholder="https://hooks.slack.com/services/..."
              action={setSlackWebhook.bind(null, projectId)}
              disableAction={disableSlackWebhook.bind(null, projectId)}
              inputName="slack_webhook_url"
              configured={!!project.slack_webhook_configured}
            />
          </div>
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
          Vérification au déploiement
        </h2>
        {limits.deployHooks ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <DeployHookSection
              title="Vercel"
              routePath={`/api/vercel/deploy/${projectId}`}
              instructions={
                <>
                  Dans Vercel, créez un webhook sur l&apos;événement{" "}
                  <code className="rounded-sm bg-secondary px-1 py-0.5 font-mono">
                    deployment.ready
                  </code>{" "}
                  pointant vers l&apos;URL ci-dessous, puis collez le secret
                  généré par Vercel.
                </>
              }
              action={setVercelHookSecret.bind(null, projectId)}
              inputName="vercel_hook_secret"
              configured={!!project.vercel_hook_configured}
            />
            <DeployHookSection
              title="Netlify"
              routePath={`/api/netlify/deploy/${projectId}`}
              instructions={
                <>
                  Dans Netlify : Project configuration → Notifications →
                  Deploy notifications → Add notification → Outgoing webhook,
                  événement &laquo; Deploy succeeded &raquo;, URL ci-dessous.
                  Générez un secret et collez-le ici — c&apos;est le même
                  qu&apos;à saisir dans le champ &laquo; JWS secret token
                  &raquo; côté Netlify.
                </>
              }
              action={setNetlifyHookSecret.bind(null, projectId)}
              inputName="netlify_hook_secret"
              configured={!!project.netlify_hook_configured}
            />
            <DeployHookSection
              title="Cloudflare Pages"
              routePath={`/api/cloudflare/deploy/${projectId}`}
              instructions={
                <>
                  Dans Cloudflare : Notifications → Destinations → Webhooks,
                  ajoutez l&apos;URL ci-dessous et copiez le secret généré par
                  Cloudflare. Puis créez une Notification sur &laquo; Pages
                  Deployment Success &raquo; pointant vers ce webhook.
                </>
              }
              action={setCloudflareHookSecret.bind(null, projectId)}
              inputName="cloudflare_hook_secret"
              configured={!!project.cloudflare_hook_configured}
            />
          </div>
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

      {isOwner && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <UserPlus className="size-3.5" aria-hidden="true" />
            Collaborateurs
          </h2>
          {limits.teamMembers ? (
            <>
              <p className="text-xs text-muted-foreground">
                Un collaborateur accède aux URLs, alertes et webhooks de ce
                projet, mais pas à votre facturation. Pas besoin qu&apos;il
                ait déjà un compte PostShip.
              </p>
              <ActionForm
                action={inviteProjectMember.bind(null, projectId)}
                className="flex gap-2"
              >
                <label htmlFor="member-email" className="sr-only">
                  Email à inviter
                </label>
                <Input
                  id="member-email"
                  name="email"
                  type="email"
                  placeholder="collegue@exemple.com"
                  className="flex-1"
                />
                <SubmitButton variant="outline" pendingText="Envoi...">
                  Inviter
                </SubmitButton>
              </ActionForm>
              {members.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-2 rounded-sm bg-secondary px-2 py-1.5 text-xs"
                    >
                      <span className="font-mono">{member.invited_email}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {member.status === "accepted"
                            ? "Actif"
                            : "Invitation en attente"}
                        </span>
                        <ActionForm
                          action={removeProjectMember.bind(
                            null,
                            projectId,
                            member.id,
                          )}
                        >
                          <SubmitButton
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-muted-foreground underline underline-offset-2"
                            pendingText="..."
                          >
                            Retirer
                          </SubmitButton>
                        </ActionForm>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Disponible à partir du plan Team.{" "}
              <Link
                href={`/app/billing?from=${encodeURIComponent(backTo)}`}
                className="text-foreground underline underline-offset-2"
              >
                Passer à Team
              </Link>
            </p>
          )}
        </div>
      )}

      {isOwner ? (
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
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <UserPlus className="size-3.5" aria-hidden="true" />
            Vous êtes collaborateur sur ce projet
          </h2>
          <p className="text-xs text-muted-foreground">
            Le propriétaire garde la main sur la facturation et la
            suppression du projet.
          </p>
          <div>
            <ActionForm action={leaveProject.bind(null, projectId)}>
              <SubmitButton variant="outline" pendingText="...">
                Quitter le projet
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      )}
    </div>
  );
}
