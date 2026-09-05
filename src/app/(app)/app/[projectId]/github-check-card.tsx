import Link from "next/link";
import { GitBranch, Zap } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { DocLink } from "@/components/doc-link";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { disableGithubCheck, setGithubCheck } from "./actions";

export function GithubCheckCard({
  projectId,
  project,
  allowed,
  backTo,
}: {
  projectId: string;
  project: {
    github_repo: string | null;
    github_connected: boolean;
    github_app_installed: boolean;
  };
  allowed: boolean;
  backTo: string;
}) {
  const installed = !!project.github_app_installed;

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
      <p className="text-xs text-muted-foreground">
        Après chaque déploiement Vercel, publie le résultat directement sur le
        commit — vert si tout passe, rouge sinon, avec le Ship Score en titre.
      </p>

      <fieldset disabled={!allowed} className="flex flex-col gap-3">
        {installed ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-1.5 shrink-0 rounded-full bg-[#3fb950]"
              aria-hidden="true"
            />
            App GitHub installée — indiquez le dépôt ci-dessous.
          </p>
        ) : (
          <Link
            href={`/api/oauth/github/start?projectId=${projectId}`}
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            <Zap className="size-3.5" aria-hidden="true" />
            Installer l&apos;app GitHub
          </Link>
        )}

        <ActionForm action={setGithubCheck.bind(null, projectId)} className="flex flex-col gap-2">
          <label htmlFor="github_repo" className="text-xs text-muted-foreground">
            Dépôt surveillé
          </label>
          <Input
            id="github_repo"
            name="github_repo"
            placeholder={project.github_repo ?? "owner/repo"}
            defaultValue={project.github_repo ?? ""}
          />
          {/* The App path needs no token at all — it mints one per Check
              Run from its private key. The field stays for projects wired
              up before the App existed, and for anyone who prefers a PAT
              they control: leaving it empty keeps whatever is stored. */}
          {!installed && (
            <>
              <label htmlFor="github_token" className="text-xs text-muted-foreground">
                Ou un token fine-grained (scope checks:write)
              </label>
              <Input
                id="github_token"
                name="github_token"
                type="password"
                placeholder={
                  project.github_connected ? "•••••••• (déjà configuré)" : "github_pat_..."
                }
              />
            </>
          )}
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
