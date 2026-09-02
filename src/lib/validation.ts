import { assertPublicHttpsUrl } from "@/lib/ssrf";

export type RegisterableUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

// Single async gate for any URL a user asks PostShip to store and later
// fetch on its own schedule (project base_url, a check_targets URL, a
// site-scan seed) — httpsUrlSchema used to only check the protocol
// syntactically at the Zod layer, leaving the actual SSRF check
// (assertPublicHttpsUrl) to be called separately, inconsistently, or not
// at all at some call sites. This wraps both into one call so there's a
// single place that decides whether a URL is registerable.
export async function assertRegisterableHttpsUrl(
  raw: string,
): Promise<RegisterableUrlResult> {
  const trimmed = raw.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "URL invalide." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "L'URL doit être en https." };
  }

  if (!url.hostname) {
    return { ok: false, reason: "URL invalide." };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "URL invalide (identifiants non autorisés)." };
  }

  const guard = await assertPublicHttpsUrl(url.toString());
  if (!guard.ok) {
    return { ok: false, reason: guard.reason };
  }

  return { ok: true, url: url.toString() };
}
