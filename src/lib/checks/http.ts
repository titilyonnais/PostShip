import { assertPublicHttpsUrl } from "@/lib/ssrf";

const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 512 * 1024;
const USER_AGENT = "PostShipBot/0.1 (+https://postship.fr)";

export type HttpCheckTarget = {
  url: string;
  expect_status: number;
  expect_contains: string | null;
  expect_not_contains: string | null;
};

export type HttpCheckResult = {
  outcome: "pass" | "fail" | "error";
  http_status: number | null;
  ttfb_ms: number | null;
  details: Record<string, unknown>;
  fingerprint: string;
};

// Identifies "the same kind of failure" for alert dedup — status + missing
// fields, not the timestamp or TTFB (see docs/ARCHITECTURE.md — Alerts).
function computeFingerprint(
  outcome: HttpCheckResult["outcome"],
  httpStatus: number | null,
  details: Record<string, unknown>,
): string {
  if (outcome === "pass") return "pass";
  const missing = Array.isArray(details.missing)
    ? (details.missing as unknown[]).join(",")
    : "";
  const error = typeof details.error === "string" ? details.error : "";
  return [outcome, httpStatus ?? "", missing, error].join("|");
}

async function readBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", truncated: false };

  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > maxBytes) {
      const keep = maxBytes - (received - value.byteLength);
      if (keep > 0) chunks.push(value.slice(0, keep));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { text: buffer.toString("utf-8"), truncated };
}

export async function runHttpCheck(
  target: HttpCheckTarget,
): Promise<HttpCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    let currentUrl = target.url;
    let redirects = 0;
    let response: Response;

    while (true) {
      const guard = await assertPublicHttpsUrl(currentUrl);
      if (!guard.ok) {
        const details = { url: currentUrl, error: guard.reason, redirects };
        return {
          outcome: "error",
          http_status: null,
          ttfb_ms: null,
          details,
          fingerprint: computeFingerprint("error", null, details),
        };
      }

      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      });

      const isRedirect = response.status >= 300 && response.status < 400;
      const location = response.headers.get("location");

      if (isRedirect && location) {
        redirects += 1;
        if (redirects > MAX_REDIRECTS) {
          const details = {
            url: currentUrl,
            error: "Boucle de redirection.",
            redirects,
          };
          return {
            outcome: "error",
            http_status: response.status,
            ttfb_ms: Date.now() - started,
            details,
            fingerprint: computeFingerprint("error", response.status, details),
          };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      break;
    }

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

    const statusOk = response.status === target.expect_status;
    const outcome: "pass" | "fail" =
      statusOk && missing.length === 0 ? "pass" : "fail";
    const details = {
      url: currentUrl,
      redirects,
      bodyExcerpt: bodyText.slice(0, 500),
      bodyTruncated: truncated,
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
