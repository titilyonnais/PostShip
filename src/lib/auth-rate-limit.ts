import { headers } from "next/headers";
import { createServiceClient } from "@/lib/db/service";

const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

export const AUTH_RATE_LIMIT_MESSAGE = "Trop de tentatives. Réessayez plus tard.";

// Applied to every auth entry point that accepts an email + does
// something (send an OTP, attempt a password login, create an account) —
// without this, an attacker gets unlimited free attempts at the
// enumeration surface A4 otherwise closes, or at guessing a password.
export async function checkAuthRateLimit(): Promise<boolean> {
  const headerList = await headers();
  // Same trust reasoning as src/app/api/demo/check/route.ts: x-real-ip is
  // set by Vercel's edge to a single client IP; x-forwarded-for can be a
  // client-supplied chain where only the LAST hop (the one Vercel itself
  // appended) is trustworthy.
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip =
    headerList.get("x-real-ip") ??
    forwardedFor?.split(",").pop()?.trim() ??
    "unknown";

  const supabase = createServiceClient();
  const { data: allowed, error } = await supabase.rpc("auth_attempt_allow", {
    p_ip: ip,
    p_limit: LIMIT,
    p_window_ms: WINDOW_MS,
  });

  if (error) {
    // Fail open on infra trouble — a broken rate limiter shouldn't take
    // down login/signup entirely.
    console.error("Échec vérification du rate-limit auth", error);
    return true;
  }

  return !!allowed;
}
