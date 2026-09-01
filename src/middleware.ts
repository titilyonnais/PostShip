import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/db/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// Scoped to exactly the two prefixes updateSession() branches on — every
// other route (marketing pages, /login, /api/*) doesn't need a Supabase
// round-trip per request, and letting middleware run on them anyway was
// forcing every marketing page to skip Vercel's static cache.
export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*"],
};
