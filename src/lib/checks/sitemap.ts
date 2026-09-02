import {
  computeFingerprint,
  guardedFetch,
  MAX_BODY_BYTES,
  readBodyCapped,
  TIMEOUT_MS,
  type CheckResult,
} from "@/lib/checks/shared";

export type SitemapCheckTarget = { url: string };

const SAMPLE_SIZE = 10;
const MAX_CHILD_SITEMAPS = 3;

function extractLocUrls(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  return Array.from(matches, (m) => m[1]);
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

export async function runSitemapCheck(
  target: SitemapCheckTarget,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const sitemapResult = await guardedFetch(target.url, {
      signal: controller.signal,
    });

    if (!sitemapResult.ok) {
      const details = {
        url: target.url,
        error: sitemapResult.reason,
        redirects: sitemapResult.redirects,
      };
      return {
        outcome: "error",
        http_status: sitemapResult.httpStatus,
        ttfb_ms: null,
        details,
        fingerprint: computeFingerprint(
          "error",
          sitemapResult.httpStatus,
          details,
        ),
      };
    }

    const { response, finalUrl } = sitemapResult;
    const ttfbMs = Date.now() - started;
    const { text: xmlText } = await readBodyCapped(response, MAX_BODY_BYTES);

    let urls = extractLocUrls(xmlText);
    let isIndex = false;

    // A <sitemapindex> lists child sitemap files, not pages — the <loc>
    // regex above matches either shape equally, so without this the
    // "sample and HEAD-check" below would silently validate that the
    // child sitemap *files* respond instead of the actual pages, which is
    // what the check exists to verify.
    if (isSitemapIndex(xmlText)) {
      isIndex = true;
      const childSitemapUrls = urls.slice(0, MAX_CHILD_SITEMAPS);
      const pageUrls: string[] = [];

      for (const childUrl of childSitemapUrls) {
        const childResult = await guardedFetch(childUrl, {
          signal: controller.signal,
        });
        if (!childResult.ok) continue;
        const { text: childXml } = await readBodyCapped(
          childResult.response,
          MAX_BODY_BYTES,
        );
        pageUrls.push(...extractLocUrls(childXml));
      }

      urls = pageUrls;
    }

    const missing: string[] = [];

    if (urls.length === 0) {
      missing.push("no_urls_found");
    }

    const sample = urls.slice(0, SAMPLE_SIZE);
    const unreachable: string[] = [];

    for (const url of sample) {
      const urlResult = await guardedFetch(url, {
        signal: controller.signal,
        method: "HEAD",
      });
      if (!urlResult.ok || urlResult.response.status >= 400) {
        unreachable.push(url);
      }
    }

    if (unreachable.length > 0) missing.push("sampled_urls_unreachable");

    const outcome: "pass" | "fail" = missing.length === 0 ? "pass" : "fail";
    const details = {
      url: finalUrl,
      isIndex,
      urlCount: urls.length,
      sampled: sample.length,
      unreachable,
      missing,
    };

    return {
      outcome,
      http_status: response.status,
      ttfb_ms: ttfbMs,
      details,
      fingerprint: computeFingerprint(outcome, response.status, details),
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    const details = {
      url: target.url,
      error: isAbort ? "Timeout (12s)." : String(err),
    };
    return {
      outcome: "error",
      http_status: null,
      ttfb_ms: Date.now() - started,
      details,
      fingerprint: computeFingerprint("error", null, details),
    };
  } finally {
    clearTimeout(timeout);
  }
}
