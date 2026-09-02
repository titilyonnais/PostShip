import { NextResponse } from "next/server";
import { BUDGET_EXHAUSTED_MESSAGE, createFetchBudget } from "@/lib/budgets";
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
  base_url: string;
  last_checked_at: string | null;
  paused: boolean;
  profiles: { plan: Plan } | null;
};

type AcquireLockResult = "acquired" | "held" | "error";

async function acquireLock(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<AcquireLockResult> {
  const now = new Date();
  const { data, error } = await supabase
    .from("cron_lock")
    .update({ locked_until: new Date(now.getTime() + LOCK_TTL_MS).toISOString() })
    .eq("id", LOCK_ID)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select("id");

  if (error) {
    // Fail closed, deliberately reversing this route's earlier behavior:
    // proceeding without a working lock risks concurrent double-processing
    // (duplicate alerts, duplicate checks) across overlapping invocations,
    // which is worse than sitting out one tick — the next cron call a few
    // minutes later catches up.
    console.error("Impossible d'acquérir le verrou cron", error);
    return "error";
  }

  return (data?.length ?? 0) > 0 ? "acquired" : "held";
}

async function releaseLock(supabase: ReturnType<typeof createServiceClient>) {
  await supabase.from("cron_lock").update({ locked_until: null }).eq("id", LOCK_ID);
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const lockResult = await acquireLock(supabase);
  if (lockResult === "error") {
    return NextResponse.json({ skipped: "lock_unavailable" }, { status: 503 });
  }
  if (lockResult === "held") {
    return NextResponse.json({ skipped: "tick already in progress" });
  }

  // One budget shared across every project this tick touches (see
  // src/lib/budgets.ts) — a pathological due-project count, or a slow
  // site-scan, must not turn a single invocation into an unbounded number
  // of outbound requests. Manual, user-triggered runs never receive one.
  const budget = createFetchBudget();

  try {
    const now = Date.now();

    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, base_url, last_checked_at, paused, profiles(plan)");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const dueProjects = ((projects ?? []) as unknown as DueProjectRow[])
      .filter((project) => !project.paused)
      .filter((project) => {
        const plan = project.profiles?.plan ?? "free";
        const intervalMs = getPlanLimits(plan).intervalMinutes * 60_000;
        if (!project.last_checked_at) return true;
        return now - new Date(project.last_checked_at).getTime() >= intervalMs;
      });

    if (dueProjects.length === 0) {
      try {
        await advanceSiteScans(budget);
      } catch (err) {
        console.error("Échec avancement scan de site", err);
      }
      return NextResponse.json({ checked: 0, failed: 0, skippedUnverified: 0 });
    }

    // Cron only runs projects whose base_url host has proven ownership
    // (see src/lib/domain-verify.ts) — anyone could otherwise point a
    // project at a domain they don't control and use PostShip's
    // infrastructure as a free, scheduled HTTP client against it. Manual
    // "Lancer maintenant" runs are exempt (the user is authenticated and
    // already rate-limited by its own cooldown).
    const { data: verifications } = await supabase
      .from("domain_verifications")
      .select("project_id, host")
      .in(
        "project_id",
        dueProjects.map((p) => p.id),
      )
      .not("verified_at", "is", null);

    const verifiedProjectIds = new Set(
      dueProjects
        .filter((project) => {
          let host: string;
          try {
            host = new URL(project.base_url).hostname;
          } catch {
            return false;
          }
          return (verifications ?? []).some(
            (v) => v.project_id === project.id && v.host === host,
          );
        })
        .map((p) => p.id),
    );

    const skippedUnverified = dueProjects.length - verifiedProjectIds.size;
    const dueProjectIds = dueProjects
      .filter((p) => verifiedProjectIds.has(p.id))
      .map((p) => p.id);

    if (dueProjectIds.length === 0) {
      try {
        await advanceSiteScans(budget);
      } catch (err) {
        console.error("Échec avancement scan de site", err);
      }
      return NextResponse.json({ checked: 0, failed: 0, skippedUnverified });
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
      // Checked before even starting the job, not just inside the fetches
      // themselves — once the tick's shared budget is gone, remaining jobs
      // are marked done-with-error immediately rather than each one
      // starting, immediately hitting the exhausted budget on its first
      // fetch, and still paying for the job bookkeeping round-trips.
      if (budget.remaining <= 0) {
        failed += 1;
        await supabase
          .from("check_jobs")
          .update({
            status: "error",
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
            error: BUDGET_EXHAUSTED_MESSAGE,
          })
          .eq("id", job.id);
        return;
      }

      await supabase
        .from("check_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", job.id);

      try {
        await runProjectChecks(job.project_id, budget);
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
      await advanceSiteScans(budget);
    } catch (err) {
      console.error("Échec avancement scan de site", err);
    }

    return NextResponse.json({ checked: jobs.length, failed, skippedUnverified });
  } finally {
    await releaseLock(supabase);
  }
}
