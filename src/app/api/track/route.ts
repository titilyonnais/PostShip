import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { recordVisit } from "@/lib/visit-tracking";

// The middleware can't do this itself: it runs on the edge runtime, where
// the Supabase service client isn't available. So it fires a request at
// this route and doesn't wait for it — the visitor's page never blocks on
// telemetry, and a failure here costs a row, not a page view.
//
// Not a public analytics endpoint: it only trusts the headers the
// platform set on the incoming request, never a body. Anyone POSTing here
// by hand records their own visit, which is exactly what visiting does
// anyway.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = request.headers;

  // The middleware forwards the original request's path; the header is
  // ours, not the client's, and anything unexpected is simply recorded as
  // it arrives — this data is read by a human, never executed.
  const path = headers.get("x-track-path") ?? "/";
  const method = headers.get("x-track-method") ?? "GET";

  // Attribution is best-effort. An anonymous visit is still worth a row —
  // it is the one an attacker leaves.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  // Read the x-track-* copies the middleware made, never the live
  // forwarding headers: this request came from our own infrastructure, so
  // x-forwarded-for here is Vercel's egress address, not the visitor's.
  const decodeCity = (raw: string | null) => {
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  };
  const num = (raw: string | null) => {
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  await recordVisit({
    ip: headers.get("x-track-ip") || "unknown",
    path,
    method,
    userId,
    userAgent: headers.get("x-track-ua") || null,
    referer: headers.get("x-track-referer") || null,
    acceptLanguage: headers.get("x-track-lang") || null,
    country: headers.get("x-track-geo-country"),
    region: headers.get("x-track-geo-country-region"),
    city: decodeCity(headers.get("x-track-geo-city")),
    latitude: num(headers.get("x-track-geo-latitude")),
    longitude: num(headers.get("x-track-geo-longitude")),
    timezone: headers.get("x-track-geo-timezone"),
  });

  return NextResponse.json({ ok: true });
}
