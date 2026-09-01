import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { getPlanLimits, type Plan } from "@/lib/entitlements";

type ProjectRow = { id: string; profiles: { plan: Plan } | null };

// Purges check_runs past the owner's plan retention window
// (CLAUDE.md: 7/14/30 days). Runs once/day (see vercel.json) — retention
// doesn't need finer granularity than that.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

  return NextResponse.json({
    projects: projects?.length ?? 0,
    deleted: deletedTotal,
  });
}
