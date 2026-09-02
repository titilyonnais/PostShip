import { parse as parseHtml } from "node-html-parser";
import type { FetchBudget } from "@/lib/budgets";
import {
  computeFingerprint,
  guardedFetch,
  MAX_BODY_BYTES,
  readBodyCapped,
  TIMEOUT_MS,
  type CheckResult,
} from "@/lib/checks/shared";

export type HttpCheckTarget = {
  url: string;
  expect_status: number;
  expect_contains: string | null;
  expect_not_contains: string | null;
};

// title/description/canonical are informational only — plenty of
// legitimate pages skip them, so their absence alone must not flip the
// outcome to "fail" (verified live: example.com always lacks them, which
// would otherwise make every check against it fail forever). Only a
// genuinely broken condition — invalid JSON-LD — counts as a failure.
function extractHtmlMeta(html: string) {
  let root;
  try {
    root = parseHtml(html);
  } catch {
    return { failing: ["html_unparsable"], meta: {} };
  }

  const title = root.querySelector("title")?.text.trim() || null;

  const description =
    root
      .querySelector('meta[name="description" i]')
      ?.getAttribute("content")
      ?.trim() || null;

  const canonical =
    root.querySelector('link[rel="canonical" i]')?.getAttribute("href") ||
    null;

  const robots =
    root.querySelector('meta[name="robots" i]')?.getAttribute("content") ||
    null;

  const jsonLdScripts = root.querySelectorAll(
    'script[type="application/ld+json"]',
  );
  const failing: string[] = [];
  for (const script of jsonLdScripts) {
    try {
      JSON.parse(script.textContent);
    } catch {
      failing.push("json_ld_syntax_error");
    }
  }

  return {
    failing,
    meta: {
      title,
      description,
      canonical,
      robots,
      jsonLdCount: jsonLdScripts.length,
    },
  };
}

export async function runHttpCheck(
  target: HttpCheckTarget,
  budget?: FetchBudget,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const fetchResult = await guardedFetch(target.url, {
      signal: controller.signal,
      budget,
    });

    if (!fetchResult.ok) {
      const details = {
        url: target.url,
        error: fetchResult.reason,
        redirects: fetchResult.redirects,
      };
      return {
        outcome: "error",
        http_status: fetchResult.httpStatus,
        ttfb_ms: fetchResult.httpStatus ? Date.now() - started : null,
        details,
        fingerprint: computeFingerprint("error", fetchResult.httpStatus, details),
      };
    }

    const { response, finalUrl, redirects } = fetchResult;
    const ttfbMs = Date.now() - started;
    const { text: bodyText, truncated } = await readBodyCapped(
      response,
      MAX_BODY_BYTES,
    );

    const missing: string[] = [];
    if (
      target.expect_contains &&
      !bodyText.includes(target.expect_contains)
    ) {
      missing.push("expect_contains");
    }
    if (
      target.expect_not_contains &&
      bodyText.includes(target.expect_not_contains)
    ) {
      missing.push("expect_not_contains");
    }

    const contentType = response.headers.get("content-type") ?? "";
    let htmlMeta: ReturnType<typeof extractHtmlMeta> | null = null;
    if (contentType.includes("text/html")) {
      htmlMeta = extractHtmlMeta(bodyText);
      missing.push(...htmlMeta.failing);
    }

    const statusOk = response.status === target.expect_status;
    const outcome: "pass" | "fail" =
      statusOk && missing.length === 0 ? "pass" : "fail";
    // No page-body excerpt persisted (see privacy §2 and migration
    // POSTSHIP-CLAUDE-CODE-CHANGEMENTS.md C3) — a secret rendered on a
    // page under monitoring (e.g. a login page config error) would
    // otherwise sit in the database for the account's whole retention
    // window. expect_contains/expect_not_contains are still evaluated
    // above against bodyText in memory, just never written out.
    const details = {
      url: finalUrl,
      redirects,
      bodyTruncated: truncated,
      missing,
      meta: htmlMeta?.meta ?? null,
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
