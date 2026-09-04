import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/service";
import {
  AMBER,
  escapeHtml,
  GREEN,
  INSET_BG,
  RED,
  renderEmailShell,
  TEXT,
  TEXT_MUTED,
} from "@/lib/email-template";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { formatDateTime } from "@/lib/timezone";

// F8a (features backlog): a Monday-morning "here's how last week went"
// email — one per project, not a multi-project wall of text. Solo/Team
// only (getPlanLimits(...).digest); Free gets nothing.
const DAY_MS = 24 * 60 * 60 * 1000;

type ProjectDigestStats = {
  uptimePct: number | null;
  runs: number;
  fails: number;
  sslDaysRemaining: number | null;
};

async function computeProjectStats(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectDigestStats> {
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();

  const [{ count: total }, { count: passing }] = await Promise.all([
    supabase
      .from("check_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("started_at", since),
    supabase
      .from("check_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("outcome", "pass")
      .gte("started_at", since),
  ]);

  const runs = total ?? 0;
  const passed = passing ?? 0;
  const fails = runs - passed;
  const uptimePct = runs > 0 ? (passed / runs) * 100 : null;

  let sslDaysRemaining: number | null = null;
  const { data: sslTarget } = await supabase
    .from("check_targets")
    .select("id")
    .eq("project_id", projectId)
    .eq("kind", "ssl")
    .limit(1)
    .maybeSingle();

  if (sslTarget) {
    const { data: lastRun } = await supabase
      .from("check_runs")
      .select("details")
      .eq("target_id", sslTarget.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const details = lastRun?.details as { daysRemaining?: number } | null;
    if (details && typeof details.daysRemaining === "number") {
      sslDaysRemaining = details.daysRemaining;
    }
  }

  return { uptimePct, runs, fails, sslDaysRemaining };
}

function formatUptime(pct: number | null): string {
  return pct === null ? "—" : `${pct.toFixed(1)}%`;
}

// Same red/amber/green thresholds as the app's own UptimeStatCard
// (src/app/(app)/app/[projectId]/page.tsx) — 99% and 95%.
function uptimeColor(pct: number | null): string {
  if (pct === null) return TEXT_MUTED;
  if (pct >= 99) return GREEN;
  if (pct >= 95) return AMBER;
  return RED;
}

function buildDigestEmailHtml(
  to: string,
  projectName: string,
  stats: ProjectDigestStats,
  projectUrl: string,
): string {
  const statCard = (label: string, value: string, color = TEXT) => `
    <td width="50%" valign="top" style="padding:4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td bgcolor="${INSET_BG}" style="background-color:${INSET_BG};border-radius:12px;padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:11px;color:${TEXT_MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(label)}</p>
            <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:20px;font-weight:600;color:${color};">${value}</p>
          </td>
        </tr>
      </table>
    </td>`;

  const cards = [
    statCard("Disponibilité — 7 j", formatUptime(stats.uptimePct), uptimeColor(stats.uptimePct)),
    statCard("Vérifications", String(stats.runs)),
    statCard("Échecs", String(stats.fails), stats.fails > 0 ? RED : TEXT),
    ...(stats.sslDaysRemaining !== null
      ? [statCard("Certificat SSL", `${stats.sslDaysRemaining} j`, stats.sslDaysRemaining <= 7 ? RED : TEXT)]
      : []),
  ];
  // Pair up into 2-column rows — email-safe grid via nested tables.
  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(`<tr>${cards[i]}${cards[i + 1] ?? '<td width="50%"></td>'}</tr>`);
  }

  const periodStart = formatDateTime(new Date(Date.now() - 7 * DAY_MS), null, {
    day: "numeric",
    month: "short",
  });
  const periodEnd = formatDateTime(new Date(), null, { day: "numeric", month: "short" });

  return renderEmailShell({
    preheader: `Résumé hebdomadaire — ${projectName}`,
    eyebrow: `Du ${periodStart} au ${periodEnd}`,
    title: `${projectName} — résumé de la semaine`,
    intro: "Voici comment votre site s'est comporté ces 7 derniers jours.",
    bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows.join("")}</table>`,
    cta: { href: projectUrl, label: "Ouvrir le tableau de bord" },
    manageEmails: true,
  });
}

async function sendDigestEmail(
  to: string,
  projectName: string,
  stats: ProjectDigestStats,
  projectUrl: string,
) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const lines = [
    `7 jours : ${formatUptime(stats.uptimePct)} · ${stats.runs} vérification(s) · ${stats.fails} échec(s)`,
    ...(stats.sslDaysRemaining !== null
      ? [`SSL : ${stats.sslDaysRemaining} jour(s) restant(s)`]
      : []),
    projectUrl,
  ];

  await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: `[PostShip] ${projectName} — résumé de la semaine`,
    text: lines.join("\n"),
    html: buildDigestEmailHtml(to, projectName, stats, projectUrl),
  });
}

export async function sendWeeklyDigests(): Promise<{ sent: number }> {
  const supabase = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, profiles(plan, email, email_alerts_enabled)");

  let sent = 0;

  for (const project of projects ?? []) {
    const owner = project.profiles as unknown as {
      plan: Plan;
      email: string | null;
      email_alerts_enabled: boolean;
    } | null;

    if (!owner?.email) continue;
    if (owner.email_alerts_enabled === false) continue;
    if (!getPlanLimits(owner.plan ?? "free").digest) continue;

    const stats = await computeProjectStats(supabase, project.id);

    try {
      await sendDigestEmail(owner.email, project.name, stats, `${appUrl}/app/${project.id}`);
      sent += 1;
    } catch (err) {
      console.error("Échec envoi digest hebdomadaire", project.id, err);
    }
  }

  return { sent };
}
