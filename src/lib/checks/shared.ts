import { assertPublicHttpsUrl } from "@/lib/ssrf";
import {
  BUDGET_EXHAUSTED_MESSAGE,
  tryConsumeBudget,
  type FetchBudget,
} from "@/lib/budgets";

export type CheckResult = {
  outcome: "pass" | "fail" | "error";
  http_status: number | null;
  ttfb_ms: number | null;
  details: Record<string, unknown>;
  fingerprint: string;
};

// Identifies "the same kind of failure" for alert dedup — status + missing
// fields, not the timestamp or TTFB (see docs/ARCHITECTURE.md — Alerts).
export function computeFingerprint(
  outcome: CheckResult["outcome"],
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

export const TIMEOUT_MS = 12_000;
export const MAX_REDIRECTS = 5;
export const MAX_BODY_BYTES = 512 * 1024;
export const USER_AGENT = "PostShipBot/0.1 (+https://postship.fr)";

export type GuardedFetchResult =
  | { ok: true; response: Response; finalUrl: string; redirects: number }
  | {
      ok: false;
      reason: string;
      redirects: number;
      httpStatus: number | null;
    };

// SSRF-guarded fetch that re-validates on every redirect hop — an
// attacker-controlled external URL could otherwise redirect to an
// internal address and bypass the initial check entirely.
export async function guardedFetch(
  initialUrl: string,
  options: { signal: AbortSignal; method?: string; budget?: FetchBudget },
): Promise<GuardedFetchResult> {
  let currentUrl = initialUrl;
  let redirects = 0;

  while (true) {
    // Checked on every hop, not just the first — a redirect chain is
    // several requests, not one, and each one counts against the tick's
    // shared budget (see src/lib/budgets.ts). No budget (manual runs)
    // means unbounded.
    if (!tryConsumeBudget(options.budget)) {
      return {
        ok: false,
        reason: BUDGET_EXHAUSTED_MESSAGE,
        redirects,
        httpStatus: null,
      };
    }

    const guard = await assertPublicHttpsUrl(currentUrl);
    if (!guard.ok) {
      return { ok: false, reason: guard.reason, redirects, httpStatus: null };
    }

    const response = await fetch(currentUrl, {
      method: options.method ?? "GET",
      redirect: "manual",
      signal: options.signal,
      headers: { "User-Agent": USER_AGENT },
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get("location");

    if (isRedirect && location) {
      redirects += 1;
      if (redirects > MAX_REDIRECTS) {
        return {
          ok: false,
          reason: "Boucle de redirection.",
          redirects,
          httpStatus: response.status,
        };
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return { ok: true, response, finalUrl: currentUrl, redirects };
  }
}

export async function readBodyCapped(
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
