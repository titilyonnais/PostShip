import { promises as dns } from "node:dns";
import net from "node:net";

export type SsrfCheckResult = { ok: true } | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;

  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local, includes 169.254.169.254 cloud metadata
  if (a === 0) return true; // "this" network
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT

  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local, fc00::/7

  if (lower.startsWith("::ffff:")) {
    const embedded = lower.split(":").pop();
    if (embedded && net.isIPv4(embedded)) return isBlockedIPv4(embedded);
  }

  return false;
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);
  if (net.isIPv6(ip)) return isBlockedIPv6(ip);
  return true;
}

// Resolves the hostname and validates every returned address. The actual
// fetch re-resolves DNS on its own, so a hostile DNS server that changes
// the answer between this check and the request could still slip through
// (DNS rebinding). Acceptable for an indie-scale MVP; revisit if this ever
// needs to withstand a motivated attacker rather than sloppy input.
export async function assertPublicHttpsUrl(
  rawUrl: string,
): Promise<SsrfCheckResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL invalide." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "https uniquement." };
  }

  const hostname = url.hostname.toLowerCase();

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    return { ok: false, reason: "Hôte interne refusé." };
  }

  if (net.isIP(hostname)) {
    return isBlockedIp(hostname)
      ? { ok: false, reason: "Adresse IP interne refusée." }
      : { ok: true };
  }

  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = records.map((r) => r.address);
  } catch {
    return { ok: false, reason: "Résolution DNS impossible." };
  }

  if (addresses.length === 0 || addresses.some(isBlockedIp)) {
    return { ok: false, reason: "L'hôte résout vers une adresse interne." };
  }

  return { ok: true };
}
