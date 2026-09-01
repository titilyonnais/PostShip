import { parse as parseHtml } from "node-html-parser";
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

function extractHtmlMeta(html: string) {
  const missing: string[] = [];
  let root;
  try {
    root = parseHtml(html);
  } catch {
    return { missing: ["html_unparsable"], meta: {} };
  }

  const title = root.querySelector("title")?.text.trim() || null;
  if (!title) missing.push("title");

  const description =
    root
      .querySelector('meta[name="description" i]')
      ?.getAttribute("content")
      ?.trim() || null;
  if (!description) missing.push("meta_description");

  const canonical =
    root.querySelector('link[rel="canonical" i]')?.getAttribute("href") ||
    null;
  if (!canonical) missing.push("canonical");

  const robots =
    root.querySelector('meta[name="robots" i]')?.getAttribute("content") ||
    null;

  const jsonLdScripts = root.querySelectorAll(
    'script[type="application/ld+json"]',
  );
  const jsonLdErrors: string[] = [];
  for (const script of jsonLdScripts) {
    try {
      JSON.parse(script.textContent);
    } catch {
      jsonLdErrors.push("json_ld_syntax_error");
    }
  }
  if (jsonLdErrors.length > 0) missing.push(...jsonLdErrors);

  return {
    missing,
    meta: { title, description, canonical, robots, jsonLdCount: jsonLdScripts.length },
  };
}

export async function runHttpCheck(
  target: HttpCheckTarget,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const fetchResult = await guardedFetch(target.url, {
      signal: controller.signal,
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
      missing.push(...htmlMeta.missing);
    }

    const statusOk = response.status === target.expect_status;
    const outcome: "pass" | "fail" =
      statusOk && missing.length === 0 ? "pass" : "fail";
    const details = {
      url: finalUrl,
      redirects,
      bodyExcerpt: bodyText.slice(0, 500),
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
