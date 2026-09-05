import { createServiceClient } from "@/lib/db/service";

export type VisitorIpRow = {
  ip: string;
  hits: number;
  firstSeenAt: string;
  lastSeenAt: string;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  distinctUsers: number;
  isBot: boolean;
  trusted: boolean;
};

export type VisitorOverview = {
  ips: VisitorIpRow[];
  totals: { visits24h: number; visits7d: number; uniqueIps: number; countries: number };
  byCountry: { country: string; hits: number }[];
  points: { lat: number; lon: number; hits: number; label: string }[];
  topPaths: { path: string; hits: number }[];
};

// One row per address, already rolled up by record_visit — the raw stream
// is only read for the breakdowns, and never scanned per address.
export async function getVisitorOverview(limit = 200): Promise<VisitorOverview> {
  const supabase = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: ips }, day, week, { data: agg }] = await Promise.all([
    supabase
      .from("visitor_ips")
      .select(
        "ip, hits, first_seen_at, last_seen_at, country, region, city, latitude, longitude, timezone, distinct_users, is_bot, trusted",
      )
      .order("hits", { ascending: false })
      .limit(limit),
    supabase.from("visits").select("id", { count: "exact", head: true }).gte("at", since24h),
    supabase.from("visits").select("id", { count: "exact", head: true }).gte("at", since7d),
    supabase.rpc("visitor_aggregates"),
  ]);

  const rows: VisitorIpRow[] = ((ips ?? []) as Record<string, unknown>[]).map((r) => ({
    ip: r.ip as string,
    hits: Number(r.hits),
    firstSeenAt: r.first_seen_at as string,
    lastSeenAt: r.last_seen_at as string,
    country: (r.country as string) ?? null,
    region: (r.region as string) ?? null,
    city: (r.city as string) ?? null,
    latitude: (r.latitude as number) ?? null,
    longitude: (r.longitude as number) ?? null,
    timezone: (r.timezone as string) ?? null,
    distinctUsers: Number(r.distinct_users ?? 0),
    isBot: Boolean(r.is_bot),
    trusted: Boolean(r.trusted),
  }));

  const aggregates = (agg ?? {}) as {
    by_country?: { country: string; hits: number }[];
    top_paths?: { path: string; hits: number }[];
  };

  // Coordinates are per address, but a dot per address turns a busy city
  // into an unreadable blob — group to roughly a city block first.
  const clustered = new Map<string, { lat: number; lon: number; hits: number; label: string }>();
  for (const row of rows) {
    if (row.latitude === null || row.longitude === null) continue;
    if (row.latitude === 0 && row.longitude === 0) continue;
    const key = `${row.latitude.toFixed(1)},${row.longitude.toFixed(1)}`;
    const existing = clustered.get(key);
    if (existing) {
      existing.hits += row.hits;
    } else {
      clustered.set(key, {
        lat: row.latitude,
        lon: row.longitude,
        hits: row.hits,
        label: [row.city, row.country].filter(Boolean).join(", ") || row.ip,
      });
    }
  }

  return {
    ips: rows,
    totals: {
      visits24h: day.count ?? 0,
      visits7d: week.count ?? 0,
      uniqueIps: rows.length,
      countries: new Set(rows.map((r) => r.country).filter(Boolean)).size,
    },
    byCountry: aggregates.by_country ?? [],
    topPaths: aggregates.top_paths ?? [],
    points: [...clustered.values()].sort((a, b) => b.hits - a.hits).slice(0, 200),
  };
}

export type IpDetail = {
  profile: VisitorIpRow | null;
  accounts: { userId: string; email: string | null; hits: number; lastSeenAt: string }[];
  visits: {
    at: string;
    path: string;
    method: string;
    browser: string | null;
    os: string | null;
    device: string | null;
    userAgent: string | null;
    referer: string | null;
    acceptLanguage: string | null;
    userId: string | null;
    isBot: boolean;
  }[];
};

export async function getIpDetail(ip: string): Promise<IpDetail> {
  const supabase = createServiceClient();

  const [{ data: profile }, { data: links }, { data: visits }] = await Promise.all([
    supabase
      .from("visitor_ips")
      .select(
        "ip, hits, first_seen_at, last_seen_at, country, region, city, latitude, longitude, timezone, distinct_users, is_bot, trusted",
      )
      .eq("ip", ip)
      .maybeSingle(),
    supabase
      .from("visitor_identities")
      .select("user_id, hits, last_seen_at")
      .eq("ip", ip)
      .order("hits", { ascending: false }),
    supabase
      .from("visits")
      .select(
        "at, path, method, browser, os, device, user_agent, referer, accept_language, user_id, is_bot",
      )
      .eq("ip", ip)
      .order("at", { ascending: false })
      .limit(200),
  ]);

  const userIds = (links ?? []).map((l) => l.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const p = profile as Record<string, unknown> | null;

  return {
    profile: p
      ? {
          ip: p.ip as string,
          hits: Number(p.hits),
          firstSeenAt: p.first_seen_at as string,
          lastSeenAt: p.last_seen_at as string,
          country: (p.country as string) ?? null,
          region: (p.region as string) ?? null,
          city: (p.city as string) ?? null,
          latitude: (p.latitude as number) ?? null,
          longitude: (p.longitude as number) ?? null,
          timezone: (p.timezone as string) ?? null,
          distinctUsers: Number(p.distinct_users ?? 0),
          isBot: Boolean(p.is_bot),
          trusted: Boolean(p.trusted),
        }
      : null,
    accounts: (links ?? []).map((l) => ({
      userId: l.user_id,
      email: emailById.get(l.user_id) ?? null,
      hits: Number(l.hits),
      lastSeenAt: l.last_seen_at,
    })),
    visits: ((visits ?? []) as Record<string, unknown>[]).map((v) => ({
      at: v.at as string,
      path: v.path as string,
      method: v.method as string,
      browser: (v.browser as string) ?? null,
      os: (v.os as string) ?? null,
      device: (v.device as string) ?? null,
      userAgent: (v.user_agent as string) ?? null,
      referer: (v.referer as string) ?? null,
      acceptLanguage: (v.accept_language as string) ?? null,
      userId: (v.user_id as string) ?? null,
      isBot: Boolean(v.is_bot),
    })),
  };
}
