import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/use-toast-action";
import {
  disableDiscordWebhook,
  disableSlackWebhook,
  disableTelegram,
  setDiscordWebhook,
  setSlackWebhook,
  setTelegramConfig,
} from "./actions";

function ChatWebhookSection({
  title,
  instructions,
  placeholder,
  action,
  disableAction,
  inputName,
  configured,
}: {
  title: string;
  instructions: React.ReactNode;
  placeholder: string;
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  disableAction: (prevState: ActionResult) => Promise<ActionResult>;
  inputName: string;
  configured: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <MessageSquare className="size-3.5" aria-hidden="true" />
        {title}
      </h3>
      <p className="text-xs text-muted-foreground">{instructions}</p>
      <ActionForm action={action} className="flex gap-2">
        <label htmlFor={inputName} className="sr-only">
          URL du webhook {title}
        </label>
        <Input
          id={inputName}
          name={inputName}
          type="url"
          placeholder={configured ? "•••••••• (déjà configuré)" : placeholder}
          className="flex-1"
        />
        <SubmitButton variant="outline" pendingText="Enregistrement...">
          Enregistrer
        </SubmitButton>
      </ActionForm>
      {configured && (
        <ActionForm action={disableAction}>
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
    </div>
  );
}

function TelegramSection({
  action,
  disableAction,
  configured,
}: {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  disableAction: (prevState: ActionResult) => Promise<ActionResult>;
  configured: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <MessageSquare className="size-3.5" aria-hidden="true" />
        Telegram
      </h3>
      <p className="text-xs text-muted-foreground">
        Créez un bot via @BotFather pour obtenir le token, puis récupérez le
        chat ID (envoyez un message au bot et consultez
        api.telegram.org/bot&lt;token&gt;/getUpdates). Laissez les champs
        vides pour ne rien changer.
      </p>
      <ActionForm action={action} className="flex flex-col gap-2">
        <label htmlFor="telegram_bot_token" className="sr-only">
          Token du bot Telegram
        </label>
        <Input
          id="telegram_bot_token"
          name="telegram_bot_token"
          placeholder={configured ? "•••••••• (déjà configuré)" : "123456:AbC-..."}
        />
        <label htmlFor="telegram_chat_id" className="sr-only">
          Chat ID Telegram
        </label>
        <Input
          id="telegram_chat_id"
          name="telegram_chat_id"
          placeholder={configured ? "•••• (déjà configuré)" : "-100123456789"}
        />
        <SubmitButton variant="outline" pendingText="Enregistrement...">
          Enregistrer
        </SubmitButton>
      </ActionForm>
      {configured && (
        <ActionForm action={disableAction}>
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
    </div>
  );
}

export function ChatWebhooksCard({
  projectId,
  project,
  allowed,
  backTo,
}: {
  projectId: string;
  project: {
    discord_webhook_configured: boolean;
    slack_webhook_configured: boolean;
    telegram_configured: boolean;
  };
  allowed: boolean;
  backTo: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <MessageSquare className="size-3.5" aria-hidden="true" />
          Alertes
        </h2>
        <Link
          href={`/app/${projectId}/settings?tab=bot`}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Commandes → Bot
        </Link>
      </div>
      {!allowed && (
        <p className="text-xs text-muted-foreground">
          Disponible à partir du plan Solo.{" "}
          <Link
            href={`/app/billing?from=${encodeURIComponent(backTo)}`}
            className="text-foreground underline underline-offset-2"
          >
            Passer à Solo/Pro
          </Link>
        </p>
      )}
      <fieldset disabled={!allowed} className="grid gap-4 sm:grid-cols-3">
        <ChatWebhookSection
          title="Discord"
          instructions="Collez l'URL d'un webhook Discord (Paramètres du salon → Intégrations → Webhooks). Laissez le champ vide pour ne rien changer."
          placeholder="https://discord.com/api/webhooks/..."
          action={setDiscordWebhook.bind(null, projectId)}
          disableAction={disableDiscordWebhook.bind(null, projectId)}
          inputName="discord_webhook_url"
          configured={!!project.discord_webhook_configured}
        />
        <ChatWebhookSection
          title="Slack"
          instructions="Collez l'URL d'un webhook entrant Slack (créé depuis api.slack.com/apps → Incoming Webhooks). Laissez le champ vide pour ne rien changer."
          placeholder="https://hooks.slack.com/services/..."
          action={setSlackWebhook.bind(null, projectId)}
          disableAction={disableSlackWebhook.bind(null, projectId)}
          inputName="slack_webhook_url"
          configured={!!project.slack_webhook_configured}
        />
        <TelegramSection
          action={setTelegramConfig.bind(null, projectId)}
          disableAction={disableTelegram.bind(null, projectId)}
          configured={!!project.telegram_configured}
        />
      </fieldset>
    </div>
  );
}
