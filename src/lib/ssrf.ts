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

// Expands any valid textual IPv6 address (including embedded-IPv4 and "::"
// compression) into its 8 16-bit groups, so ranges can be matched against
// the numeric groups rather than substring-matching the many equivalent
// textual forms the same address can take.
function expandIPv6(ip: string): number[] | null {
  const doubleColonIdx = ip.indexOf("::");
  const hasDoubleColon = doubleColonIdx !== -1;
  const head = hasDoubleColon ? ip.slice(0, doubleColonIdx) : ip;
  const tail = hasDoubleColon ? ip.slice(doubleColonIdx + 2) : "";

  const headGroups = head.length ? head.split(":") : [];
  const tailGroups = tail.length ? tail.split(":") : [];

  // An embedded IPv4 tail (e.g. "::ffff:127.0.0.1" or "2002:c000:0201::")
  // only ever appears as the last group.
  const lastGroupHolder = tailGroups.length ? tailGroups : headGroups;
  const last = lastGroupHolder[lastGroupHolder.length - 1];
  if (last && last.includes(".")) {
    const octets = last.split(".").map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return null;
    }
    lastGroupHolder.pop();
    lastGroupHolder.push((((octets[0] << 8) | octets[1]) >>> 0).toString(16));
    lastGroupHolder.push((((octets[2] << 8) | octets[3]) >>> 0).toString(16));
  }

  const total = headGroups.length + tailGroups.length;
  if (hasDoubleColon ? total > 8 : total !== 8) return null;

  const fillCount = hasDoubleColon ? 8 - total : 0;
  const allGroups = [...headGroups, ...Array(fillCount).fill("0"), ...tailGroups];
  if (allGroups.length !== 8) return null;

  const nums = allGroups.map((g) => (g === "" ? 0 : Number.parseInt(g, 16)));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;

  return nums;
}

function ipv4FromGroups(hi: number, lo: number): string {
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local, fc00::/7

  const groups = expandIPv6(lower);
  if (!groups) return true; // unparseable — refuse rather than let it through
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  // IPv4-mapped, RFC 4291 (::ffff:0:0/96) — covers both the dotted form
  // (::ffff:127.0.0.1) and the pure-hex form (::ffff:7f00:1), which are the
  // same address but the dotted-only substring check above missed the hex one.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isBlockedIPv4(ipv4FromGroups(g6, g7));
  }

  // NAT64 well-known prefix, RFC 6052 (64:ff9b::/96) — DNS64 resolvers embed
  // the IPv4 destination in the last 32 bits the same way.
  if (g0 === 0x0064 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIPv4(ipv4FromGroups(g6, g7));
  }

  // 6to4, RFC 3056 (2002::/16) — the next 32 bits are the embedded IPv4.
  if (g0 === 0x2002) {
    return isBlockedIPv4(ipv4FromGroups(g1, g2));
  }

  // Teredo, RFC 4380 (2001::/32) — the embedded client address is obscured
  // (XORed), not a reliable signal either way; block the whole relay-based
  // prefix rather than try to decode it.
  if (g0 === 0x2001 && g1 === 0) return true;

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

  // WHATWG URL.hostname keeps the brackets for an IPv6 literal (e.g.
  // "[::1]"), which made net.isIP(hostname) below always return 0 for any
  // literal IPv6 URL — the entire literal-IP fast path (and its IPv6
  // range checks) was silently dead code. It still ended up blocked in
  // practice for most cases because Node's dns.lookup() is lenient enough
  // to resolve a bracketed literal back to the same address, but that's an
  // implementation detail to route around, not rely on.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

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
