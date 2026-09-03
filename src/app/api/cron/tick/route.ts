import { NextResponse } from "next/server";
import { BUDGET_EXHAUSTED_MESSAGE, createFetchBudget, type FetchBudget } from "@/lib/budgets";
import { createServiceClient } from "@/lib/db/service";
import { runWithConcurrencyLimit } from "@/lib/concurrency";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { deployHintForWatchReason, type WatchReason } from "@/lib/deploy-watches";
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

type Job = {
  id: string;
  project_id: string;
  // Set only for a V5 watch job (ia-moderne backlog) — passed through to
  // runProjectChecks as deployHint, and its outcome is additionally
  // recorded on the job row for the Déplois page to read back.
  deployHint?: string;
  isWatch: boolean;
};

// Runs one batch of check_jobs rows (cron due-projects and/or V5's T+2/T+8
// watches) under the tick's shared budget, updating each row's
// status/error (and outcome, for watches) as it completes. Returns how
// many failed to run (an exception, not a site check failing).
async function processJobs(
  supabase: ReturnType<typeof createServiceClient>,
  jobs: Job[],
  budget: FetchBudget,
): Promise<number> {
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
      const results = await runProjectChecks(job.project_id, budget, job.deployHint);
      const outcome = job.isWatch
        ? results.length === 0
          ? null
          : results.every((r) => r.outcome === "pass")
            ? "pass"
            : "fail"
        : undefined;
      await supabase
        .from("check_jobs")
        .update({
          status: "done",
          finished_at: new Date().toISOString(),
          ...(job.isWatch ? { outcome } : {}),
        })
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

  return failed;
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
    // Computed in SQL (migration 0030) against an index on
    // (paused, last_checked_at) — the previous version fetched every
    // project row (plan joined in) and filtered in JS regardless of how
    // many were actually due.
    const { data: dueIds, error: dueError } = (await supabase.rpc(
      "due_project_ids",
    )) as { data: { project_id: string }[] | null; error: { message: string } | null };

    if (dueError) {
      return NextResponse.json({ error: dueError.message }, { status: 500 });
    }

    const jobs: Job[] = [];

    if (dueIds && dueIds.length > 0) {
      // V4 (ia-moderne backlog): domain ownership no longer gates the
      // cron — assertPublicHttpsUrl's SSRF guard plus per-plan URL
      // quotas are the abuse control now (see addTarget's host-match
      // check for base_url itself). domain_verifications is left in
      // place but unread.
      const dueProjectIds = dueIds.map((row) => row.project_id);

      const { data: cronJobs, error: jobsError } = await supabase
        .from("check_jobs")
        .insert(dueProjectIds.map((projectId) => ({ project_id: projectId, reason: "cron" })))
        .select("id, project_id");

      if (jobsError) {
        return NextResponse.json({ error: jobsError.message }, { status: 500 });
      }

      for (const job of cronJobs ?? []) {
        jobs.push({ id: job.id, project_id: job.project_id, isWatch: false });
      }
    }

    // V5 (ia-moderne backlog): the T+2/T+8 re-checks queued by the deploy
    // webhook routes (src/lib/deploys.ts's scheduleDeployWatches) — due
    // the moment their run_after has passed.
    const { data: watchJobs, error: watchError } = await supabase
      .from("check_jobs")
      .select("id, project_id, reason")
      .eq("status", "queued")
      .in("reason", ["watch_t2", "watch_t8"])
      .lte("run_after", new Date().toISOString());

    if (watchError) {
      console.error("Échec lecture des watches T+2/T+8", watchError);
    }

    for (const job of watchJobs ?? []) {
      jobs.push({
        id: job.id,
        project_id: job.project_id,
        deployHint: deployHintForWatchReason(job.reason as WatchReason),
        isWatch: true,
      });
    }

    const failed = jobs.length > 0 ? await processJobs(supabase, jobs, budget) : 0;

    try {
      await advanceSiteScans(budget);
    } catch (err) {
      console.error("Échec avancement scan de site", err);
    }

    return NextResponse.json({ checked: jobs.length, failed });
  } finally {
    await releaseLock(supabase);
  }
}
