import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { linkPendingProjectInvites } from "@/lib/project-members";

// login/actions.ts's nextPathFor() always emits a relative path under
// /onboarding — this allowlist is deliberately narrower than "any relative
// path" (a naive `${origin}${next}` concatenation, or even a bare
// startsWith("/") check, is an open-redirect footgun: "//evil.com" or
// "\evil.com" are both protocol-relative in a browser despite "starting
// with /", and any relative path at all would let an attacker craft a
// callback link into an arbitrary in-app page — e.g. one that itself
// redirects out, or simply phishing via a convincing internal URL).
const ALLOWED_NEXT_PREFIXES = ["/app", "/onboarding", "/accept-terms", "/login"];
const DEFAULT_NEXT = "/onboarding";

export function sanitizeNext(rawNext: string | null): string {
  if (!rawNext) return DEFAULT_NEXT;
  if (rawNext.includes("\\")) return DEFAULT_NEXT;
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) return DEFAULT_NEXT;
  // A relative path can still smuggle an absolute URL via its own scheme,
  // e.g. "/https://evil.com" isn't a valid path but some parsers are
  // lenient — reject anything containing "://" outright.
  if (rawNext.includes("://")) return DEFAULT_NEXT;

  const isAllowed = ALLOWED_NEXT_PREFIXES.some(
    (prefix) => rawNext === prefix || rawNext.startsWith(`${prefix}/`) || rawNext.startsWith(`${prefix}?`),
  );
  return isAllowed ? rawNext : DEFAULT_NEXT;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // GitHub/Google hand back a name and a real photo in user_metadata —
      // only worth reading (and only worth writing) the first time this
      // profile row is created, so a later login never clobbers a name or
      // avatar the user has since customized in Profil.
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      const meta = data.user.user_metadata as Record<string, unknown> | null;
      const oauthName =
        (meta?.full_name as string | undefined) ||
        (meta?.name as string | undefined) ||
        (meta?.user_name as string | undefined) ||
        null;
      const oauthAvatarUrl =
        (meta?.avatar_url as string | undefined) || (meta?.picture as string | undefined) || null;

      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
        ...(!existingProfile && {
          display_name: oauthName,
          avatar_url: oauthAvatarUrl,
        }),
      });

      if (data.user.email) {
        await linkPendingProjectInvites(
          createServiceClient(),
          data.user.id,
          data.user.email,
        );
      }

      // OAuth / magic-link accounts never go through signUpWithPassword's
      // explicit consent write — the middleware also catches this for
      // /app and /onboarding, but redirecting straight there avoids the
      // extra hop for the common case.
      const { data: profile } = await supabase
        .from("profiles")
        .select("terms_accepted_at")
        .eq("id", data.user.id)
        .single();

      if (!profile?.terms_accepted_at) {
        return NextResponse.redirect(`${origin}/accept-terms`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
