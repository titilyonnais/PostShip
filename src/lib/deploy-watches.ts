// V5 (ia-moderne backlog): "the 8 minutes after the ship" — a webhook
// saying OK at T+0 doesn't catch the CDN/DNS breaking a few minutes
// later. After a production deploy, on top of the immediate check, queue
// 2 more re-checks (T+2, T+8) as check_jobs rows the cron tick picks up
// like any other project run.
export type WatchReason = "watch_t2" | "watch_t8";

export const WATCH_REASONS: WatchReason[] = ["watch_t2", "watch_t8"];

export const WATCH_OFFSET_MINUTES: Record<WatchReason, number> = {
  watch_t2: 2,
  watch_t8: 8,
};

export function deployHintForWatchReason(reason: WatchReason): string {
  return reason === "watch_t2" ? "T+2" : "T+8";
}

export type DeployWatchJobInsert = {
  project_id: string;
  reason: WatchReason;
  status: "queued";
  run_after: string;
  deploy_event_id: string;
};

// Builds the 2 rows to insert — the DB's unique (project_id,
// deploy_event_id, reason) index (migration 0048) is the actual dedup
// backstop against a retried webhook delivery queuing a 3rd; this just
// keeps every call site producing the same canonical payload.
export function buildDeployWatchJobs(
  projectId: string,
  deployEventId: string,
  now: Date = new Date(),
): DeployWatchJobInsert[] {
  return WATCH_REASONS.map((reason) => ({
    project_id: projectId,
    reason,
    status: "queued" as const,
    run_after: new Date(now.getTime() + WATCH_OFFSET_MINUTES[reason] * 60_000).toISOString(),
    deploy_event_id: deployEventId,
  }));
}
