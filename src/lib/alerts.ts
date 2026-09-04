import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import { buildAlertCopy, describeAlertItemShort } from "@/lib/alert-copy";
import { describeMissingCode } from "@/lib/check-labels";
import {
  escapeHtml,
  renderEmailShell,
  TEXT,
  TEXT_FAINT,
  TEXT_MUTED,
} from "@/lib/email-template";
import { formatDateTime } from "@/lib/timezone";
import { isInQuietHours } from "@/lib/quiet-hours";
import { sendOutboundWebhook } from "@/lib/outbound-webhook";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";

const DEDUP_WINDOW_MS = 10 * 60 * 1000;

export type AlertItem = {
  targetId: string;
  url: string;
  kind: "fail" | "recovered" | "mutated";
  outcome: string;
  httpStatus: number | null;
  fingerprint: string;
  // The check type (http/og/sitemap/ssl/stripe_health) — target.kind in
  // the runner, renamed here since `kind` above already means something
  // else (fail/recovered/mutated). Optional because a couple of older
  // dispatchAlerts call sites don't have it in scope; falls back to the
  // "http" icon in the email when absent.
  checkKind?: "http" | "og" | "sitemap" | "ssl" | "stripe_health";
  // Read by src/lib/alert-copy.ts to write a one-sentence, deterministic
  // description per item instead of a raw "{url} ({status})" line.
  missing?: string[] | null;
  ttfbMs?: number | null;
  deployHint?: string | null;
  // D6 (drill-nav backlog): the target's own check_targets.silenced_until —
  // dispatchAlerts drops this item (but check_runs was already written by
  // the runner regardless) rather than the whole project going quiet.
  silencedUntil?: string | null;
  // V6 (ia-moderne backlog): the "field: before → after" line for a
  // "mutated" item — see src/lib/surface.ts.
  mutationSummary?: string | null;
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
  channel: "email" | "discord" | "slack" | "telegram",
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

// Authored light, tuned so Gmail's inversion lands on the app's own
// incident-card tints (bg-destructive/5 over a dark card — see
// src/app/(app)/app/[projectId]/incidents/page.tsx). See the long
// comment in src/lib/email-template.ts for why light-authored is the
// only thing that renders dark in the Gmail app.
//
// No borders: an outline that reads as subtle on white becomes a hard
// bright line once inverted, which is what looked so bad. Separation is
// the flat tint step alone.
const KIND_STYLE: Record<
  AlertItem["kind"],
  { color: string; cardBg: string; iconBg: string; label: string }
> = {
  fail: {
    color: "#f85149",
    cardBg: "#fdf0ef",
    iconBg: "#fbe0de",
    label: "En échec",
  },
  recovered: {
    color: "#3fb950",
    cardBg: "#eff9f1",
    iconBg: "#dcf2e1",
    label: "Rétabli",
  },
  mutated: {
    color: "#d29922",
    cardBg: "#fdf7ea",
    iconBg: "#faedd0",
    label: "Contenu modifié",
  },
};

const DEFAULT_CHECK_KIND: NonNullable<AlertItem["checkKind"]> = "http";

// Mirrors the app's own incident card exactly: the same TargetKindBadge
// icon (rasterized — most inbox clients strip inline <svg>, Gmail
// included) tinted to the item's status color, a StatusDot-style dot +
// label instead of a filled pill, the mono URL, and every missing-code
// line spelled out (same wording as FailureDetails in-app) instead of
// the single deterministic sentence used for Discord/Slack/the
// plain-text fallback — an email is read away from the dashboard, so it
// has to carry the same detail on its own.
function buildFailEmailHtml(
  projectId: string,
  projectName: string,
  items: AlertItem[],
): string {
  const rows = items
    .map((i) => {
      const style = KIND_STYLE[i.kind];
      const checkKind = i.checkKind ?? DEFAULT_CHECK_KIND;
      const iconUrl = `${APP_URL}/email/icons/${checkKind}-${i.kind}.png`;
      const detailLines: string[] = [];
      if (i.kind === "fail" && i.missing) {
        detailLines.push(...i.missing.map(describeMissingCode));
      }
      if (i.kind === "mutated") {
        detailLines.push(i.mutationSummary ?? "Contenu modifié après déploiement.");
      }
      if (detailLines.length === 0) {
        // Short form, and only when it says something the status label and
        // the HTTP/TTFB line below don't already carry.
        const short = describeAlertItemShort(i);
        if (short) detailLines.push(short);
      }
      const meta: string[] = [];
      if (i.httpStatus != null) meta.push(`HTTP ${i.httpStatus}`);
      if (i.ttfbMs != null) meta.push(`TTFB ${i.ttfbMs} ms`);

      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px;">
          <tr>
            <td bgcolor="${style.cardBg}" style="background-color:${style.cardBg};border-radius:16px;padding:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td width="44" valign="top">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td width="32" height="32" bgcolor="${style.iconBg}" style="background-color:${style.iconBg};border-radius:16px;text-align:center;vertical-align:middle;">
                          <img src="${iconUrl}" width="18" height="18" alt="" style="display:inline-block;vertical-align:middle;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="top">
                    <p style="margin:0;font-size:12px;color:${TEXT_MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:${style.color};margin-right:6px;"></span>${style.label}
                    </p>
                    <a href="${APP_URL}/app/${projectId}/${i.targetId}" style="display:block;margin:7px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:${TEXT};text-decoration:none;word-break:break-all;">${escapeHtml(i.url)}</a>
                    ${detailLines
                      .map(
                        (line) =>
                          `<p style="margin:5px 0 0;font-size:12px;color:${TEXT_MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(line)}</p>`,
                      )
                      .join("")}
                    ${
                      meta.length > 0
                        ? `<p style="margin:8px 0 0;font-size:11px;color:${TEXT_FAINT};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(meta.join(" · "))}</p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`;
    })
    .join("");

  const nFail = items.filter((i) => i.kind === "fail").length;
  const nRecovered = items.filter((i) => i.kind === "recovered").length;
  const nMutated = items.filter((i) => i.kind === "mutated").length;
  const introParts = [
    nFail > 0 ? `${nFail} en échec` : null,
    nRecovered > 0 ? `${nRecovered} rétabli(s)` : null,
    nMutated > 0 ? `${nMutated} modifié(s)` : null,
  ].filter(Boolean);

  const checkedAt = formatDateTime(new Date(), null, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return renderEmailShell({
    preheader: `${projectName} — ${introParts.join(", ")}`,
    eyebrow: `Vérifié le ${checkedAt}`,
    title: projectName,
    intro: `${introParts.join(", ")} depuis la dernière vérification.`,
    bodyHtml: rows,
    cta: { href: `${APP_URL}/app/${projectId}`, label: "Ouvrir le tableau de bord" },
    manageEmails: true,
  });
}

async function sendFailEmail(
  to: string,
  projectId: string,
  projectName: string,
  items: AlertItem[],
) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const copy = buildAlertCopy(projectName, items);

  await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: copy.subject,
    text: copy.text,
    html: buildFailEmailHtml(projectId, projectName, items),
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

  const { discordDescription } = buildAlertCopy(projectName, items);

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{ title: `PostShip — ${projectName}`, description: discordDescription }],
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

  const { slackText } = buildAlertCopy(projectName, items);

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*PostShip — ${projectName}*\n${slackText}`,
    }),
  });
}

// Host is a literal, not user input — nothing to SSRF-guard here, unlike
// discord_webhook_url/slack_webhook_url which are stored URLs the user
// could otherwise point anywhere (see the guards in sendDiscordAlert /
// sendSlackAlert above).
async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  projectName: string,
  items: AlertItem[],
) {
  const { text } = buildAlertCopy(projectName, items);

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `PostShip — ${projectName}\n${text}`,
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
    telegram_bot_token: string | null;
    telegram_chat_id: string | null;
    ownerEmail: string | null;
    ownerPlanAllowsChatWebhooks: boolean;
    alerts_silenced_until?: string | null;
    quiet_hours_start?: number | null;
    quiet_hours_end?: number | null;
    quiet_hours_tz?: string | null;
    outbound_webhook_url?: string | null;
    outbound_webhook_secret?: string | null;
  },
  items: AlertItem[],
  options?: { recordDedup?: boolean },
) {
  if (items.length === 0) return;

  // N5 (nav-pro backlog): a deploy at 23:00 shouldn't page anyone 6
  // times. check_runs is always written regardless (see runner.ts) — this
  // only suppresses the outbound email/Discord/Slack/Telegram calls.
  if (
    project.alerts_silenced_until &&
    new Date(project.alerts_silenced_until).getTime() > Date.now()
  ) {
    return;
  }

  // D6 (drill-nav backlog): quiet hours are project-wide, same
  // all-or-nothing suppression as alerts_silenced_until above.
  if (
    isInQuietHours(
      new Date(),
      project.quiet_hours_start ?? null,
      project.quiet_hours_end ?? null,
      project.quiet_hours_tz ?? "Europe/Paris",
    )
  ) {
    return;
  }

  // D6: per-URL silence ("Couper 4h" on /urls) drops just that item — the
  // run itself already happened and was recorded regardless.
  const activeItems = items.filter(
    (item) =>
      !item.silencedUntil || new Date(item.silencedUntil).getTime() <= Date.now(),
  );
  if (activeItems.length === 0) return;
  items = activeItems;

  // Preview-deployment alerts (runner.ts's runPreviewChecks) pass
  // recordDedup: false — their fingerprint doesn't encode the preview URL
  // (computeFingerprint is URL-agnostic), so recording them here would
  // make shouldSendFailAlert wrongly dedup a genuine production failure on
  // the same target that happens to produce the same fingerprint shortly
  // after.
  const recordDedup = options?.recordDedup ?? true;

  if (project.ownerEmail) {
    try {
      await sendFailEmail(project.ownerEmail, project.id, project.name, items);
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

  if (
    project.ownerPlanAllowsChatWebhooks &&
    project.telegram_bot_token &&
    project.telegram_chat_id
  ) {
    try {
      await sendTelegramAlert(
        project.telegram_bot_token,
        project.telegram_chat_id,
        project.name,
        items,
      );
      if (recordDedup) await recordAlertEvents(supabase, project.id, items, "telegram");
    } catch (err) {
      console.error("Échec envoi Telegram", err);
    }
  }

  // D8 (drill-nav backlog): sent after every other channel, from the same
  // already-filtered `items` — inherits project silence, quiet hours,
  // confirm-after-N-fails, and per-URL silence for free. The payload has
  // one event per delivery, so a batch mixing fails and recoveries (a
  // project-wide run where one target broke while another recovered)
  // becomes two deliveries, one per kind.
  if (
    project.ownerPlanAllowsChatWebhooks &&
    project.outbound_webhook_url &&
    project.outbound_webhook_secret
  ) {
    const byKind = new Map<AlertItem["kind"], AlertItem[]>();
    for (const item of items) {
      const bucket = byKind.get(item.kind) ?? [];
      bucket.push(item);
      byKind.set(item.kind, bucket);
    }

    for (const [kind, kindItems] of byKind) {
      await sendOutboundWebhook(project.outbound_webhook_url, project.outbound_webhook_secret, {
        event: kind,
        projectId: project.id,
        projectName: project.name,
        items: kindItems.map((item) => ({
          url: item.url,
          httpStatus: item.httpStatus,
          missing: item.missing ?? null,
        })),
      });
    }
  }
}
