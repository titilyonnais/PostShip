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

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // No Supabase round-trip here: the console has its own session realm
    // (src/lib/admin-auth.ts) and never reads a customer cookie.
    return consoleHeaders(NextResponse.next());
  }
  return await updateSession(request);
}

// Scoped to exactly the prefixes handled above — every other route
// (marketing pages, /login, /api/*) doesn't need a Supabase round-trip per
// request, and letting middleware run on them anyway was forcing every
// marketing page to skip Vercel's static cache.
export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/admin/:path*"],
};
