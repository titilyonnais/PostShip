import { parse as parseHtml } from "node-html-parser";
import type { FetchBudget } from "@/lib/budgets";
import { checkAssets, type BrokenAsset } from "@/lib/checks/assets";
import {
  computeFingerprint,
  guardedFetch,
  MAX_BODY_BYTES,
  readBodyCapped,
  TIMEOUT_MS,
  type CheckResult,
} from "@/lib/checks/shared";

export type MoneyPathAssertions = {
  requireStripeJs?: boolean;
  requireEmailOrPasswordInput?: boolean;
  requirePriceToken?: string;
};

export type HttpCheckTarget = {
  url: string;
  expect_status: number;
  expect_contains: string | null;
  expect_not_contains: string | null;
  assertions?: MoneyPathAssertions | null;
  // F6 (features backlog): a shared-secret header for a private page
  // (e.g. Authorization, X-Monitoring-Key). Applies only to this target's
  // own request — never to the F1 asset checks (see checkPageAssets).
  requestHeader?: { name: string; value: string } | null;
};

const AUTH_LINK_PATTERN = /google|github|connexion|se connecter|log in|sign in/i;

// "Money path" structural assertions (F2, features backlog) — not a new
// check kind, just optional extra assertions on an ordinary http target
// (pricing/login/checkout pages), stored as JSON on check_targets.
function evaluateMoneyPathAssertions(
  bodyText: string,
  assertions: MoneyPathAssertions,
): string[] {
  const missing: string[] = [];

  if (assertions.requireStripeJs && !bodyText.includes("js.stripe.com")) {
    missing.push("stripe_js");
  }

  if (assertions.requireEmailOrPasswordInput) {
    let root: ReturnType<typeof parseHtml> | null = null;
    try {
      root = parseHtml(bodyText);
    } catch {
      root = null;
    }

    const hasAuthInput =
      root?.querySelector('input[type="email" i], input[type="password" i]') !=
      null;
    const hasAuthLink =
      root != null &&
      [...root.querySelectorAll("a"), ...root.querySelectorAll("button")].some(
        (el) => AUTH_LINK_PATTERN.test(el.text ?? ""),
      );

    if (!hasAuthInput && !hasAuthLink) missing.push("login_form");
  }

  if (
    assertions.requirePriceToken &&
    !bodyText.includes(assertions.requirePriceToken)
  ) {
    missing.push("price_token");
  }

  return missing;
}

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
  // Only the authenticated runner (runner.ts) passes true — the public
  // demo check must never trigger up to 15 extra outbound requests per
  // call (see src/lib/checks/assets.ts).
  checkPageAssets = false,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const fetchResult = await guardedFetch(target.url, {
      signal: controller.signal,
      budget,
      extraHeaders: target.requestHeader
        ? { [target.requestHeader.name]: target.requestHeader.value }
        : undefined,
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

      if (target.assertions) {
        missing.push(...evaluateMoneyPathAssertions(bodyText, target.assertions));
      }
    }

    let brokenAssets: BrokenAsset[] = [];
    if (checkPageAssets && contentType.includes("text/html")) {
      const assetResult = await checkAssets(bodyText, finalUrl, controller.signal, budget);
      missing.push(...assetResult.missing);
      brokenAssets = assetResult.brokenAssets;
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
      brokenAssets,
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
