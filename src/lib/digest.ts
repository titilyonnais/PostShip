import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/service";
import { escapeHtml, renderEmailShell } from "@/lib/email-template";
import { getPlanLimits, type Plan } from "@/lib/entitlements";

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
  if (pct === null) return "#8b949e";
  if (pct >= 99) return "#3fb950";
  if (pct >= 95) return "#d29922";
  return "#f85149";
}

function buildDigestEmailHtml(
  projectName: string,
  stats: ProjectDigestStats,
  projectUrl: string,
): string {
  const statRow = (label: string, value: string, color = "#e6edf3") => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #21262d;">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;color:#8b949e;">${escapeHtml(label)}</td>
            <td style="text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;font-weight:600;color:${color};">${value}</td>
          </tr>
        </table>
      </td>
    </tr>`;

  const rows = [
    statRow("Disponibilité — 7 jours", formatUptime(stats.uptimePct), uptimeColor(stats.uptimePct)),
    statRow("Vérifications", String(stats.runs)),
    statRow("Échecs", String(stats.fails), stats.fails > 0 ? "#f85149" : "#e6edf3"),
    ...(stats.sslDaysRemaining !== null
      ? [statRow("Certificat SSL", `${stats.sslDaysRemaining} j`, stats.sslDaysRemaining <= 7 ? "#f85149" : "#e6edf3")]
      : []),
  ].join("");

  return renderEmailShell({
    preheader: `Résumé hebdomadaire — ${projectName}`,
    title: `${projectName} — résumé de la semaine`,
    intro: "Voici comment votre site s'est comporté ces 7 derniers jours.",
    bodyHtml: `<table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="margin:20px 0 0;"><a href="${projectUrl}" style="display:inline-block;background:#3fb950;color:#0a0c0e;font-size:13px;font-weight:600;text-decoration:none;padding:9px 16px;border-radius:10px;">Voir le projet</a></p>`,
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
    html: buildDigestEmailHtml(projectName, stats, projectUrl),
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
