import Link from "next/link";
import { AlertTriangle, PauseCircle, PlayCircle, Trash2, UserPlus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteProject,
  renameProject,
  toggleProjectPause,
  updateProjectBaseUrl,
} from "../../actions";
import { leaveProject } from "../members-actions";

// V2 (ia-moderne backlog): the settings hub's default tab — project
// identity + maintenance mode, danger zone at the bottom (or "leave
// project" for a collaborator). No more domain-verification card (V4) —
// integrations/deploy hooks/badge live on their own pages, linked below.
export function GeneralTab({
  projectId,
  project,
  isOwner,
}: {
  projectId: string;
  project: { id: string; name: string; base_url: string; paused: boolean };
  isOwner: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">
        Webhooks de déploiement, alertes Discord/Slack/Telegram, GitHub et
        badge public ont leur propre page :{" "}
        <Link
          href={`/app/${projectId}/integrations`}
          className="text-foreground underline underline-offset-2"
        >
          Intégrations
        </Link>{" "}
        et{" "}
        <Link
          href={`/app/${projectId}/share`}
          className="text-foreground underline underline-offset-2"
        >
          Partage
        </Link>
        .
      </p>

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

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {project.paused ? (
            <PauseCircle className="size-3.5 text-brand-2" aria-hidden="true" />
          ) : (
            <PlayCircle className="size-3.5 text-brand-2" aria-hidden="true" />
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

      {isOwner ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
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
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <UserPlus className="size-3.5 text-brand-2" aria-hidden="true" />
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
