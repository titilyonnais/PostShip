import { createServiceClient } from "@/lib/db/service";

// Turns a request into a visit row. Called from a route handler the
// middleware pings, because middleware runs on the edge runtime where the
// Supabase service client and node:crypto are not available.
//
// What is deliberately not collected: no cookie, no cross-site
// identifier, no canvas or WebGL fingerprint. Those need consent under
// ePrivacy, they break on every browser update, and none of them answers
// a question this console actually asks. Everything below either arrives
// in the request headers already or is resolved by Vercel's edge at no
// cost — which is also why there is no third-party geolocation processor
// in the picture.

export type VisitInput = {
  ip: string;
  /** Decided by the caller from the full header set, not from the UA. */
  isBot: boolean;
  path: string;
  method: string;
  userId: string | null;
  userAgent: string | null;
  referer: string | null;
  acceptLanguage: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
};

export type DeviceInfo = { device: string; browser: string; os: string };

// Four regex families rather than a user-agent database: the database is
// a monthly-updated dependency, and "Chrome on Windows, desktop" is what
// the console shows. Order matters — Edge and Opera both claim Chrome,
// and Chrome claims Safari. Whether it is a bot is decided elsewhere, by
// src/lib/bot-detection.ts, which looks at far more than this string.
export function describeDevice(ua: string | null): DeviceInfo {
  if (!ua) return { device: "inconnu", browser: "inconnu", os: "inconnu" };

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "inconnu";

  const os = /Windows NT 10/.test(ua)
    ? "Windows 10/11"
    : /Windows NT/.test(ua)
      ? "Windows"
      : /iPhone|iPod/.test(ua)
        ? "iOS"
        : /iPad/.test(ua)
          ? "iPadOS"
          : /Mac OS X/.test(ua)
            ? "macOS"
            : /Android/.test(ua)
              ? "Android"
              : /CrOS/.test(ua)
                ? "ChromeOS"
                : /Linux/.test(ua)
                  ? "Linux"
                  : "inconnu";

  const device = /Mobile|iPhone|iPod/.test(ua)
    ? "mobile"
    : /iPad|Tablet/.test(ua)
      ? "tablette"
      : "ordinateur";

  return { device, browser, os };
}

function num(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Vercel's edge sets these from the connecting IP. Reading them rather
// than calling a geolocation API means no extra latency, no per-lookup
// cost, and no processor to disclose.
export function geoFromHeaders(headers: Headers) {
  return {
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
    // Vercel percent-encodes city names with spaces or accents.
    city: (() => {
      const raw = headers.get("x-vercel-ip-city");
      if (!raw) return null;
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    })(),
    latitude: num(headers.get("x-vercel-ip-latitude")),
    longitude: num(headers.get("x-vercel-ip-longitude")),
    timezone: headers.get("x-vercel-ip-timezone"),
  };
}

export function clientIpFromHeaders(headers: Headers): string {
  // Only the last hop of x-forwarded-for is one the platform appended;
  // everything before it is whatever the client felt like sending. Same
  // reasoning as src/lib/auth-rate-limit.ts.
  const forwarded = headers.get("x-forwarded-for");
  return (
    headers.get("x-real-ip") ?? forwarded?.split(",").pop()?.trim() ?? "unknown"
  );
}

export async function recordVisit(input: VisitInput): Promise<void> {
  const { device, browser, os } = describeDevice(input.userAgent);

  try {
    const { error } = await createServiceClient().rpc("record_visit", {
      p_ip: input.ip,
      p_path: input.path.slice(0, 512),
      p_method: input.method,
      p_user_id: input.userId,
      p_user_agent: input.userAgent?.slice(0, 500) ?? null,
      p_referer: input.referer?.slice(0, 500) ?? null,
      p_accept_language: input.acceptLanguage?.slice(0, 120) ?? null,
      p_country: input.country,
      p_region: input.region,
      p_city: input.city,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_timezone: input.timezone,
      p_device: device,
      p_browser: browser,
      p_os: os,
      p_is_bot: input.isBot,
    });

    if (error) console.error("Échec enregistrement de visite", error.message);
  } catch (err) {
    // Telemetry must never be able to fail a page view.
    console.error("Échec enregistrement de visite", err);
  }
}
