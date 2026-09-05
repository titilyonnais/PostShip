"use server";

import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { registerTelegramWebhook } from "@/lib/telegram";
import { runBotCommand, sendBotMessage } from "@/lib/bot-commands";
import type { ActionResult } from "@/lib/use-toast-action";

export async function sendBotTestStatus(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Projet introuvable." };

  const service = createServiceClient();
  const { data: ownerProfile } = await service
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").chatWebhooks) {
    return { error: "Le bot n'est disponible qu'avec un plan payant." };
  }

  const { data: secrets } = await service
    .from("projects")
    .select("discord_webhook_url, telegram_bot_token, telegram_chat_id")
    .eq("id", projectId)
    .single();

  if (!secrets?.discord_webhook_url && !secrets?.telegram_bot_token) {
    return { error: "Configurez d'abord Discord ou Telegram dans Paramètres." };
  }

  const text = await runBotCommand("/status", { supabase: service, projectId });
  await sendBotMessage(secrets, `/status\n${text}`);

  return { success: "Message de test envoyé." };
}

export async function setTelegramWebhook(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Projet introuvable." };

  const service = createServiceClient();
  const { data: ownerProfile } = await service
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").chatWebhooks) {
    return { error: "Le bot n'est disponible qu'avec un plan payant." };
  }

  const { data: secrets } = await service
    .from("projects")
    .select("telegram_bot_token")
    .eq("id", projectId)
    .single();

  if (!secrets?.telegram_bot_token) {
    return { error: "Configurez d'abord le token Telegram dans Paramètres." };
  }

  const registered = await registerTelegramWebhook(
    service,
    projectId,
    secrets.telegram_bot_token,
  );
  if (!registered.ok) return { error: registered.reason };

  return { success: "Commandes Telegram activées — essayez /status dans le salon." };
}
