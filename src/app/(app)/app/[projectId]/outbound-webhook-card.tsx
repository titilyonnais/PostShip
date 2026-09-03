"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Webhook } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/use-toast-action";
import {
  disableOutboundWebhook,
  regenerateOutboundWebhookSecret,
  sendOutboundWebhookTest,
  setOutboundWebhookUrl,
  type RegenerateSecretResult,
} from "./actions";

const initialResult: ActionResult = {};
const initialSecretResult: RegenerateSecretResult = {};

export function OutboundWebhookCard({
  projectId,
  configured,
  allowed,
  backTo,
}: {
  projectId: string;
  configured: boolean;
  allowed: boolean;
  backTo: string;
}) {
  const router = useRouter();

  const [regenState, regenerate, regenPending] = useActionState(
    regenerateOutboundWebhookSecret.bind(null, projectId),
    initialSecretResult,
  );
  const [testState, sendTest, testPending] = useActionState(
    sendOutboundWebhookTest.bind(null, projectId),
    initialResult,
  );
  const [disableState, disable, disablePending] = useActionState(
    disableOutboundWebhook.bind(null, projectId),
    initialResult,
  );

  const handled = useRef<ActionResult | null>(null);
  useEffect(() => {
    for (const state of [regenState, testState, disableState]) {
      if (state === handled.current || (!state.success && !state.error)) continue;
      handled.current = state;
      if (state.success) {
        toast.success(state.success);
        router.refresh();
      } else if (state.error) {
        toast.error(state.error);
      }
    }
  }, [regenState, testState, disableState, router]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Webhook className="size-3.5" aria-hidden="true" />
        Webhook sortant
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
        POST JSON signé (HMAC-SHA256) vers votre propre endpoint à chaque
        fail/recovered — headers <code>X-PostShip-Signature</code> et{" "}
        <code>X-PostShip-Event</code>. Respecte les mêmes règles que les
        autres canaux (silence, heures calmes, confirmation).
      </p>
      <fieldset disabled={!allowed} className="flex flex-col gap-3">
        <ActionForm action={setOutboundWebhookUrl.bind(null, projectId)} className="flex gap-2">
          <label htmlFor="outbound_webhook_url" className="sr-only">
            URL du webhook sortant
          </label>
          <Input
            id="outbound_webhook_url"
            name="outbound_webhook_url"
            type="url"
            placeholder={configured ? "•••••••• (déjà configuré)" : "https://votre-site.fr/hooks/postship"}
            className="flex-1"
          />
          <SubmitButton variant="outline" pendingText="...">
            Enregistrer
          </SubmitButton>
        </ActionForm>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={regenPending}
            onClick={() => startTransition(() => regenerate())}
          >
            Régénérer le secret
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!configured || testPending}
            onClick={() => startTransition(() => sendTest())}
          >
            Envoyer un test
          </Button>
          {configured && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={disablePending}
              onClick={() => startTransition(() => disable())}
            >
              Désactiver
            </Button>
          )}
        </div>

        {regenState.secret && (
          <div className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Copiez ce secret maintenant — il ne sera plus jamais affiché.
            </p>
            <code className="break-all rounded-sm bg-secondary px-2 py-1 font-mono text-xs">
              {regenState.secret}
            </code>
          </div>
        )}
      </fieldset>
    </div>
  );
}
