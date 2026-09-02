import type { SupabaseClient } from "@supabase/supabase-js";

export type HeatmapDay = { date: string; failRuns: number; totalRuns: number };

export type Reliability = {
  heatmap: HeatmapDay[];
  mttrMinutes: number | null;
  incidents30d: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

// check_runs can run into the hundreds of thousands of rows over 30 days for
// a busy Team project, but the heatmap needs a per-day pass/fail split, so
// unlike getUptimeStats this pulls raw (started_at, outcome) pairs rather
// than count-only queries.
export async function getReliability(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Reliability> {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const sinceIso = since.toISOString();

  const [{ data: runs }, { data: events }] = await Promise.all([
    supabase
      .from("check_runs")
      .select("started_at, outcome")
      .eq("project_id", projectId)
      .gte("started_at", sinceIso),
    supabase
      .from("alert_events")
      .select("target_id, kind, sent_at")
      .eq("project_id", projectId)
      .in("kind", ["fail", "recovered"])
      .gte("sent_at", sinceIso)
      .order("sent_at", { ascending: true }),
  ]);

  const byDate = new Map<string, { failRuns: number; totalRuns: number }>();
  for (const run of (runs ?? []) as { started_at: string; outcome: string }[]) {
    const key = run.started_at.slice(0, 10);
    const bucket = byDate.get(key) ?? { failRuns: 0, totalRuns: 0 };
    bucket.totalRuns += 1;
    if (run.outcome === "fail" || run.outcome === "error") bucket.failRuns += 1;
    byDate.set(key, bucket);
  }

  const heatmap: HeatmapDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? { failRuns: 0, totalRuns: 0 };
    heatmap.push({ date: key, ...bucket });
  }

  const openFailAt = new Map<string, string>();
  const cycleDurationsMin: number[] = [];
  let incidents30d = 0;
  for (const event of (events ?? []) as {
    target_id: string | null;
    kind: string;
    sent_at: string;
  }[]) {
    const targetId = event.target_id;
    if (!targetId) continue;
    if (event.kind === "fail") {
      incidents30d += 1;
      if (!openFailAt.has(targetId)) openFailAt.set(targetId, event.sent_at);
    } else if (event.kind === "recovered") {
      const failAt = openFailAt.get(targetId);
      if (failAt) {
        const minutes =
          (new Date(event.sent_at).getTime() - new Date(failAt).getTime()) / 60000;
        cycleDurationsMin.push(minutes);
        openFailAt.delete(targetId);
      }
    }
  }

  return {
    heatmap,
    mttrMinutes: median(cycleDurationsMin),
    incidents30d,
  };
}
