import Link from "next/link";
import { GitBranch, Zap } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { DocLink } from "@/components/doc-link";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import type { InstallationRepo } from "@/lib/github-app";
import { disableGithubCheck, setGithubCheck } from "./actions";

export function GithubCheckCard({
  projectId,
  project,
  repos,
  allowed,
  backTo,
}: {
  projectId: string;
  project: {
    github_repo: string | null;
    github_connected: boolean;
    github_app_installed: boolean;
  };
  /** Repos the installation covers — null when not installed, or when
   *  GitHub couldn't be reached, in which case the field stays free text. */
  repos: InstallationRepo[] | null;
  allowed: boolean;
  backTo: string;
}) {
  const installed = !!project.github_app_installed;
  // A repo saved before the App was installed, or removed from the
  // installation since, would otherwise silently vanish from the picker.
  const options = repos?.map((r) => r.fullName) ?? [];
  const choices =
    project.github_repo && !options.includes(project.github_repo)
      ? [project.github_repo, ...options]
      : options;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <GitBranch className="size-3.5 text-brand-2" aria-hidden="true" />
          GitHub
        </h2>
        <DocLink href="/docs/connecter-github" />
      </div>

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

      <p className="flex-1 text-xs text-muted-foreground">
        Publie le résultat sur le commit après chaque déploiement — vert si
        tout passe, rouge sinon, avec le Ship Score en titre.
      </p>

      <fieldset disabled={!allowed} className="flex flex-col gap-2">
        {!installed && (
          <Link
            href={`/api/oauth/github/start?projectId=${projectId}`}
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            <Zap className="size-3.5" aria-hidden="true" />
            Installer l&apos;app GitHub
          </Link>
        )}

        <ActionForm action={setGithubCheck.bind(null, projectId)} className="flex flex-col gap-2">
          <label htmlFor="github_repo" className="sr-only">
            Dépôt surveillé
          </label>
          {choices.length > 0 ? (
            <select
              id="github_repo"
              name="github_repo"
              defaultValue={project.github_repo ?? ""}
              className="h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
            >
              <option value="">Choisir un dépôt…</option>
              {choices.map((full) => (
                <option key={full} value={full}>
                  {full}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="github_repo"
              name="github_repo"
              placeholder="owner/repo"
              defaultValue={project.github_repo ?? ""}
            />
          )}

          {/* The App mints its own token per Check Run, so this field only
              exists for projects wired up before it, or anyone who prefers
              a PAT they control. Empty keeps whatever is stored. */}
          {!installed && (
            <>
              <label htmlFor="github_token" className="sr-only">
                Token fine-grained
              </label>
              <Input
                id="github_token"
                name="github_token"
                type="password"
                placeholder={
                  project.github_connected ? "•••••••• (token en place)" : "ou github_pat_..."
                }
              />
            </>
          )}

          <SubmitButton variant="outline" pendingText="...">
            Enregistrer
          </SubmitButton>
        </ActionForm>

        {installed && repos !== null && choices.length === 0 && (
          <p className="text-xs text-[#d29922]">
            L&apos;installation ne couvre aucun dépôt — ajoutez-en un côté
            GitHub.
          </p>
        )}

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
