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

// Distinct from the page cap (which can be as high as MAX_PAGES_PER_SCAN,
// driven by the user's token balance): this bounds how many pages
// discovery itself is willing to *fetch and parse for links*, which isn't
// token-metered. Without a separate ceiling here, a site with a large
// internal link graph would make discovery do unbounded free crawling
// work regardless of how few tokens the user actually has to spend on the
// scan itself.
const MAX_DISCOVERY_FETCHES = 50;
const MAX_CHILD_SITEMAPS = 3;
const ROBOTS_USER_AGENT = "postshipbot";

function extractLocUrls(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  return Array.from(matches, (m) => m[1]);
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

function sameOrigin(a: URL, b: URL): boolean {
  return a.hostname === b.hostname;
}

// Deliberately simplified: groups by exact User-agent token match (our own
// "PostShipBot" first, falling back to "*"), Disallow as a plain path
// prefix. No Allow-rule precedence, no wildcard/$ patterns — covers the
// overwhelming majority of real-world robots.txt files without pulling in
// a parser dependency for a courtesy check, not a strict-compliance one.
export function parseRobotsDisallow(text: string, userAgent: string): string[] {
  type Group = { agents: string[]; disallow: string[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let sawDirectiveSinceLastAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || sawDirectiveSinceLastAgent) {
        current = { agents: [], disallow: [] };
        groups.push(current);
        sawDirectiveSinceLastAgent = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "disallow" && current) {
      sawDirectiveSinceLastAgent = true;
      if (value) current.disallow.push(value);
    } else if (current) {
      sawDirectiveSinceLastAgent = true;
    }
  }

  const uaLower = userAgent.toLowerCase();
  const specific = groups.find((g) => g.agents.includes(uaLower));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  return (specific ?? wildcard)?.disallow ?? [];
}

export function isDisallowed(pathname: string, disallowRules: string[]): boolean {
  return disallowRules.some((rule) => rule !== "" && pathname.startsWith(rule));
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

async function fetchRobotsDisallowRules(origin: string): Promise<string[]> {
  const robotsUrl = `${origin}/robots.txt`;
  const guard = await assertPublicHttpsUrl(robotsUrl);
  if (!guard.ok) return [];
  const text = await fetchText(robotsUrl);
  if (!text) return [];
  return parseRobotsDisallow(text, ROBOTS_USER_AGENT);
}

function extractPageLinks(html: string, base: URL): string[] {
  const root = parseHtml(html);
  const links: string[] = [];
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href");
    if (!href) continue;
    try {
      const u = new URL(href, base.toString());
      u.hash = "";
      links.push(u.toString());
    } catch {
      // ignore unparsable hrefs (mailto:, javascript:, etc.)
    }
  }
  return links;
}

async function collectSitemapUrls(seed: URL): Promise<string[]> {
  const sitemapUrl = `${seed.origin}/sitemap.xml`;
  const guard = await assertPublicHttpsUrl(sitemapUrl);
  if (!guard.ok) return [];

  const xml = await fetchText(sitemapUrl);
  if (!xml) return [];

  let locs = extractLocUrls(xml);

  // Same fix as the sitemap CHECK (src/lib/checks/sitemap.ts): a
  // <sitemapindex> lists child sitemap files, not pages — follow a few of
  // them to reach actual page URLs instead of treating the index entries
  // themselves as pages to scan.
  if (isSitemapIndex(xml)) {
    const pageUrls: string[] = [];
    for (const childUrl of locs.slice(0, MAX_CHILD_SITEMAPS)) {
      const childGuard = await assertPublicHttpsUrl(childUrl);
      if (!childGuard.ok) continue;
      const childXml = await fetchText(childUrl);
      if (childXml) pageUrls.push(...extractLocUrls(childXml));
    }
    locs = pageUrls;
  }

  return locs;
}

// Discovery favors the site's own sitemap.xml (fast, authoritative page
// list, follows a sitemapindex into its children) and tops up with a
// breadth-first same-origin link crawl — starting at the seed page and
// fanning out through pages it links to, not just the homepage's own
// links — bounded by MAX_DISCOVERY_FETCHES regardless of `cap` so a large
// site can't turn discovery into unbounded free crawling. Pages disallowed
// for our own user-agent in robots.txt are never fetched or added.
async function discoverUrls(seedUrl: string, cap: number): Promise<string[]> {
  const seed = new URL(seedUrl);
  const discovered = new Set<string>([seed.toString()]);

  const disallowRules = await fetchRobotsDisallowRules(seed.origin);
  const isAllowed = (u: URL) =>
    sameOrigin(u, seed) &&
    u.protocol === "https:" &&
    !isDisallowed(u.pathname, disallowRules);

  for (const loc of await collectSitemapUrls(seed)) {
    if (discovered.size >= cap) break;
    try {
      const u = new URL(loc);
      if (isAllowed(u)) discovered.add(u.toString());
    } catch {
      // ignore malformed <loc> entries
    }
  }

  if (discovered.size < cap) {
    const queue: string[] = [seed.toString()];
    const queued = new Set(queue);
    let fetches = 0;

    while (queue.length > 0 && discovered.size < cap && fetches < MAX_DISCOVERY_FETCHES) {
      const pageUrl = queue.shift()!;
      const pageUrlObj = new URL(pageUrl);
      if (isDisallowed(pageUrlObj.pathname, disallowRules)) continue;

      fetches += 1;
      const html = await fetchText(pageUrl);
      if (!html) continue;

      discovered.add(pageUrl);

      for (const link of extractPageLinks(html, pageUrlObj)) {
        if (discovered.size >= cap) break;
        let u: URL;
        try {
          u = new URL(link);
        } catch {
          continue;
        }
        if (!isAllowed(u)) continue;

        const normalized = u.toString();
        discovered.add(normalized);
        if (!queued.has(normalized) && queue.length + queued.size < MAX_DISCOVERY_FETCHES * 4) {
          queued.add(normalized);
          queue.push(normalized);
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

  await supabase
    .from("site_scans")
    .update({ status: "running", total_pages: urls.length })
    .eq("id", scan.id);
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

// Up to this many batches of a single running scan get processed per cron
// tick — trades a longer serverless invocation for a much shorter wall-clock
// scan time (at 5-min ticks, 500 pages would otherwise take over an hour).
const MAX_BATCHES_PER_TICK = 4;

// Called from the cron tick alongside runProjectChecks. Discovery for a
// newly queued scan falls straight through into processing its first batch
// in the same invocation — waiting a full external-cron cycle just to start
// checking pages was the main source of "why is this stuck" complaints for
// small scans.
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
  }

  const { data: running } = await supabase
    .from("site_scans")
    .select("id, user_id, status")
    .eq("status", "running")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!running) return;

  for (let i = 0; i < MAX_BATCHES_PER_TICK; i++) {
    const { count: pending } = await supabase
      .from("site_scan_pages")
      .select("id", { count: "exact", head: true })
      .eq("scan_id", running.id)
      .eq("status", "pending");

    if (!pending) break;

    await processBatch(supabase, running);
  }
}
