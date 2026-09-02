import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/service";
import { resolveDnsSnapshot, type DnsSnapshot } from "@/lib/checks/dns";
import { fetchDomainExpiry, type DomainExpiry } from "@/lib/checks/rdap";

const CACHE_MS = 6 * 60 * 60 * 1000;

export type HealthPayload = {
  dns: DnsSnapshot;
  domainExpiry: DomainExpiry;
};

// Computed at page-open time and cached 6h (health_snapshots, migration
// 0043) — not a new cron check kind, so opening the Santé page can't turn
// into unbounded RDAP traffic no matter how often it's refreshed.
export async function getHealthSnapshot(
  supabase: SupabaseClient,
  projectId: string,
  hostname: string,
): Promise<HealthPayload> {
  const { data: cached } = await supabase
    .from("health_snapshots")
    .select("checked_at, payload")
    .eq("project_id", projectId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.checked_at).getTime() < CACHE_MS) {
    return cached.payload as HealthPayload;
  }

  const [dns, domainExpiry] = await Promise.all([
    resolveDnsSnapshot(hostname),
    fetchDomainExpiry(hostname),
  ]);

  const payload: HealthPayload = { dns, domainExpiry };

  // Best-effort — health_snapshots has no authenticated insert policy
  // (service-role-only writes, same as alert_events/deploy_events), and a
  // failed cache write must never break the page render.
  try {
    await createServiceClient()
      .from("health_snapshots")
      .insert({ project_id: projectId, payload });
  } catch (err) {
    console.error("Échec écriture health_snapshots", err);
  }

  return payload;
}
