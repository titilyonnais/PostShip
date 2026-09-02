import { guardedFetch, readBodyCapped, MAX_BODY_BYTES, TIMEOUT_MS } from "@/lib/checks/shared";

// M4 (menu backlog): domain-expiration lookup via the RDAP bootstrap
// service (rdap.org), through the same SSRF-guarded fetch every outbound
// request in this codebase uses (CLAUDE.md). No invented schema — RDAP's
// `events` array with eventAction "expiration" is the standard field per
// RFC 9083; a lookup that fails or doesn't parse cleanly reports an
// unknown date rather than guessing.
export type DomainExpiry = {
  date: string | null;
  daysRemaining: number | null;
};

export async function fetchDomainExpiry(hostname: string): Promise<DomainExpiry> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const result = await guardedFetch(`https://rdap.org/domain/${hostname}`, {
      signal: controller.signal,
    });

    if (!result.ok) return { date: null, daysRemaining: null };

    const { text } = await readBodyCapped(result.response, MAX_BODY_BYTES);
    let body: { events?: { eventAction?: string; eventDate?: string }[] };
    try {
      body = JSON.parse(text);
    } catch {
      return { date: null, daysRemaining: null };
    }

    const expirationEvent = (body.events ?? []).find(
      (e) => e.eventAction === "expiration",
    );
    if (!expirationEvent?.eventDate) return { date: null, daysRemaining: null };

    const date = new Date(expirationEvent.eventDate);
    if (Number.isNaN(date.getTime())) return { date: null, daysRemaining: null };

    const daysRemaining = Math.round(
      (date.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    return { date: expirationEvent.eventDate, daysRemaining };
  } catch {
    return { date: null, daysRemaining: null };
  } finally {
    clearTimeout(timeout);
  }
}
