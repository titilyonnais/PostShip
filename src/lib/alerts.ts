import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { assertPublicHttpsUrl } from "@/lib/ssrf";

const DEDUP_WINDOW_MS = 10 * 60 * 1000;

export type AlertItem = {
  targetId: string;
  url: string;
  kind: "fail" | "recovered";
  outcome: string;
  httpStatus: number | null;
  fingerprint: string;
};

export async function shouldSendFailAlert(
  supabase: SupabaseClient,
  projectId: string,
  targetId: string,
  fingerprint: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("alert_events")
    .select("id")
    .eq("project_id", projectId)
    .eq("target_id", targetId)
    .eq("fingerprint", fingerprint)
    .eq("kind", "fail")
    .gte("sent_at", since)
    .limit(1);

  return !data || data.length === 0;
}

async function recordAlertEvents(
  supabase: SupabaseClient,
  projectId: string,
  items: AlertItem[],
  channel: "email" | "discord",
) {
  if (items.length === 0) return;
  await supabase.from("alert_events").insert(
    items.map((item) => ({
      project_id: projectId,
      target_id: item.targetId,
      kind: item.kind,
      fingerprint: item.fingerprint,
      channel,
    })),
  );
}

async function sendFailEmail(
  to: string,
  projectName: string,
  items: AlertItem[],
) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const lines = items
    .map(
      (i) =>
        `${i.kind === "recovered" ? "Rétabli" : "En échec"} — ${i.url} (${i.httpStatus ?? "—"})`,
    )
    .join("\n");

  const hasNewFail = items.some((i) => i.kind === "fail");

  await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: `[PostShip] ${projectName} — ${hasNewFail ? "échec détecté" : "rétabli"}`,
    text: lines,
  });
}

async function sendDiscordAlert(
  webhookUrl: string,
  projectName: string,
  items: AlertItem[],
) {
  // Defense in depth: discord_webhook_url is DB-locked to Discord's own
  // domain (migration 0017 + the regex in setDiscordWebhook), but every
  // outbound fetch in this codebase goes through the SSRF guard regardless
  // of how trusted the source looks (CLAUDE.md).
  const guard = await assertPublicHttpsUrl(webhookUrl);
  if (!guard.ok) {
    console.error("Webhook Discord refusé par le garde SSRF", guard.reason);
    return;
  }

  const description = items
    .map(
      (i) =>
        `${i.kind === "recovered" ? "✅" : "🔴"} \`${i.url}\` (${i.httpStatus ?? "—"})`,
    )
    .join("\n");

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{ title: `PostShip — ${projectName}`, description }],
    }),
  });
}

export async function dispatchAlerts(
  supabase: SupabaseClient,
  project: {
    id: string;
    name: string;
    discord_webhook_url: string | null;
    ownerEmail: string | null;
    ownerPlanAllowsDiscord: boolean;
  },
  items: AlertItem[],
) {
  if (items.length === 0) return;

  if (project.ownerEmail) {
    try {
      await sendFailEmail(project.ownerEmail, project.name, items);
      await recordAlertEvents(supabase, project.id, items, "email");
    } catch (err) {
      console.error("Échec envoi email d'alerte", err);
    }
  }

  if (project.ownerPlanAllowsDiscord && project.discord_webhook_url) {
    try {
      await sendDiscordAlert(project.discord_webhook_url, project.name, items);
      await recordAlertEvents(supabase, project.id, items, "discord");
    } catch (err) {
      console.error("Échec envoi Discord", err);
    }
  }
}
