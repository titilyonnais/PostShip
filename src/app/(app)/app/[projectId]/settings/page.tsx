import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import {
  getAuthUser,
  getDomainVerification,
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
import { rotateDomainToken, verifyProjectDomain } from "../domain-actions";
import {
  inviteProjectMember,
  leaveProject,
  removeProjectMember,
} from "../members-actions";

export const metadata = {
  title: "Paramètres du projet",
};

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

  let host = "";
  try {
    host = new URL(project.base_url).hostname;
  } catch {
    // base_url is already validated at write time (assertRegisterableHttpsUrl) — this only guards a row written before that existed.
  }

  // The project OWNER's plan gates its features (collaborators, etc.) —
  // never the current viewer's own plan, which for a collaborator can be
  // Free while the project itself is on Team. See the comment on
  // getProjectOwnerPlan.
  const [ownerPlan, members, domainVerification] = await Promise.all([
    getProjectOwnerPlan(project.user_id),
    isOwner ? getProjectMembers(projectId) : Promise.resolve([]),
    host ? getDomainVerification(projectId, host) : Promise.resolve(null),
  ]);
  const limits = getPlanLimits(ownerPlan);
  const backTo = `/app/${projectId}`;
  const isDomainVerified = !!domainVerification?.verified_at;

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

      <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {isDomainVerified ? (
            <BadgeCheck className="size-3.5 text-[#3fb950]" aria-hidden="true" />
          ) : (
            <ShieldCheck className="size-3.5" aria-hidden="true" />
          )}
          Vérification de domaine
        </h2>
        {isDomainVerified ? (
          <p className="text-xs text-muted-foreground">
            <span className="text-[#3fb950]">{host}</span> est vérifié
            {domainVerification?.method === "dns-txt"
              ? " (enregistrement DNS TXT)."
              : domainVerification?.method === "well-known"
                ? " (fichier well-known)."
                : "."}{" "}
            Les vérifications automatiques (cron, webhook de déploiement)
            sont actives pour ce projet.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Tant que <span className="font-mono">{host}</span> n&apos;est
              pas vérifié, le cron et le webhook de déploiement
              n&apos;exécutent aucune vérification automatique sur ce
              projet — &laquo; Lancer maintenant &raquo; reste disponible
              dans l&apos;intervalle. Prouvez que vous contrôlez ce domaine
              par l&apos;une des deux méthodes :
            </p>
            {domainVerification?.token && (
              <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">
                    Option A — Enregistrement DNS TXT
                  </p>
                  <p>
                    Ajoutez un enregistrement TXT sur{" "}
                    <span className="font-mono">{host}</span> avec la valeur :
                  </p>
                  <p className="break-all rounded-sm bg-secondary px-2 py-1 font-mono">
                    postship-verify={domainVerification.token}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Option B — Fichier well-known
                  </p>
                  <p>
                    Publiez un fichier accessible à cette URL, dont le
                    contenu est exactement le token ci-dessous :
                  </p>
                  <p className="break-all rounded-sm bg-secondary px-2 py-1 font-mono">
                    https://{host}/.well-known/postship.txt
                  </p>
                  <p className="mt-1 break-all rounded-sm bg-secondary px-2 py-1 font-mono">
                    {domainVerification.token}
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <ActionForm action={verifyProjectDomain.bind(null, projectId)}>
                <SubmitButton variant="outline" pendingText="Vérification...">
                  Vérifier maintenant
                </SubmitButton>
              </ActionForm>
              <ActionForm action={rotateDomainToken.bind(null, projectId)}>
                <SubmitButton
                  variant="ghost"
                  className="text-muted-foreground"
                  pendingText="..."
                >
                  {domainVerification?.token
                    ? "Régénérer le token"
                    : "Générer un token"}
                </SubmitButton>
              </ActionForm>
            </div>
          </>
        )}
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
              Disponible à partir du plan Pro.{" "}
              <Link
                href={`/app/billing?from=${encodeURIComponent(backTo)}`}
                className="text-foreground underline underline-offset-2"
              >
                Passer à Pro
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
