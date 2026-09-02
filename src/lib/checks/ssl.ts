import tls from "node:tls";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import { computeFingerprint, TIMEOUT_MS, type CheckResult } from "@/lib/checks/shared";

export type SslCheckTarget = { url: string };

// Ordered descending: the first threshold the remaining days fall under
// wins. Each tier is its own `missing` code (not just "expiring soon"), so
// the check_runs fingerprint changes when a cert crosses a threshold —
// alert dedup (shouldSendFailAlert, 10-minute window) is keyed on that
// fingerprint, and without distinct tiers a cert sitting at "< 14 days"
// for two weeks straight would re-alert on every single cron tick instead
// of once per threshold crossing.
const WARNING_THRESHOLDS_DAYS = [30, 7, 1] as const;

function getPeerCertificateExpiry(
  hostname: string,
  port: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, timeout: TIMEOUT_MS },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          reject(new Error("Certificat introuvable."));
          return;
        }
        resolve(cert.valid_to);
      },
    );

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Timeout TLS (12s)."));
    });

    socket.on("error", (err) => reject(err));
  });
}

export async function runSslCheck(target: SslCheckTarget): Promise<CheckResult> {
  const started = Date.now();

  let url: URL;
  try {
    url = new URL(target.url);
  } catch {
    const details = { url: target.url, error: "URL invalide." };
    return {
      outcome: "error",
      http_status: null,
      ttfb_ms: null,
      details,
      fingerprint: computeFingerprint("error", null, details),
    };
  }

  const guard = await assertPublicHttpsUrl(target.url);
  if (!guard.ok) {
    const details = { url: target.url, error: guard.reason };
    return {
      outcome: "error",
      http_status: null,
      ttfb_ms: null,
      details,
      fingerprint: computeFingerprint("error", null, details),
    };
  }

  const port = url.port ? Number(url.port) : 443;

  try {
    const validTo = await getPeerCertificateExpiry(url.hostname, port);
    const ttfbMs = Date.now() - started;
    const expiresAt = new Date(validTo);
    const daysRemaining = Math.floor(
      (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );

    const missing: string[] = [];
    if (daysRemaining < 0) {
      missing.push("ssl_expired");
    } else {
      const tier = WARNING_THRESHOLDS_DAYS.find((days) => daysRemaining < days);
      if (tier) missing.push(`ssl_expiring_${tier}d`);
    }

    const outcome: "pass" | "fail" = missing.length === 0 ? "pass" : "fail";
    const details = { url: target.url, validTo, daysRemaining, missing };

    return {
      outcome,
      http_status: null,
      ttfb_ms: ttfbMs,
      details,
      fingerprint: computeFingerprint(outcome, null, details),
    };
  } catch (err) {
    const details = {
      url: target.url,
      error: err instanceof Error ? err.message : String(err),
    };
    return {
      outcome: "error",
      http_status: null,
      ttfb_ms: Date.now() - started,
      details,
      fingerprint: computeFingerprint("error", null, details),
    };
  }
}
