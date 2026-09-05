import Link from "next/link";
import { Webhook } from "lucide-react";
import { CopyField } from "@/components/copy-field";
import { DocLink } from "@/components/doc-link";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { FieldRow, FieldRowDivider } from "@/components/ui/field-row";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { ActionResult } from "@/lib/use-toast-action";
import { setCloudflareHookSecret, setVercelHookSecret } from "./actions";
import { NetlifySecretField } from "./netlify-secret-field";
import { toggleCheckPreviews } from "../actions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

// Wiring a deploy hook means pasting a URL into someone else's product
// and a secret back into this one, with nothing to confirm either half
// landed — you found out at the next deploy, or never. This is that
// missing confirmation: the timestamp is written the moment a
// signature-verified request arrives (src/lib/deploys.ts), so "reçu il y
// a 3 min" means the whole chain works, secret included.
function ReceiptLine({ at }: { at: string | null }) {
  if (!at) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
          aria-hidden="true"
        />
        Aucun webhook reçu pour l&apos;instant
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-1.5 shrink-0 rounded-full bg-[#3fb950]" aria-hidden="true" />
      Dernier webhook reçu {formatRelativeTime(at)}
    </p>
  );
}

function DeployHookSection({
  title,
  routePath,
  docHref,
  instructions,
  lastReceivedAt,
  children,
}: {
  title: string;
  routePath: string;
  docHref: string;
  instructions: React.ReactNode;
  lastReceivedAt: string | null;
  /** The secret control — a paste field, or Netlify's generator. */
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Webhook className="size-3.5 text-brand-2" aria-hidden="true" />
          {title}
        </h3>
        <DocLink href={docHref} />
      </div>
      {/* Feedback fix: flex-1 here, not on the form — so the field + Save
          button line up at the same height across a row of cards
          regardless of how long each provider's instructions run. */}
      <p className="flex-1 text-xs text-muted-foreground">{instructions}</p>
      <CopyField value={`${APP_URL}${routePath}`} label="L'URL du webhook" />
      {children}
      <ReceiptLine at={lastReceivedAt} />
    </div>
  );
}

function PastedSecretField({
  action,
  inputName,
  title,
  configured,
}: {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  inputName: string;
  title: string;
  configured: boolean;
}) {
  return (
    <ActionForm action={action}>
      <FieldRow>
        <label htmlFor={inputName} className="sr-only">
          Secret {title}
        </label>
        <Input
          id={inputName}
          name={inputName}
          type="password"
          placeholder={configured ? "•••••••• (déjà configuré)" : "Secret"}
          className="flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0"
        />
        <FieldRowDivider />
        <SubmitButton
          variant="ghost"
          className="shrink-0 rounded-none px-4"
          pendingText="Enregistrement..."
        >
          Enregistrer
        </SubmitButton>
      </FieldRow>
    </ActionForm>
  );
}

export function DeployHooksCard({
  projectId,
  project,
  allowed,
  backTo,
}: {
  projectId: string;
  project: {
    id: string;
    vercel_hook_configured: boolean;
    netlify_hook_configured: boolean;
    cloudflare_hook_configured: boolean;
    vercel_hook_last_received_at: string | null;
    netlify_hook_last_received_at: string | null;
    cloudflare_hook_last_received_at: string | null;
    check_previews: boolean;
  };
  allowed: boolean;
  backTo: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Webhook className="size-3.5 text-brand-2" aria-hidden="true" />
          Déploiement
        </h2>
        <DocLink href="/docs/webhooks-deploy" />
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
      <fieldset disabled={!allowed} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <DeployHookSection
            title="Vercel"
            routePath={`/api/vercel/deploy/${projectId}`}
            docHref="/docs/connecter-vercel"
            lastReceivedAt={project.vercel_hook_last_received_at}
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
          >
            <PastedSecretField
              action={setVercelHookSecret.bind(null, projectId)}
              inputName="vercel_hook_secret"
              title="Vercel"
              configured={!!project.vercel_hook_configured}
            />
          </DeployHookSection>

          <DeployHookSection
            title="Netlify"
            routePath={`/api/netlify/deploy/${projectId}`}
            docHref="/docs/connecter-netlify"
            lastReceivedAt={project.netlify_hook_last_received_at}
            instructions={
              <>
                Dans Netlify : Project configuration → Notifications → Deploy
                notifications → Add notification → Outgoing webhook, événement
                &laquo; Deploy succeeded &raquo;, URL ci-dessous. Le secret,
                c&apos;est PostShip qui le génère — Netlify vous le demande
                dans son champ &laquo; JWS secret token &raquo;.
              </>
            }
          >
            <NetlifySecretField
              projectId={projectId}
              configured={!!project.netlify_hook_configured}
            />
          </DeployHookSection>

          <DeployHookSection
            title="Cloudflare Pages"
            routePath={`/api/cloudflare/deploy/${projectId}`}
            docHref="/docs/connecter-cloudflare"
            lastReceivedAt={project.cloudflare_hook_last_received_at}
            instructions={
              <>
                Dans Cloudflare : Notifications → Destinations → Webhooks,
                ajoutez l&apos;URL ci-dessous et copiez le secret généré par
                Cloudflare. Puis créez une Notification sur &laquo; Pages
                Deployment Success &raquo; pointant vers ce webhook.
              </>
            }
          >
            <PastedSecretField
              action={setCloudflareHookSecret.bind(null, projectId)}
              inputName="cloudflare_hook_secret"
              title="Cloudflare"
              configured={!!project.cloudflare_hook_configured}
            />
          </DeployHookSection>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Vérifier aussi les previews Vercel : lance les checks contre
            l&apos;URL de preview (pas la prod) à chaque déploiement de
            preview, avec des alertes préfixées &laquo; Preview &raquo;.
          </p>
          <div>
            <ActionForm
              action={toggleCheckPreviews.bind(null, project.id, !!project.check_previews)}
            >
              <SubmitButton variant="outline" pendingText="...">
                {project.check_previews
                  ? "Désactiver la vérification des previews"
                  : "Activer la vérification des previews"}
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
