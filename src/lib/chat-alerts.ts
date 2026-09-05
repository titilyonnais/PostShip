// Discord and Slack alert payloads.
//
// Both channels used to receive the same flat blob of text as the
// plain-text/Telegram fallback: a title, then one line per URL. That
// reads as a log dump in a chat client, and it carried no link at all —
// seeing an alert meant going to find the project by hand.
//
// So they get real payloads here instead: a Discord embed (status color,
// one field per URL, footer timestamp) and Slack Block Kit (header,
// context recap, one section per URL, action buttons). Same content as
// the alert email — the missing-code lines spelled out, the HTTP/TTFB
// meta line — because a chat alert is read away from the dashboard too.
//
// alert-copy.ts stays what it is: deterministic text for the email
// subject, the plain-text part and Telegram.

import { describeAlertItemShort, type AlertCopyItem } from "@/lib/alert-copy";
import { CHECK_KIND_LABEL, describeMissingCode } from "@/lib/check-labels";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";
// 512x512, dark ground, generous padding — Discord and Slack both crop an
// avatar to a circle, so the mark has to survive that. Discord fetches and
// caches this per webhook post; Slack ignores it entirely (an
// OAuth-installed webhook always posts as the app itself, so its identity
// lives in the Slack app config — see docs/CHAT_APPS.md).
const AVATAR_URL = `${APP_URL}/brand/postship-avatar-512.png`;

export type ChatAlertItem = AlertCopyItem & {
  targetId: string;
  checkKind?: "http" | "og" | "sitemap" | "ssl" | "stripe_health";
};

// Discord caps an embed at 25 fields and 6000 characters across the whole
// object, so a 40-URL project can't just render every item. Eight stays
// well under both and still covers every realistic incident; the rest
// becomes one "+N autres" line pointing at the dashboard.
const MAX_ITEMS = 8;
const DISCORD_FIELD_MAX = 512;
// Slack allows 50 blocks; header + context + divider + actions take four.
const SLACK_TEXT_MAX = 2800;

const DISCORD_COLOR: Record<ChatAlertItem["kind"], number> = {
  fail: 0xf85149,
  recovered: 0x3fb950,
  mutated: 0xd29922,
};

const DISCORD_EMOJI: Record<ChatAlertItem["kind"], string> = {
  fail: "🔴",
  recovered: "🟢",
  mutated: "🟠",
};

const SLACK_EMOJI: Record<ChatAlertItem["kind"], string> = {
  fail: ":red_circle:",
  recovered: ":large_green_circle:",
  mutated: ":large_orange_circle:",
};

const KIND_LABEL: Record<ChatAlertItem["kind"], string> = {
  fail: "En échec",
  recovered: "Rétabli",
  mutated: "Contenu modifié",
};

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

// Same rule as the email card (src/lib/alerts.ts): spell out every
// missing code, and fall back to the one-sentence description only when
// there is nothing more specific to say.
function detailLines(item: ChatAlertItem): string[] {
  if (item.kind === "fail" && item.missing?.length) {
    return item.missing.map(describeMissingCode);
  }
  if (item.kind === "mutated") {
    return [item.mutationSummary ?? "Contenu modifié après déploiement."];
  }
  const short = describeAlertItemShort(item);
  return short ? [short] : [];
}

function metaLine(item: ChatAlertItem): string | null {
  const parts: string[] = [];
  if (item.httpStatus != null) parts.push(`HTTP ${item.httpStatus}`);
  if (item.ttfbMs != null) parts.push(`TTFB ${item.ttfbMs} ms`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

type ChatAlertSummary = {
  headline: string;
  recap: string;
  tone: ChatAlertItem["kind"];
};

// The tone drives the embed color and the Slack button style — a batch
// mixing a failure and a recovery is still a failure to whoever reads it.
export function summarizeChatAlert(items: ChatAlertItem[]): ChatAlertSummary {
  const nFail = items.filter((i) => i.kind === "fail").length;
  const nRecovered = items.filter((i) => i.kind === "recovered").length;
  const nMutated = items.filter((i) => i.kind === "mutated").length;

  const tone: ChatAlertItem["kind"] =
    nFail > 0 ? "fail" : nMutated > 0 ? "mutated" : "recovered";

  const headline =
    nFail > 0
      ? `${nFail} URL${nFail > 1 ? "s" : ""} en échec`
      : nMutated > 0
        ? `${nMutated} URL${nMutated > 1 ? "s" : ""} modifiée${nMutated > 1 ? "s" : ""}`
        : `${nRecovered} URL${nRecovered > 1 ? "s" : ""} rétablie${nRecovered > 1 ? "s" : ""}`;

  const counts = [
    nFail > 0 ? `${nFail} en échec` : null,
    nRecovered > 0 ? `${nRecovered} rétabli${nRecovered > 1 ? "s" : ""}` : null,
    nMutated > 0 ? `${nMutated} modifié${nMutated > 1 ? "s" : ""}` : null,
  ].filter((part): part is string => part !== null);

  const deployHint = items.find((i) => i.deployHint)?.deployHint ?? null;
  const recap = deployHint
    ? `Depuis le déploiement ${deployHint} · ${counts.join(" · ")}`
    : counts.join(" · ");

  return { headline, recap, tone };
}

function targetUrl(projectId: string, item: ChatAlertItem): string {
  return `${APP_URL}/app/${projectId}/${item.targetId}`;
}

function checkKindLabel(item: ChatAlertItem): string {
  return CHECK_KIND_LABEL[item.checkKind ?? "http"] ?? "HTTP";
}

export function buildDiscordPayload(
  projectId: string,
  projectName: string,
  items: ChatAlertItem[],
): Record<string, unknown> {
  const { headline, recap, tone } = summarizeChatAlert(items);
  const dashboardUrl = `${APP_URL}/app/${projectId}`;

  const fields = items.slice(0, MAX_ITEMS).map((item) => {
    const lines = [`[${item.url}](${targetUrl(projectId, item)})`, ...detailLines(item)];
    const meta = metaLine(item);
    if (meta) lines.push(`\`${meta}\``);

    return {
      name: truncate(
        `${DISCORD_EMOJI[item.kind]} ${KIND_LABEL[item.kind]} · ${checkKindLabel(item)}`,
        256,
      ),
      value: truncate(lines.join("\n"), DISCORD_FIELD_MAX),
      inline: false,
    };
  });

  const overflow = items.length - fields.length;
  // A zero-width name renders as a fieldless row — the only way to put
  // links at the foot of a Discord embed (the footer takes text only).
  fields.push({
    name: "​",
    value:
      (overflow > 0
        ? `+${overflow} autre${overflow > 1 ? "s" : ""} URL sur le tableau de bord\n`
        : "") +
      `[Tableau de bord](${dashboardUrl}) · [Incidents](${dashboardUrl}/incidents) · [Gérer les alertes](${dashboardUrl}/integrations)`,
    inline: false,
  });

  return {
    username: "PostShip",
    avatar_url: AVATAR_URL,
    embeds: [
      {
        author: {
          name: projectName,
          url: dashboardUrl,
          icon_url: AVATAR_URL,
        },
        title: headline,
        url: dashboardUrl,
        color: DISCORD_COLOR[tone],
        description: recap,
        fields,
        footer: { text: "PostShip · vérification post-déploiement" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function buildSlackPayload(
  projectId: string,
  projectName: string,
  items: ChatAlertItem[],
): Record<string, unknown> {
  const { headline, recap, tone } = summarizeChatAlert(items);
  const dashboardUrl = `${APP_URL}/app/${projectId}`;

  const sections = items.slice(0, MAX_ITEMS).map((item) => {
    const lines = [
      `${SLACK_EMOJI[item.kind]} *${KIND_LABEL[item.kind]}* · ${checkKindLabel(item)}`,
      `<${targetUrl(projectId, item)}|${item.url}>`,
      ...detailLines(item),
    ];
    const meta = metaLine(item);
    if (meta) lines.push(`\`${meta}\``);

    return {
      type: "section",
      text: { type: "mrkdwn", text: truncate(lines.join("\n"), SLACK_TEXT_MAX) },
    };
  });

  const overflow = items.length - sections.length;

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      // plain_text — no mrkdwn in a header, and Slack caps it at 150 chars.
      text: {
        type: "plain_text",
        text: truncate(`${projectName} — ${headline}`, 150),
        emoji: true,
      },
    },
    { type: "context", elements: [{ type: "mrkdwn", text: recap }] },
    { type: "divider" },
    ...sections,
  ];

  if (overflow > 0) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `+${overflow} autre${overflow > 1 ? "s" : ""} URL — <${dashboardUrl}|voir le tableau de bord>`,
        },
      ],
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Ouvrir le tableau de bord" },
        url: dashboardUrl,
        ...(tone === "fail" ? { style: "danger" } : {}),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Incidents" },
        url: `${dashboardUrl}/incidents`,
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Gérer les alertes" },
        url: `${dashboardUrl}/integrations`,
      },
    ],
  });

  return {
    // Fallback for notification previews and clients that skip blocks.
    text: `PostShip — ${projectName} : ${headline}`,
    blocks,
  };
}
