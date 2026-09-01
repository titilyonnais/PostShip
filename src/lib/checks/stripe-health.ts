import {
  computeFingerprint,
  guardedFetch,
  TIMEOUT_MS,
  type CheckResult,
} from "@/lib/checks/shared";

export type StripeHealthCheckTarget = { url: string };

// PRD.md asks for "GET success URL + HEAD webhook route", but
// check_targets only stores one URL per row (see docs/DATA_MODEL.md) — no
// column exists for a second webhook URL. This checks the success URL
// only; the webhook-route half needs a schema change to implement.
export async function runStripeHealthCheck(
  target: StripeHealthCheckTarget,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const result = await guardedFetch(target.url, {
      signal: controller.signal,
    });

    if (!result.ok) {
      const details = {
        url: target.url,
        error: result.reason,
        redirects: result.redirects,
        missing: ["webhook_route_not_checked"],
      };
      return {
        outcome: "error",
        http_status: result.httpStatus,
        ttfb_ms: null,
        details,
        fingerprint: computeFingerprint("error", result.httpStatus, details),
      };
    }

    const ttfbMs = Date.now() - started;
    const statusOk = result.response.status >= 200 && result.response.status < 300;
    const missing: string[] = ["webhook_route_not_checked"];
    if (!statusOk) missing.push("success_url_status");

    const outcome: "pass" | "fail" = statusOk ? "pass" : "fail";
    const details = {
      url: result.finalUrl,
      redirects: result.redirects,
      missing,
    };

    return {
      outcome,
      http_status: result.response.status,
      ttfb_ms: ttfbMs,
      details,
      fingerprint: computeFingerprint(outcome, result.response.status, details),
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
