import { parse as parseHtml } from "node-html-parser";
import { createServiceClient } from "@/lib/db/service";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import {
  guardedFetch,
  MAX_BODY_BYTES,
  readBodyCapped,
  TIMEOUT_MS,
} from "@/lib/checks/shared";
import { runWithConcurrencyLimit } from "@/lib/concurrency";

type ServiceClient = ReturnType<typeof createServiceClient>;

// Hard safety ceiling regardless of token balance — protects the target
// site and our own infra from an unbounded crawl even for a "scan
// everything" request. See docs/ARCHITECTURE.md decision log.
export const MAX_PAGES_PER_SCAN = 500;
const PROCESS_BATCH_SIZE = 40;
const CONCURRENCY = 3;

function extractLocUrls(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  return Array.from(matches, (m) => m[1]);
}

function sameOrigin(a: URL, b: URL): boolean {
  return a.hostname === b.hostname;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await guardedFetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const { text } = await readBodyCapped(res.response, MAX_BODY_BYTES);
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Discovery favors the site's own sitemap.xml (fast, single fetch, and the
// closest thing to an authoritative page list) and falls back to a shallow
// same-origin link crawl of the seed page when there isn't one.
async function discoverUrls(seedUrl: string, cap: number): Promise<string[]> {
  const seed = new URL(seedUrl);
  const discovered = new Set<string>([seed.toString()]);

  const sitemapGuard = await assertPublicHttpsUrl(`${seed.origin}/sitemap.xml`);
  if (sitemapGuard.ok) {
    const xml = await fetchText(`${seed.origin}/sitemap.xml`);
    if (xml) {
      for (const loc of extractLocUrls(xml)) {
        if (discovered.size >= cap) break;
        try {
          const u = new URL(loc);
          if (sameOrigin(u, seed) && u.protocol === "https:") {
            discovered.add(u.toString());
          }
        } catch {
          // ignore malformed <loc> entries
        }
      }
    }
  }

  if (discovered.size < cap) {
    const html = await fetchText(seed.toString());
    if (html) {
      const root = parseHtml(html);
      for (const a of root.querySelectorAll("a")) {
        if (discovered.size >= cap) break;
        const href = a.getAttribute("href");
        if (!href) continue;
        try {
          const u = new URL(href, seed.toString());
          u.hash = "";
          if (sameOrigin(u, seed) && u.protocol === "https:") {
            discovered.add(u.toString());
          }
        } catch {
          // ignore unparsable hrefs (mailto:, javascript:, etc.)
        }
      }
    }
  }

  return Array.from(discovered).slice(0, cap);
}

export async function createSiteScan(params: {
  userId: string;
  projectId: string | null;
  seedUrl: string;
}): Promise<{ scanId: string } | { error: string }> {
  const guard = await assertPublicHttpsUrl(params.seedUrl);
  if (!guard.ok) return { error: guard.reason };

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("token_balance")
    .eq("id", params.userId)
    .single();

  if (!profile || profile.token_balance < 1) {
    return {
      error:
        "Solde de tokens insuffisant. Achetez un pack de tokens dans Compte → Tokens.",
    };
  }

  const { data: scan, error } = await supabase
    .from("site_scans")
    .insert({
      user_id: params.userId,
      project_id: params.projectId,
      seed_url: params.seedUrl,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !scan) {
    return { error: error?.message ?? "Impossible de créer le scan." };
  }

  return { scanId: scan.id };
}

async function discoverScan(
  supabase: ServiceClient,
  scan: { id: string; user_id: string; seed_url: string },
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("token_balance")
    .eq("id", scan.user_id)
    .single();

  const cap = Math.max(
    0,
    Math.min(MAX_PAGES_PER_SCAN, profile?.token_balance ?? 0),
  );

  if (cap === 0) {
    await supabase
      .from("site_scans")
      .update({
        status: "error",
        error: "Solde de tokens insuffisant.",
        finished_at: new Date().toISOString(),
      })
      .eq("id", scan.id);
    return;
  }

  const urls = await discoverUrls(scan.seed_url, cap);

  if (urls.length === 0) {
    await supabase
      .from("site_scans")
      .update({
        status: "error",
        error: "Aucune page découverte (site inaccessible ou vide).",
        finished_at: new Date().toISOString(),
      })
      .eq("id", scan.id);
    return;
  }

  await supabase
    .from("site_scan_pages")
    .insert(urls.map((url) => ({ scan_id: scan.id, url })));

  await supabase.from("site_scans").update({ status: "running" }).eq("id", scan.id);
}

async function processBatch(
  supabase: ServiceClient,
  scan: { id: string; user_id: string },
) {
  const { data: pending } = await supabase
    .from("site_scan_pages")
    .select("id, url")
    .eq("scan_id", scan.id)
    .eq("status", "pending")
    .limit(PROCESS_BATCH_SIZE);

  if (!pending || pending.length === 0) {
    await supabase
      .from("site_scans")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", scan.id);
    return;
  }

  const results = await runWithConcurrencyLimit(
    pending,
    CONCURRENCY,
    async (page) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const started = Date.now();
      try {
        const res = await guardedFetch(page.url, { signal: controller.signal });
        if (!res.ok) {
          return {
            id: page.id,
            outcome: "error" as const,
            http_status: res.httpStatus,
            ttfb_ms: null,
            error: res.reason,
          };
        }
        const status = res.response.status;
        const outcome: "pass" | "fail" =
          status >= 200 && status < 400 ? "pass" : "fail";
        return {
          id: page.id,
          outcome,
          http_status: status,
          ttfb_ms: Date.now() - started,
          error: null,
        };
      } catch (err) {
        return {
          id: page.id,
          outcome: "error" as const,
          http_status: null,
          ttfb_ms: null,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  );

  for (const r of results) {
    await supabase
      .from("site_scan_pages")
      .update({
        status: "done",
        outcome: r.outcome,
        http_status: r.http_status,
        ttfb_ms: r.ttfb_ms,
        error: r.error,
      })
      .eq("id", r.id);
  }

  const okCount = results.filter((r) => r.outcome === "pass").length;

  const { data: current } = await supabase
    .from("site_scans")
    .select("pages_scanned, pages_ok, pages_failed, tokens_spent")
    .eq("id", scan.id)
    .single();

  await supabase
    .from("site_scans")
    .update({
      pages_scanned: (current?.pages_scanned ?? 0) + results.length,
      pages_ok: (current?.pages_ok ?? 0) + okCount,
      pages_failed: (current?.pages_failed ?? 0) + (results.length - okCount),
      tokens_spent: (current?.tokens_spent ?? 0) + results.length,
    })
    .eq("id", scan.id);

  const { data: newBalance } = await supabase.rpc("spend_tokens", {
    p_user_id: scan.user_id,
    p_amount: results.length,
  });

  if (typeof newBalance === "number" && newBalance <= 0) {
    const { count: remaining } = await supabase
      .from("site_scan_pages")
      .select("id", { count: "exact", head: true })
      .eq("scan_id", scan.id)
      .eq("status", "pending");

    if ((remaining ?? 0) > 0) {
      await supabase
        .from("site_scans")
        .update({
          status: "error",
          error: "Tokens épuisés, scan interrompu.",
          finished_at: new Date().toISOString(),
        })
        .eq("id", scan.id);
    }
  }
}

// Called from the cron tick alongside runProjectChecks. Advances at most one
// scan per invocation (one discovery OR one batch) so each cron call stays
// short — a 500-page scan spreads over several ticks rather than one long
// serverless invocation.
export async function advanceSiteScans(): Promise<void> {
  const supabase = createServiceClient();

  const { data: queued } = await supabase
    .from("site_scans")
    .select("id, user_id, seed_url")
    .eq("status", "queued")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (queued) {
    await discoverScan(supabase, queued);
    return;
  }

  const { data: running } = await supabase
    .from("site_scans")
    .select("id, user_id")
    .eq("status", "running")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (running) {
    await processBatch(supabase, running);
  }
}
