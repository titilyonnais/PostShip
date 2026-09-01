import type { SupabaseClient } from "@supabase/supabase-js";

export type UptimeWindow = { pct: number | null; count: number };
export type UptimeStats = {
  h24: UptimeWindow;
  d7: UptimeWindow;
  d30: UptimeWindow;
};

const DAY_MS = 24 * 60 * 60 * 1000;

async function windowSince(
  supabase: SupabaseClient,
  projectId: string,
  sinceIso: string,
): Promise<UptimeWindow> {
  const [{ count: total }, { count: passing }] = await Promise.all([
    supabase
      .from("check_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("started_at", sinceIso),
    supabase
      .from("check_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("outcome", "pass")
      .gte("started_at", sinceIso),
  ]);

  if (!total) return { pct: null, count: 0 };

  return { pct: ((passing ?? 0) / total) * 100, count: total };
}

// Count-only queries (head: true) rather than fetching raw rows — a busy
// Team project checking 50 URLs every 5 min can produce hundreds of
// thousands of rows over 30 days, too much to pull down just to average.
export async function getUptimeStats(
  supabase: SupabaseClient,
  projectId: string,
): Promise<UptimeStats> {
  const now = Date.now();
  const [h24, d7, d30] = await Promise.all([
    windowSince(supabase, projectId, new Date(now - 1 * DAY_MS).toISOString()),
    windowSince(supabase, projectId, new Date(now - 7 * DAY_MS).toISOString()),
    windowSince(supabase, projectId, new Date(now - 30 * DAY_MS).toISOString()),
  ]);

  return { h24, d7, d30 };
}
