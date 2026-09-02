import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { runWithConcurrencyLimit } from "@/lib/concurrency";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { runProjectChecks } from "@/lib/runner";
import { advanceSiteScans } from "@/lib/scan";

// Processing several site-scan batches per tick (see src/lib/scan.ts) can
// run past the platform default — give it real headroom.
export const maxDuration = 60;

const LOCK_ID = 1;
// Comfortably under maxDuration — if a tick actually runs this long the
// invocation is about to be killed anyway, so the lock should free up
// for the next one rather than block it.
const LOCK_TTL_MS = 55_000;
const INTER_PROJECT_CONCURRENCY = 5;

type DueProjectRow = {
  id: string;
  last_checked_at: string | null;
  paused: boolean;
  profiles: { plan: Plan } | null;
};

async function acquireLock(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<boolean> {
  const now = new Date();
  const { data, error } = await supabase
    .from("cron_lock")
    .update({ locked_until: new Date(now.getTime() + LOCK_TTL_MS).toISOString() })
    .eq("id", LOCK_ID)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select("id");

  if (error) {
    // Fail open rather than silently never ticking again if the lock table
    // itself is unreachable — a rare double-run beats a permanently stuck
    // cron.
    console.error("Impossible d'acquérir le verrou cron", error);
    return true;
  }

  return (data?.length ?? 0) > 0;
}

async function releaseLock(supabase: ReturnType<typeof createServiceClient>) {
  await supabase.from("cron_lock").update({ locked_until: null }).eq("id", LOCK_ID);
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  if (!(await acquireLock(supabase))) {
    return NextResponse.json({ skipped: "tick already in progress" });
  }

  try {
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

    // One project's checks (and its own intra-project concurrency, see
    // runner.ts) shouldn't block the next project from starting — a tick
    // covering 20 projects at up to a few seconds each was easily blowing
    // past maxDuration run one at a time.
    await runWithConcurrencyLimit(jobs, INTER_PROJECT_CONCURRENCY, async (job) => {
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
    });

    try {
      await advanceSiteScans();
    } catch (err) {
      console.error("Échec avancement scan de site", err);
    }

    return NextResponse.json({ checked: jobs.length, failed });
  } finally {
    await releaseLock(supabase);
  }
}
