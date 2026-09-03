import Link from "next/link";
import { GitBranch } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { disableGithubCheck, setGithubCheck } from "./actions";

export function GithubCheckCard({
  projectId,
  project,
  allowed,
  backTo,
}: {
  projectId: string;
  project: { github_repo: string | null; github_connected: boolean };
  allowed: boolean;
  backTo: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <GitBranch className="size-3.5" aria-hidden="true" />
        GitHub
      </h2>
      {!allowed && (
        <p className="text-xs text-muted-foreground">
          Disponible à partir du plan Solo.{" "}
          <Link
            href={`/app/billing?from=${encodeURIComponent(backTo)}`}
            className="text-foreground underline underline-offset-2"
          >
            Passer à Solo
          </Link>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Après chaque déploiement Vercel, publie le résultat directement sur
        le commit (PAT fine-grained, scope &laquo; checks:write &raquo;,
        jamais réaffiché).
      </p>
      <fieldset disabled={!allowed} className="flex flex-col gap-2">
        <ActionForm action={setGithubCheck.bind(null, projectId)} className="flex flex-col gap-2">
          <label htmlFor="github_repo" className="sr-only">
            Dépôt GitHub
          </label>
          <Input
            id="github_repo"
            name="github_repo"
            placeholder={
              project.github_connected ? `${project.github_repo} (configuré)` : "owner/repo"
            }
          />
          <label htmlFor="github_token" className="sr-only">
            Token GitHub
          </label>
          <Input
            id="github_token"
            name="github_token"
            type="password"
            placeholder={project.github_connected ? "•••••••• (déjà configuré)" : "github_pat_..."}
          />
          <SubmitButton variant="outline" pendingText="Enregistrement...">
            Enregistrer
          </SubmitButton>
        </ActionForm>
        {project.github_connected && (
          <ActionForm action={disableGithubCheck.bind(null, projectId)}>
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
      </fieldset>
    </div>
  );
}
