import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDeployWatchJobs, type WatchReason } from "@/lib/deploy-watches";
import type { SnapshotItem } from "@/lib/deploy-diff";

export type DeployProvider = "vercel" | "netlify" | "cloudflare";
export type DeployKind = "production" | "preview";

export type DeployEventRow = {
  id: string;
  provider: DeployProvider;
  kind: DeployKind;
  sha: string | null;
  deployment_url: string | null;
  started_at: string;
  outcome: "pass" | "fail" | "error" | null;
  fail_count: number;
  snapshot: SnapshotItem[];
  // V7 (ia-moderne backlog) — null for cron/manual runs and preview
  // deploys, and for any deploy from before this feature.
  score: number | null;
  score_reason: string | null;
};

// Called from the 3 deploy webhook routes, after runProjectChecks /
// runPreviewChecks — a failed insert here must never surface as a 500,
// the site checks it's logging already ran. Returns the inserted row's
// id (or null on failure) so the caller can schedule V5's T+2/T+8 watches
// against it.
export async function recordDeployEvent(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    provider: DeployProvider;
    kind: DeployKind;
    sha: string | null;
    deploymentUrl: string | null;
    outcome: "pass" | "fail" | "error" | null;
    failCount: number;
    snapshot: SnapshotItem[];
    // V7 (ia-moderne backlog) — omitted (or null) for a preview deploy,
    // which recordDeployEvent is still called for.
    score?: number | null;
    scoreReason?: string | null;
  },
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("deploy_events")
      .insert({
        project_id: params.projectId,
        provider: params.provider,
        kind: params.kind,
        sha: params.sha,
        deployment_url: params.deploymentUrl,
        outcome: params.outcome,
        fail_count: params.failCount,
        snapshot: params.snapshot,
        score: params.score ?? null,
        score_reason: params.scoreReason ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("Échec enregistrement deploy_events", error);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("Échec enregistrement deploy_events", err);
    return null;
  }
}

// V5 (ia-moderne backlog): queues the T+2/T+8 re-checks for a production
// deploy — Solo+ only (Free gets T+0 only, see the plan gate at each call
// site). A failed insert here must never surface as a 500 either; the
// T+0 check and its deploy_events row already happened regardless.
export async function scheduleDeployWatches(
  supabase: SupabaseClient,
  projectId: string,
  deployEventId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("check_jobs")
      .insert(buildDeployWatchJobs(projectId, deployEventId));
    if (error) console.error("Échec planification des watches T+2/T+8", error);
  } catch (err) {
    console.error("Échec planification des watches T+2/T+8", err);
  }
}

export type DeployWatchStatus = {
  reason: WatchReason;
  status: "queued" | "running" | "done" | "error";
  outcome: "pass" | "fail" | null;
};

// Reads back the watch jobs for a batch of deploy_events ids, for the
// Déplois page's "T+0 OK · T+2 en attente · T+8 —" line.
export async function getDeployWatchesByEvent(
  supabase: SupabaseClient,
  deployEventIds: string[],
): Promise<Map<string, DeployWatchStatus[]>> {
  const byEvent = new Map<string, DeployWatchStatus[]>();
  if (deployEventIds.length === 0) return byEvent;

  const { data } = await supabase
    .from("check_jobs")
    .select("deploy_event_id, reason, status, outcome")
    .in("deploy_event_id", deployEventIds)
    .in("reason", ["watch_t2", "watch_t8"]);

  for (const row of data ?? []) {
    const list = byEvent.get(row.deploy_event_id as string) ?? [];
    list.push({
      reason: row.reason as WatchReason,
      status: row.status as DeployWatchStatus["status"],
      outcome: row.outcome as DeployWatchStatus["outcome"],
    });
    byEvent.set(row.deploy_event_id as string, list);
  }

  return byEvent;
}

export async function getRecentDeployEvents(
  supabase: SupabaseClient,
  projectId: string,
): Promise<DeployEventRow[]> {
  const { data } = await supabase
    .from("deploy_events")
    .select(
      "id, provider, kind, sha, deployment_url, started_at, outcome, fail_count, snapshot, score, score_reason",
    )
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(30);
  return (data ?? []) as DeployEventRow[];
}

// Stamped as soon as a request's signature verifies, before any decision
// about whether this particular event is one we act on — the question the
// Intégrations card answers with it is "is the webhook wired up at all",
// and a deployment.created we deliberately skip proves that just as well
// as a deployment.ready. Best-effort: never let a bookkeeping write break
// the webhook's own response.
export async function recordDeployHookReceipt(
  supabase: SupabaseClient,
  projectId: string,
  provider: DeployProvider,
): Promise<void> {
  const column = `${provider}_hook_last_received_at` as const;
  const { error } = await supabase
    .from("projects")
    .update({ [column]: new Date().toISOString() })
    .eq("id", projectId);

  if (error) console.error("Échec enregistrement réception webhook", provider, error);
}
