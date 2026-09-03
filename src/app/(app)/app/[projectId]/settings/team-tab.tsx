import Link from "next/link";
import { UserPlus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { inviteProjectMember, removeProjectMember } from "../members-actions";

type Member = { id: string; invited_email: string; status: string };

// V2 (ia-moderne backlog): collaborators, split out of Général into their
// own tab — owner-only (a collaborator viewing settings never sees this
// tab's content, same gating the old page had).
export function TeamTab({
  projectId,
  members,
  ownerPlan,
}: {
  projectId: string;
  members: Member[];
  ownerPlan: Plan;
}) {
  const limits = getPlanLimits(ownerPlan);
  const backTo = `/app/${projectId}/settings?tab=team`;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <UserPlus className="size-3.5" aria-hidden="true" />
        Collaborateurs
      </h2>
      {limits.teamMembers ? (
        <>
          <p className="text-xs text-muted-foreground">
            Un collaborateur accède aux URLs, alertes et webhooks de ce
            projet, mais pas à votre facturation. Pas besoin qu&apos;il ait
            déjà un compte PostShip.
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
                      action={removeProjectMember.bind(null, projectId, member.id)}
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
            Passer à Pro
          </Link>
        </p>
      )}
    </div>
  );
}
