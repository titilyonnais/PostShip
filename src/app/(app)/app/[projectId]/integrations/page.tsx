import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { getProject, getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { updateStripeSuccessUrl } from "../../actions";
import { ChatWebhooksCard } from "../chat-webhooks-card";
import { DeployHooksCard } from "../deploy-hooks-card";
import { GithubCheckCard } from "../github-check-card";
import { OutboundWebhookCard } from "../outbound-webhook-card";

export const metadata = {
  title: "Intégrations",
};

const CONNECTED_LABEL: Record<string, string> = {
  discord: "Discord connecté.",
  slack: "Slack connecté.",
};

const OAUTH_ERROR_LABEL: Record<string, string> = {
  plan: "Ce plan ne donne pas accès à cette intégration.",
  discord: "Échec de la connexion à Discord — réessayez ou collez l'URL manuellement.",
  slack: "Échec de la connexion à Slack — réessayez ou collez l'URL manuellement.",
  discord_not_configured: "Connexion Discord pas encore activée sur ce site.",
  slack_not_configured: "Connexion Slack pas encore activée sur ce site.",
};

export default async function IntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ connected?: string; oauth_error?: string }>;
}) {
  const { projectId } = await params;
  const { connected, oauth_error: oauthError } = await searchParams;

  const project = await getProject(projectId);
  if (!project) notFound();

  const ownerPlan = await getProjectOwnerPlan(project.user_id);
  const limits = getPlanLimits(ownerPlan);
  const backTo = `/app/${projectId}/integrations`;

  return (
    <div className="flex flex-col gap-6">
      {connected && CONNECTED_LABEL[connected] && (
        <p role="status" className="text-sm text-[#3fb950]">
          {CONNECTED_LABEL[connected]}
        </p>
      )}
      {oauthError && (
        <p role="alert" className="text-sm text-destructive">
          {OAUTH_ERROR_LABEL[oauthError] ?? "Échec de la connexion."}
        </p>
      )}

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

      <GithubCheckCard
        projectId={projectId}
        project={project}
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
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <CreditCard className="size-3.5" aria-hidden="true" />
          Stripe — URL de succès
        </h2>
        {!limits.stripeHealth && (
          <p className="text-xs text-muted-foreground">
            Disponible à partir du plan Team.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Utilisée par vos cibles &laquo; Stripe health &raquo; à la place de
          leur propre URL — pratique si la page de succès change sans
          toucher chaque cible. Laissez vide pour que chaque cible utilise
          sa propre URL.
        </p>
        <fieldset disabled={!limits.stripeHealth}>
          <ActionForm
            action={updateStripeSuccessUrl.bind(null, project.id)}
            className="flex items-end gap-2"
          >
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="stripe-success-url" className="text-xs text-muted-foreground">
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
  );
}
