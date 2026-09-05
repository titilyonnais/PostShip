import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { runRiskSweep } from "@/lib/admin-risk-sweep";

type ProjectRow = { id: string; profiles: { plan: Plan } | null };

// Purges check_runs past the owner's plan retention window
// (CLAUDE.md: 7/14/30 days). Runs once/day (see vercel.json) — retention
// doesn't need finer granularity than that.
const OPS_RETENTION_DAYS = 90;

// Stripe is called once per paying customer, so this needs more than the
// platform default even though the purge itself is instant.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, profiles(plan)");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let deletedTotal = 0;

  for (const project of (projects ?? []) as unknown as ProjectRow[]) {
    const retentionDays = getPlanLimits(project.profiles?.plan ?? "free")
      .retentionDays;
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { count, error: deleteError } = await supabase
      .from("check_runs")
      .delete({ count: "exact" })
      .eq("project_id", project.id)
      .lt("started_at", cutoff);

    if (!deleteError) deletedTotal += count ?? 0;
  }

  // The operations journal keeps 90 days regardless of plan — it is about
  // running the service, not about what a customer paid for.
  const opsCutoff = new Date(
    Date.now() - OPS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { count: opsDeleted } = await supabase
    .from("ops_events")
    .delete({ count: "exact" })
    .lt("at", opsCutoff);

  // The nightly risk sweep rides here rather than on its own schedule:
  // it is the same cadence, already authorised, and a second cron entry
  // buys nothing. It computes the full score — including the Stripe
  // signals the console only reaches when a file is opened — and records
  // a fraud event for anything at or above the threshold, once per
  // account per day.
  //
  // Never allowed to fail the purge: retention is a commitment, the sweep
  // is a convenience.
  let sweep: Awaited<ReturnType<typeof runRiskSweep>> | { error: string };
  try {
    sweep = await runRiskSweep();
  } catch (err) {
    console.error("Échec du balayage de risque", err);
    sweep = { error: err instanceof Error ? err.message : "unknown" };
  }

  // Visit telemetry is collected under legitimate interest for security
  // and fraud prevention. That basis does not survive an indefinite log
  // of who visited from where, so the raw stream is bounded at the same
  // 90 days as the journal. visitor_ips keeps its rollup: a count and a
  // last-seen date is not a browsing history.
  const { count: visitsDeleted } = await supabase
    .from("visits")
    .delete({ count: "exact" })
    .lt("at", opsCutoff);

  return NextResponse.json({
    projects: projects?.length ?? 0,
    visitsDeleted: visitsDeleted ?? 0,
    deleted: deletedTotal,
    opsEventsDeleted: opsDeleted ?? 0,
    risk: sweep,
  });
}
