import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Host is a literal (api.telegram.org), not user input — nothing to
// SSRF-guard here, unlike the Discord/Slack webhook URLs a user supplies.
const API = "https://api.telegram.org";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";

// Points Telegram at this project's own webhook route and stores the
// secret_token that route checks. Pulled out of bot-actions.ts because
// saving the bot token now registers the webhook immediately: without it
// the bot never receives the /start that supplies the chat ID, so the
// "just send /start" flow would silently never complete.
export async function registerTelegramWebhook(
  supabase: SupabaseClient, // service role — telegram_* columns are service-role-only
  projectId: string,
  botToken: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secretToken = randomBytes(32).toString("hex");

  let response: Response;
  try {
    response = await fetch(`${API}/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `${APP_URL}/api/telegram/webhook/${projectId}`,
        secret_token: secretToken,
      }),
    });
  } catch {
    return { ok: false, reason: "Telegram est injoignable pour le moment." };
  }

  if (!response.ok) {
    return { ok: false, reason: "Échec de la connexion à Telegram — vérifiez le token." };
  }

  const { error } = await supabase
    .from("projects")
    .update({ telegram_webhook_secret: secretToken })
    .eq("id", projectId);

  if (error) return { ok: false, reason: error.message };

  return { ok: true };
}

// Best-effort reply used by the /start adoption path — the webhook route
// has already answered Telegram by the time this runs, so a failure here
// costs nothing but a missing confirmation message.
export async function sendTelegramText(
  botToken: string,
  chatId: string | number,
  text: string,
): Promise<void> {
  try {
    await fetch(`${API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error("Échec envoi message Telegram", err);
  }
}
