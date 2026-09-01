import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { runProjectChecks } from "@/lib/runner";
import { advanceSiteScans } from "@/lib/scan";

type DueProjectRow = {
  id: string;
  last_checked_at: string | null;
  paused: boolean;
  profiles: { plan: Plan } | null;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = Date.now();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, last_checked_at, paused, profiles(plan)");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dueProjectIds = ((projects ?? []) as unknown as DueProjectRow[])
    .filter((project) => !project.paused)
    .filter((project) => {
      const plan = project.profiles?.plan ?? "free";
      const intervalMs = getPlanLimits(plan).intervalMinutes * 60_000;
      if (!project.last_checked_at) return true;
      return now - new Date(project.last_checked_at).getTime() >= intervalMs;
    })
    .map((project) => project.id);

  if (dueProjectIds.length === 0) {
    try {
      await advanceSiteScans();
    } catch (err) {
      console.error("Échec avancement scan de site", err);
    }
    return NextResponse.json({ checked: 0, failed: 0 });
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("check_jobs")
    .insert(
      dueProjectIds.map((projectId) => ({
        project_id: projectId,
        reason: "cron",
      })),
    )
    .select("id, project_id");

  if (jobsError || !jobs) {
    return NextResponse.json(
      { error: jobsError?.message ?? "Impossible de créer les jobs." },
      { status: 500 },
    );
  }

  let failed = 0;

  for (const job of jobs) {
    await supabase
      .from("check_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", job.id);

    try {
      await runProjectChecks(job.project_id);
      await supabase
        .from("check_jobs")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("id", job.id);
    } catch (err) {
      failed += 1;
      await supabase
        .from("check_jobs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", job.id);
    }
  }

  try {
    await advanceSiteScans();
  } catch (err) {
    console.error("Échec avancement scan de site", err);
  }

  return NextResponse.json({ checked: jobs.length, failed });
}
