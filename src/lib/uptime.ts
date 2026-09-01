import type { SupabaseClient } from "@supabase/supabase-js";

export type UptimeStats = {
  pct24h: number | null;
  pct7d: number | null;
  pct30d: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

async function pctSince(
  supabase: SupabaseClient,
  projectId: string,
  sinceIso: string,
): Promise<number | null> {
  const { count: total } = await supabase
    .from("check_runs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .gte("started_at", sinceIso);

  if (!total) return null;

  const { count: passing } = await supabase
    .from("check_runs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("outcome", "pass")
    .gte("started_at", sinceIso);

  return ((passing ?? 0) / total) * 100;
}

// Count-only queries (head: true) rather than fetching raw rows — a busy
// Team project checking 50 URLs every 5 min can produce hundreds of
// thousands of rows over 30 days, too much to pull down just to average.
export async function getUptimeStats(
  supabase: SupabaseClient,
  projectId: string,
): Promise<UptimeStats> {
  const now = Date.now();
  const [pct24h, pct7d, pct30d] = await Promise.all([
    pctSince(supabase, projectId, new Date(now - 1 * DAY_MS).toISOString()),
    pctSince(supabase, projectId, new Date(now - 7 * DAY_MS).toISOString()),
    pctSince(supabase, projectId, new Date(now - 30 * DAY_MS).toISOString()),
  ]);

  return { pct24h, pct7d, pct30d };
}
