import type { SupabaseClient } from "@supabase/supabase-js";
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
};

// Called from the 3 deploy webhook routes, after runProjectChecks /
// runPreviewChecks — a failed insert here must never surface as a 500,
// the site checks it's logging already ran.
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
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("deploy_events").insert({
      project_id: params.projectId,
      provider: params.provider,
      kind: params.kind,
      sha: params.sha,
      deployment_url: params.deploymentUrl,
      outcome: params.outcome,
      fail_count: params.failCount,
      snapshot: params.snapshot,
    });
    if (error) console.error("Échec enregistrement deploy_events", error);
  } catch (err) {
    console.error("Échec enregistrement deploy_events", err);
  }
}

export async function getRecentDeployEvents(
  supabase: SupabaseClient,
  projectId: string,
): Promise<DeployEventRow[]> {
  const { data } = await supabase
    .from("deploy_events")
    .select(
      "id, provider, kind, sha, deployment_url, started_at, outcome, fail_count, snapshot",
    )
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(30);
  return (data ?? []) as DeployEventRow[];
}
