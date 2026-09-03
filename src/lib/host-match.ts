// V4 (ia-moderne backlog): replaces domain ownership verification
// (DNS TXT / well-known file, removed) as the abuse control on addTarget —
// a target URL must live on the project's own base_url host, or a
// subdomain of it (www., app., ...), so PostShip can't be pointed at a
// domain the caller doesn't control and used as a free scheduled HTTP
// client against it. assertPublicHttpsUrl's SSRF guard and the per-plan
// URL quota still apply on top of this, unchanged.
export function isSameOrSubdomainHost(host: string, baseHost: string): boolean {
  const h = host.toLowerCase();
  const b = baseHost.toLowerCase();
  return h === b || h.endsWith(`.${b}`);
}

export type HostMatchResult = { ok: true } | { ok: false; reason: string };

export function assertSameSiteHost(url: string, baseUrl: string): HostMatchResult {
  let targetHost: string;
  let baseHost: string;
  try {
    targetHost = new URL(url).hostname;
    baseHost = new URL(baseUrl).hostname;
  } catch {
    return { ok: false, reason: "URL invalide." };
  }

  if (!isSameOrSubdomainHost(targetHost, baseHost)) {
    return {
      ok: false,
      reason: `L'URL doit appartenir à ${baseHost} ou à un sous-domaine (ex: www.${baseHost}).`,
    };
  }

  return { ok: true };
}
