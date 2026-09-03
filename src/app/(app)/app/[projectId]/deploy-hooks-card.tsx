import Link from "next/link";
import { Webhook } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/use-toast-action";
import {
  setCloudflareHookSecret,
  setNetlifyHookSecret,
  setVercelHookSecret,
} from "./actions";
import { toggleCheckPreviews } from "../actions";

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
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  inputName: string;
  configured: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Webhook className="size-3.5" aria-hidden="true" />
        {title}
      </h3>
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
    check_previews: boolean;
  };
  allowed: boolean;
  backTo: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Webhook className="size-3.5" aria-hidden="true" />
        Déploiement
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
      <fieldset disabled={!allowed} className="flex flex-col gap-4">
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
