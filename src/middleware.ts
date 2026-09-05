import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/db/middleware";

// Headers for the operator console only. They are deliberately stricter
// than the app's: the console never embeds anything, is never embedded,
// must never be cached by an intermediary, and must never leak its URLs
// to a third party through a Referer.
function consoleHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  // frame-ancestors is the header-only half of clickjacking defence that
  // X-Frame-Options above cannot express for modern browsers.
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  );
  return response;
}

// Document requests only. Recording every stylesheet, font and JSON fetch
// would multiply the row count by twenty and answer nothing the page view
// doesn't already.
function isPageRequest(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  if (!request.headers.get("accept")?.includes("text/html")) return false;
  const { pathname } = request.nextUrl;
  return (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    !pathname.startsWith("/admin") &&
    !/\.[a-z0-9]+$/i.test(pathname)
  );
}

// Fire-and-forget: the visitor's page must never wait on telemetry, and a
// failure here costs a row rather than a page view. The edge runtime has
// no Supabase service client, hence the hop through /api/track.
function track(request: NextRequest): void {
  const url = new URL("/api/track", request.nextUrl.origin);
  const headers = new Headers(request.headers);
  headers.set("x-track-path", request.nextUrl.pathname);
  headers.set("x-track-method", request.method);

  void fetch(url, { method: "POST", headers, keepalive: true }).catch(() => {});
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // No Supabase round-trip here: the console has its own session realm
    // (src/lib/admin-auth.ts) and never reads a customer cookie. The
    // console's own traffic is not tracked either — an operator looking
    // at the visit log should not be adding to it.
    return consoleHeaders(NextResponse.next());
  }

  if (isPageRequest(request)) track(request);

  if (
    request.nextUrl.pathname.startsWith("/app") ||
    request.nextUrl.pathname.startsWith("/onboarding")
  ) {
    return await updateSession(request);
  }

  return NextResponse.next();
}

// Now covers the marketing pages too, because that is where the traffic
// worth watching arrives. Static assets and Next's own internals are
// excluded by the matcher so the tracker never sees them at all.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml|brand/|email/|.*\.(?:png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$).*)",
  ],
};
