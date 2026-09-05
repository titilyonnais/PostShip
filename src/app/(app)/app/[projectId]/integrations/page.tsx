import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { DocLink } from "@/components/doc-link";
import { OAuthReturnToast } from "@/components/oauth-return-toast";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import {
  getGithubInstallationRepos,
  getProject,
  getProjectOwnerPlan,
} from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { updateStripeSuccessUrl } from "../../actions";
import { ChatWebhooksCard } from "../chat-webhooks-card";
import { DeployHooksCard } from "../deploy-hooks-card";
import { GithubCheckCard } from "../github-check-card";
import { OutboundWebhookCard } from "../outbound-webhook-card";

export const metadata = {
  title: "Intégrations",
};

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) notFound();

  // Safe to read the installation now: getProject above already went
  // through RLS, so the viewer owns (or is a member of) this project.
  const githubRepos = await getGithubInstallationRepos(projectId);

  const ownerPlan = await getProjectOwnerPlan(project.user_id);
  const limits = getPlanLimits(ownerPlan);
  const backTo = `/app/${projectId}/integrations`;

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <OAuthReturnToast />
      </Suspense>

      <DeployHooksCard
        projectId={projectId}
        project={project}
        allowed={limits.deployHooks}
        backTo={backTo}
      />

      <ChatWebhooksCard
        projectId={projectId}
        project={project}
        allowed={limits.chatWebhooks}
        backTo={backTo}
      />

      {/* The three short cards sit side by side rather than stacked:
          full-width each, they read as a column of near-empty bands. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GithubCheckCard
          projectId={projectId}
          project={project}
          repos={githubRepos}
          allowed={limits.deployHooks}
          backTo={backTo}
        />

        <OutboundWebhookCard
          projectId={projectId}
          configured={!!project.outbound_webhook_configured}
          allowed={limits.chatWebhooks}
          backTo={backTo}
        />

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <CreditCard className="size-3.5 text-brand-2" aria-hidden="true" />
              Stripe — URL de succès
            </h2>
            <DocLink href="/docs/stripe" />
          </div>
          {!limits.stripeHealth && (
            <p className="text-xs text-muted-foreground">
              Disponible à partir du plan Team.
            </p>
          )}
          <p className="flex-1 text-xs text-muted-foreground">
            Utilisée par vos cibles &laquo; Stripe health &raquo; à la place
            de leur propre URL. Laissez vide pour que chaque cible garde la
            sienne.
          </p>
          <fieldset disabled={!limits.stripeHealth}>
            <ActionForm
              action={updateStripeSuccessUrl.bind(null, project.id)}
              className="flex flex-col gap-2"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="stripe-success-url" className="sr-only">
                  URL de succès
                </label>
                <Input
                  id="stripe-success-url"
                  name="stripe_success_url"
                  type="url"
                  placeholder="https://exemple.com/merci"
                  defaultValue={project.stripe_success_url ?? ""}
                />
              </div>
              <SubmitButton variant="outline" pendingText="...">
                Enregistrer
              </SubmitButton>
            </ActionForm>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
