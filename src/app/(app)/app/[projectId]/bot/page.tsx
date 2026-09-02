import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, MessageSquare, Send } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getProject, getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { HELP_TEXT } from "@/lib/bot-commands";
import { sendBotTestStatus, setTelegramWebhook } from "../bot-actions";

export const metadata = {
  title: "Bot",
};

const COMMANDS: { command: string; description: string }[] = [
  { command: "/status", description: "{n} URL · {pass} OK · {fail} en échec, plus les 3 premières URLs en échec" },
  { command: "/check", description: "Relance une vérification (même délai que « Lancer maintenant »)" },
  { command: "/uptime", description: "Taux de réussite 24h et 7j" },
  { command: "/ssl", description: "Jours restants avant expiration du certificat SSL" },
  { command: "/silence 1h|4h|24h|off", description: "Coupe ou reprend les alertes (utile avant un déploiement planifié)" },
  { command: "/rules", description: "Confirm-count et heures calmes actuels (lecture seule, se règle sur /rules)" },
  { command: "/help", description: "Liste des commandes" },
];

export default async function BotPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) notFound();

  const ownerPlan = await getProjectOwnerPlan(project.user_id);
  const hasBotAccess = getPlanLimits(ownerPlan).chatWebhooks;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Bot className="size-3.5" aria-hidden="true" />
          État
        </h2>
        <div className="flex flex-col gap-1 text-sm">
          <p>
            Telegram :{" "}
            <span className={project.telegram_configured ? "text-[#3fb950]" : "text-muted-foreground"}>
              {project.telegram_configured ? "connecté" : "non connecté"}
            </span>
            {project.telegram_configured && (
              <>
                {" · commandes "}
                <span className={project.telegram_commands_enabled ? "text-[#3fb950]" : "text-muted-foreground"}>
                  {project.telegram_commands_enabled ? "activées" : "désactivées"}
                </span>
              </>
            )}
          </p>
          <p>
            Discord :{" "}
            <span className={project.discord_webhook_configured ? "text-[#3fb950]" : "text-muted-foreground"}>
              {project.discord_webhook_configured ? "webhook configuré" : "non configuré"}
            </span>
            {" "}
            <span className="text-muted-foreground">(notifications seulement)</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          La configuration (token, chat ID, webhook) se fait depuis{" "}
          <Link
            href={`/app/${projectId}/settings`}
            className="text-foreground underline underline-offset-2"
          >
            Paramètres
          </Link>
          .
        </p>
        {project.telegram_configured && hasBotAccess && (
          <ActionForm action={setTelegramWebhook.bind(null, projectId)}>
            <SubmitButton variant="outline" pendingText="Connexion...">
              {project.telegram_commands_enabled
                ? "Reconnecter les commandes Telegram"
                : "Activer les commandes Telegram"}
            </SubmitButton>
          </ActionForm>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <MessageSquare className="size-3.5" aria-hidden="true" />
          Commandes
        </h2>
        <p className="text-xs text-muted-foreground">
          Dans le salon Telegram déjà branché — pas un nouveau canal à
          configurer. Discord reste notifications uniquement pour
          l&apos;instant.
        </p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {COMMANDS.map((c) => (
            <li key={c.command} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <code className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">
                {c.command}
              </code>
              <span className="text-xs text-muted-foreground">{c.description}</span>
            </li>
          ))}
        </ul>
        <pre className="mt-1 whitespace-pre-wrap rounded-sm bg-secondary p-2 text-[0.65rem] text-muted-foreground">
          {HELP_TEXT}
        </pre>
      </div>

      {hasBotAccess ? (
        <div>
          <ActionForm action={sendBotTestStatus.bind(null, projectId)}>
            <SubmitButton variant="outline" pendingText="Envoi...">
              <Send className="size-3.5" aria-hidden="true" />
              Envoyer un /status de test
            </SubmitButton>
          </ActionForm>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Le bot est disponible à partir du plan Solo.{" "}
          <Link
            href={`/app/billing?from=${encodeURIComponent(`/app/${projectId}/bot`)}`}
            className="text-foreground underline underline-offset-2"
          >
            Passer à Solo/Pro
          </Link>
        </p>
      )}
    </div>
  );
}
