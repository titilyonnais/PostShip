import type { SupabaseClient } from "@supabase/supabase-js";
import { describeAlertItem } from "@/lib/alert-copy";

export type OpenIncident = {
  targetId: string;
  url: string;
  kind: string;
  outcome: string;
  description: string;
  since: string | null;
};

export type IncidentLogEntry = {
  id: string;
  targetId: string | null;
  url: string;
  kind: "fail" | "recovered";
  channel: string;
  sentAt: string;
};

// Targets currently down — check_targets.last_outcome is the cached
// "latest run" (migration 0031), so this never scans check_runs itself
// for the open list, only for each open target's one-sentence F4
// description (its own latest run's `missing` codes).
export async function getOpenIncidents(
  supabase: SupabaseClient,
  projectId: string,
): Promise<OpenIncident[]> {
  const { data: targets } = await supabase
    .from("check_targets")
    .select("id, url, kind, last_outcome, last_started_at")
    .eq("project_id", projectId)
    .eq("enabled", true)
    .in("last_outcome", ["fail", "error"]);

  if (!targets || targets.length === 0) return [];

  const targetIds = targets.map((t) => t.id);
  const { data: runs } = await supabase
    .from("check_runs")
    .select("target_id, http_status, started_at, details")
    .in("target_id", targetIds)
    .order("started_at", { ascending: false })
    .limit(targetIds.length * 3);

  const latestByTarget = new Map<
    string,
    { http_status: number | null; details: Record<string, unknown> | null }
  >();
  for (const run of runs ?? []) {
    if (!latestByTarget.has(run.target_id)) {
      latestByTarget.set(run.target_id, run);
    }
  }

  return targets.map((t) => {
    const latest = latestByTarget.get(t.id);
    const missing = Array.isArray(latest?.details?.missing)
      ? (latest.details.missing as string[])
      : undefined;

    return {
      targetId: t.id,
      url: t.url,
      kind: t.kind,
      outcome: t.last_outcome ?? "fail",
      description: describeAlertItem({
        url: t.url,
        kind: "fail",
        outcome: t.last_outcome ?? "fail",
        httpStatus: latest?.http_status ?? null,
        missing,
      }),
      since: t.last_started_at,
    };
  });
}

// The journal — every alert actually sent, not just the current state.
export async function getIncidentLog(
  supabase: SupabaseClient,
  projectId: string,
  sinceIso: string,
): Promise<IncidentLogEntry[]> {
  const { data: events } = await supabase
    .from("alert_events")
    .select("id, target_id, kind, channel, sent_at")
    .eq("project_id", projectId)
    .gte("sent_at", sinceIso)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (!events || events.length === 0) return [];

  const targetIds = [
    ...new Set(events.map((e) => e.target_id).filter((id): id is string => !!id)),
  ];
  const { data: targets } =
    targetIds.length > 0
      ? await supabase.from("check_targets").select("id, url").in("id", targetIds)
      : { data: [] };
  const urlById = new Map((targets ?? []).map((t) => [t.id, t.url]));

  return events.map((e) => ({
    id: e.id,
    targetId: e.target_id,
    url: e.target_id ? (urlById.get(e.target_id) ?? "—") : "—",
    kind: e.kind as "fail" | "recovered",
    channel: e.channel,
    sentAt: e.sent_at,
  }));
}
