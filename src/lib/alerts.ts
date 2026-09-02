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
  channel: "email" | "discord" | "slack",
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Dark, operational, no purple-AI gradient nonsense (CLAUDE.md) — a plain
// list with a colored dot, the mono URL, and the status, same information
// as the text fallback and nothing more.
function buildFailEmailHtml(projectName: string, items: AlertItem[]): string {
  const rows = items
    .map((i) => {
      const isRecovered = i.kind === "recovered";
      const color = isRecovered ? "#3fb950" : "#f85149";
      const label = isRecovered ? "Rétabli" : "En échec";
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #2a2f36;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:10px;"></span>
            <span style="color:#8b949e;font-size:12px;">${label}</span><br />
            <span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:#e6edf3;">${escapeHtml(i.url)}</span>
            <span style="color:#8b949e;font-size:12px;"> (${i.httpStatus ?? "—"})</span>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="background:#0a0c0e;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table role="presentation" style="max-width:480px;margin:0 auto;width:100%;">
        <tr>
          <td style="padding-bottom:16px;">
            <span style="color:#e6edf3;font-size:14px;font-weight:600;">PostShip — ${escapeHtml(projectName)}</span>
          </td>
        </tr>
        ${rows}
        <tr>
          <td style="padding-top:20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/app" style="color:#8b949e;font-size:12px;">${process.env.NEXT_PUBLIC_APP_URL}/app</a>
          </td>
        </tr>
      </table>
    </div>`;
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
    html: buildFailEmailHtml(projectName, items),
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

async function sendSlackAlert(
  webhookUrl: string,
  projectName: string,
  items: AlertItem[],
) {
  // Same reasoning as the Discord guard above: slack_webhook_url is
  // DB-locked to Slack's own domain (migration 0021 + the regex in
  // setSlackWebhook), but every outbound fetch still goes through the
  // SSRF guard regardless (CLAUDE.md).
  const guard = await assertPublicHttpsUrl(webhookUrl);
  if (!guard.ok) {
    console.error("Webhook Slack refusé par le garde SSRF", guard.reason);
    return;
  }

  const lines = items
    .map(
      (i) =>
        `${i.kind === "recovered" ? ":large_green_circle:" : ":red_circle:"} \`${i.url}\` (${i.httpStatus ?? "—"})`,
    )
    .join("\n");

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*PostShip — ${projectName}*\n${lines}`,
    }),
  });
}

export async function dispatchAlerts(
  supabase: SupabaseClient,
  project: {
    id: string;
    name: string;
    discord_webhook_url: string | null;
    slack_webhook_url: string | null;
    ownerEmail: string | null;
    ownerPlanAllowsChatWebhooks: boolean;
  },
  items: AlertItem[],
  options?: { recordDedup?: boolean },
) {
  if (items.length === 0) return;

  // Preview-deployment alerts (runner.ts's runPreviewChecks) pass
  // recordDedup: false — their fingerprint doesn't encode the preview URL
  // (computeFingerprint is URL-agnostic), so recording them here would
  // make shouldSendFailAlert wrongly dedup a genuine production failure on
  // the same target that happens to produce the same fingerprint shortly
  // after.
  const recordDedup = options?.recordDedup ?? true;

  if (project.ownerEmail) {
    try {
      await sendFailEmail(project.ownerEmail, project.name, items);
      if (recordDedup) await recordAlertEvents(supabase, project.id, items, "email");
    } catch (err) {
      console.error("Échec envoi email d'alerte", err);
    }
  }

  if (project.ownerPlanAllowsChatWebhooks && project.discord_webhook_url) {
    try {
      await sendDiscordAlert(project.discord_webhook_url, project.name, items);
      if (recordDedup) await recordAlertEvents(supabase, project.id, items, "discord");
    } catch (err) {
      console.error("Échec envoi Discord", err);
    }
  }

  if (project.ownerPlanAllowsChatWebhooks && project.slack_webhook_url) {
    try {
      await sendSlackAlert(project.slack_webhook_url, project.name, items);
      if (recordDedup) await recordAlertEvents(supabase, project.id, items, "slack");
    } catch (err) {
      console.error("Échec envoi Slack", err);
    }
  }
}
