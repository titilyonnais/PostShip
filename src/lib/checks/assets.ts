import { parse as parseHtml } from "node-html-parser";
import type { FetchBudget } from "@/lib/budgets";
import { guardedFetch } from "@/lib/checks/shared";

// A page that responds 200 with a broken same-origin script/stylesheet is
// still a broken deploy — most often a stale HTML shell referencing a
// hashed asset filename from the previous build. This only ever looks at
// same-origin, https assets: third-party analytics/fonts aren't ours to
// monitor and would just add noise and unrelated failure modes.
const MAX_ASSETS = 15;
const PATH_TRUNCATE_LENGTH = 80;

export type BrokenAsset = {
  url: string;
  status: number | null;
  contentType: string | null;
};

export type AssetCheckResult = {
  missing: string[];
  brokenAssets: BrokenAsset[];
};

function extractAssetUrls(html: string, base: URL): string[] {
  let root: ReturnType<typeof parseHtml>;
  try {
    root = parseHtml(html);
  } catch {
    return [];
  }

  const raw: string[] = [];
  for (const el of root.querySelectorAll("script[src]")) {
    const src = el.getAttribute("src");
    if (src) raw.push(src);
  }
  for (const el of root.querySelectorAll('link[rel="stylesheet"][href]')) {
    const href = el.getAttribute("href");
    if (href) raw.push(href);
  }

  const resolved: string[] = [];
  for (const value of raw) {
    if (resolved.length >= MAX_ASSETS) break;
    let u: URL;
    try {
      u = new URL(value, base.toString());
    } catch {
      continue;
    }
    if (u.protocol !== "https:" || u.hostname !== base.hostname) continue;
    resolved.push(u.toString());
  }
  return resolved;
}

function truncatedPath(assetUrl: string): string {
  let path: string;
  try {
    path = new URL(assetUrl).pathname;
  } catch {
    path = assetUrl;
  }
  return path.length > PATH_TRUNCATE_LENGTH
    ? path.slice(0, PATH_TRUNCATE_LENGTH)
    : path;
}

// Called only from the authenticated runner (runner.ts) — never from the
// public demo check (/api/demo/check), which would otherwise let anyone
// use PostShip as a free bulk-HEAD prober against arbitrary sites' assets.
export async function checkAssets(
  html: string,
  finalUrl: string,
  signal: AbortSignal,
  budget?: FetchBudget,
): Promise<AssetCheckResult> {
  let base: URL;
  try {
    base = new URL(finalUrl);
  } catch {
    return { missing: [], brokenAssets: [] };
  }

  const assetUrls = extractAssetUrls(html, base);
  const missing: string[] = [];
  const brokenAssets: BrokenAsset[] = [];

  for (const assetUrl of assetUrls) {
    // Shares the caller's signal/deadline (the page check's own 12s
    // timeout) rather than getting a fresh timer per asset — up to 15
    // extra requests must not multiply the check's total run time.
    if (signal.aborted) break;

    let status: number | null = null;
    let contentType: string | null = null;

    try {
      let result = await guardedFetch(assetUrl, {
        signal,
        method: "HEAD",
        budget,
      });

      if (result.ok && result.response.status === 405) {
        result = await guardedFetch(assetUrl, { signal, method: "GET", budget });
      }

      if (result.ok) {
        status = result.response.status;
        contentType = result.response.headers.get("content-type");
      }
    } catch {
      if (signal.aborted) break;
      // Network error on this one asset — fall through and record it
      // broken (status/contentType stay null) rather than aborting the
      // whole check.
    }

    const isBroken =
      status === null ||
      status >= 400 ||
      (contentType?.includes("text/html") ?? false);

    if (isBroken) {
      missing.push(`asset:${status ?? "error"}:${truncatedPath(assetUrl)}`);
      brokenAssets.push({ url: assetUrl, status, contentType });
    }
  }

  return { missing, brokenAssets };
}
