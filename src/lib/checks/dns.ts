import { promises as dnsPromises } from "node:dns";

// M4 (menu backlog): a lightweight DNS snapshot for the Santé page —
// same Node dns module ssrf.ts already uses for its own lookups, just
// reading records for display rather than resolving for an SSRF check.
export type DnsSnapshot = {
  a: string[];
  aaaa: string[];
  cname: string[];
  hasRecords: boolean;
};

export async function resolveDnsSnapshot(hostname: string): Promise<DnsSnapshot> {
  const [a, aaaa, cname] = await Promise.all([
    dnsPromises.resolve4(hostname).catch(() => [] as string[]),
    dnsPromises.resolve6(hostname).catch(() => [] as string[]),
    dnsPromises.resolveCname(hostname).catch(() => [] as string[]),
  ]);

  return { a, aaaa, cname, hasRecords: a.length > 0 || aaaa.length > 0 };
}
