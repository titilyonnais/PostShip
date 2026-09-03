import crypto from "node:crypto";
import { assertPublicHttpsUrl } from "@/lib/ssrf";

const TIMEOUT_MS = 4000;

export type OutboundWebhookItem = {
  url: string;
  httpStatus: number | null;
  missing: string[] | null;
};

export function signOutboundWebhookBody(secret: string, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

// D8 (drill-nav backlog): a signed POST to the project's own endpoint,
// called from dispatchAlerts after email/Discord/Slack/Telegram — same
// (already-filtered) items, so it inherits project silence, quiet hours,
// confirm-after-N-fails, and per-URL silence for free (src/lib/alerts.ts).
// Never throws: a broken receiving endpoint on the user's side must not
// stop the runner or the other channels.
export async function sendOutboundWebhook(
  webhookUrl: string,
  secret: string,
  payload: {
    event: "fail" | "recovered" | "mutated";
    projectId: string;
    projectName: string;
    items: OutboundWebhookItem[];
    // "Envoyer un test" on Intégrations — a fictional example.com item so
    // the receiving endpoint can tell a real incident from a manual probe.
    test?: boolean;
  },
): Promise<void> {
  try {
    // Defense in depth, same reasoning as sendDiscordAlert/sendSlackAlert
    // (src/lib/alerts.ts) — the URL is arbitrary user input, unlike the
    // Discord/Slack columns which are DB-locked to their own domains.
    const guard = await assertPublicHttpsUrl(webhookUrl);
    if (!guard.ok) {
      console.error("Webhook sortant refusé par le garde SSRF", guard.reason);
      return;
    }

    const rawBody = JSON.stringify({
      event: payload.event,
      projectId: payload.projectId,
      projectName: payload.projectName,
      at: new Date().toISOString(),
      items: payload.items,
      test: payload.test ?? false,
    });
    const signature = signOutboundWebhookBody(secret, rawBody);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PostShip-Signature": `sha256=${signature}`,
          "X-PostShip-Event": payload.event,
        },
        body: rawBody,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("Échec envoi webhook sortant", err);
  }
}
