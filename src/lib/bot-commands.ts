import type { SupabaseClient } from "@supabase/supabase-js";
import { getUptimeStats } from "@/lib/uptime";
import { runProjectChecks } from "@/lib/runner";
import { assertPublicHttpsUrl } from "@/lib/ssrf";

// Mirrors runProjectNow's cooldown (src/app/(app)/app/[projectId]/actions.ts)
// — /check goes through the same runner, so it gets the same guard against
// someone mashing the command.
const CHECK_COOLDOWN_MS = 30_000;

export type BotCommandContext = {
  supabase: SupabaseClient;
  projectId: string;
};

async function statusCommand(ctx: BotCommandContext): Promise<string> {
  const { data: targets } = await ctx.supabase
    .from("check_targets")
    .select("url, last_outcome")
    .eq("project_id", ctx.projectId)
    .eq("enabled", true);

  const rows = targets ?? [];
  const total = rows.length;
  const passing = rows.filter((t) => t.last_outcome === "pass").length;
  const failing = rows.filter(
    (t) => t.last_outcome === "fail" || t.last_outcome === "error",
  );

  let text = `${total} URL · ${passing} OK · ${failing.length} en échec`;
  if (failing.length > 0) {
    text += "\n" + failing.slice(0, 3).map((t) => t.url).join("\n");
  }
  return text;
}

async function checkCommand(ctx: BotCommandContext): Promise<string> {
  const { data: project } = await ctx.supabase
    .from("projects")
    .select("last_checked_at")
    .eq("id", ctx.projectId)
    .single();

  if (project?.last_checked_at) {
    const elapsedMs = Date.now() - new Date(project.last_checked_at).getTime();
    if (elapsedMs < CHECK_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((CHECK_COOLDOWN_MS - elapsedMs) / 1000);
      return `Patientez ${waitSeconds}s avant de relancer.`;
    }
  }

  await runProjectChecks(ctx.projectId);
  return "Vérification lancée.";
}

async function uptimeCommand(ctx: BotCommandContext): Promise<string> {
  const stats = await getUptimeStats(ctx.supabase, ctx.projectId);
  const fmt = (pct: number | null) => (pct === null ? "—" : `${pct.toFixed(1)}%`);
  return `24h : ${fmt(stats.h24.pct)} · 7j : ${fmt(stats.d7.pct)}`;
}

async function sslCommand(ctx: BotCommandContext): Promise<string> {
  const { data: sslTarget } = await ctx.supabase
    .from("check_targets")
    .select("id")
    .eq("project_id", ctx.projectId)
    .eq("kind", "ssl")
    .limit(1)
    .maybeSingle();

  if (!sslTarget) return "pas de check SSL";

  const { data: lastRun } = await ctx.supabase
    .from("check_runs")
    .select("details")
    .eq("target_id", sslTarget.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const details = lastRun?.details as { daysRemaining?: number } | null;
  return typeof details?.daysRemaining === "number"
    ? `${details.daysRemaining} jour(s) restant(s)`
    : "pas de check SSL";
}

// N5 (nav-pro backlog): same effect as the "Couper 1h/4h/24h" bar on the
// Incidents page — writes the same alerts_silenced_until column. `off`
// (or any argument that isn't a bare "<n>h") resumes alerts immediately
// rather than erroring, since a silenced channel shouldn't need to parse
// a usage message correctly to unmute itself.
async function silenceCommand(ctx: BotCommandContext, rawText: string): Promise<string> {
  const arg = rawText.trim().split(/\s+/)[1]?.toLowerCase();
  const match = arg?.match(/^(\d+)h$/);
  const hours = match ? parseInt(match[1], 10) : 0;

  const alertsSilencedUntil =
    hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null;

  await ctx.supabase
    .from("projects")
    .update({ alerts_silenced_until: alertsSilencedUntil })
    .eq("id", ctx.projectId);

  return alertsSilencedUntil
    ? `Alertes coupées pour ${hours}h.`
    : "Alertes reprises.";
}

export const HELP_TEXT = [
  "/status — état actuel",
  "/check — relance une vérification",
  "/uptime — taux de réussite 24h/7j",
  "/ssl — jours restants du certificat",
  "/silence 1h|4h|24h|off — coupe ou reprend les alertes",
  "/help — cette liste",
].join("\n");

const COMMAND_NAMES = [
  "/status",
  "/check",
  "/uptime",
  "/ssl",
  "/silence",
  "/help",
] as const;
export type BotCommand = (typeof COMMAND_NAMES)[number];

export function parseBotCommand(text: string): BotCommand {
  // Telegram appends "@BotName" to commands in group chats
  // ("/status@MyBot") — strip it before matching.
  const trimmed = text.trim().split(/\s/)[0]?.split("@")[0]?.toLowerCase();
  return (COMMAND_NAMES as readonly string[]).includes(trimmed)
    ? (trimmed as BotCommand)
    : "/help";
}

// Posts a plain text message to whichever chat channels are configured —
// used by both the "envoyer un /status de test" button (M3a) and the
// Telegram incoming-command handler's reply (M3b). Discord goes through
// the same SSRF guard as every other outbound fetch in this codebase
// (CLAUDE.md) even though discord_webhook_url is already DB-locked to
// discord.com; Telegram's host is the fixed api.telegram.org literal, not
// user input, so nothing to guard there.
export async function sendBotMessage(
  project: {
    discord_webhook_url: string | null;
    telegram_bot_token: string | null;
    telegram_chat_id: string | null;
  },
  text: string,
): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (project.discord_webhook_url) {
    const guard = await assertPublicHttpsUrl(project.discord_webhook_url);
    if (guard.ok) {
      tasks.push(
        fetch(project.discord_webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        }),
      );
    }
  }

  if (project.telegram_bot_token && project.telegram_chat_id) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${project.telegram_bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: project.telegram_chat_id, text }),
      }),
    );
  }

  await Promise.allSettled(tasks);
}

export async function runBotCommand(
  command: BotCommand,
  ctx: BotCommandContext,
  rawText: string = command,
): Promise<string> {
  switch (command) {
    case "/status":
      return statusCommand(ctx);
    case "/check":
      return checkCommand(ctx);
    case "/uptime":
      return uptimeCommand(ctx);
    case "/ssl":
      return sslCommand(ctx);
    case "/silence":
      return silenceCommand(ctx, rawText);
    case "/help":
    default:
      return HELP_TEXT;
  }
}
