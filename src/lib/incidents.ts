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
  /** Every channel that carried this one alert, e.g. ["email", "discord"]. */
  channels: string[];
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
// One row per channel is written for every alert (src/lib/alerts.ts), so a
// project on email + Discord + Slack burns three rows per incident. The
// log used to select the newest 50 of those and stop: a 30-day range
// really showed about five hours, and each incident three times over.
//
// So it now collapses those rows back into the alerts they came from —
// same target, same kind, same fingerprint, within the dedup window — and
// reads far enough back to fill the range being asked for.
const RAW_EVENT_CAP = 1000;
const ENTRY_CAP = 200;
// Matches DEDUP_WINDOW_MS in src/lib/alerts.ts: rows further apart than
// this are, by definition, separate alerts rather than one fan-out.
const FANOUT_WINDOW_MS = 10 * 60 * 1000;

export async function getIncidentLog(
  supabase: SupabaseClient,
  projectId: string,
  sinceIso: string,
): Promise<IncidentLogEntry[]> {
  const { data: events } = await supabase
    .from("alert_events")
    .select("id, target_id, kind, channel, fingerprint, sent_at")
    .eq("project_id", projectId)
    .gte("sent_at", sinceIso)
    .order("sent_at", { ascending: false })
    .limit(RAW_EVENT_CAP);

  if (!events || events.length === 0) return [];

  // Greedy walk over the already-sorted rows rather than bucketing on a
  // fixed clock: the channels of one fan-out are written by separate
  // inserts milliseconds apart, and a fixed bucket would split the ones
  // that happen to straddle its boundary.
  const groups: {
    id: string;
    targetId: string | null;
    kind: "fail" | "recovered";
    fingerprint: string | null;
    channels: Set<string>;
    sentAt: string;
  }[] = [];
  const openByKey = new Map<string, (typeof groups)[number]>();

  for (const event of events) {
    const key = `${event.target_id}|${event.kind}|${event.fingerprint}`;
    const open = openByKey.get(key);
    const at = new Date(event.sent_at).getTime();

    if (open && new Date(open.sentAt).getTime() - at <= FANOUT_WINDOW_MS) {
      open.channels.add(event.channel);
      continue;
    }

    const group = {
      id: event.id,
      targetId: event.target_id,
      kind: event.kind as "fail" | "recovered",
      fingerprint: event.fingerprint,
      channels: new Set<string>([event.channel]),
      sentAt: event.sent_at,
    };
    groups.push(group);
    openByKey.set(key, group);
    if (groups.length >= ENTRY_CAP) break;
  }

  const targetIds = [
    ...new Set(groups.map((g) => g.targetId).filter((id): id is string => !!id)),
  ];
  const { data: targets } =
    targetIds.length > 0
      ? await supabase.from("check_targets").select("id, url").in("id", targetIds)
      : { data: [] };
  const urlById = new Map((targets ?? []).map((t) => [t.id, t.url]));

  return groups.map((g) => ({
    id: g.id,
    targetId: g.targetId,
    url: g.targetId ? (urlById.get(g.targetId) ?? "—") : "—",
    kind: g.kind,
    channels: [...g.channels].sort(),
    sentAt: g.sentAt,
  }));
}
