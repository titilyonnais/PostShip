import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";

// Attaching a second sign-in method to an account already signed in —
// Supabase calls this manual identity linking. A route handler rather than
// a server action because the flow ends in a redirect to Google/GitHub,
// which is what a plain link does best (same shape as the Discord/Slack
// quick-connects under /api/oauth).
const SUPPORTED = new Set(["google", "github"]);

const BACK_TO = "/app/account?tab=security";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const { origin } = new URL(request.url);

  if (!SUPPORTED.has(provider)) {
    return NextResponse.redirect(`${origin}${BACK_TO}&link_error=unsupported`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Already attached: linking again would bounce off Supabase with a
  // less legible error than saying so here.
  const alreadyLinked = (user.identities ?? []).some((i) => i.provider === provider);
  if (alreadyLinked) {
    return NextResponse.redirect(`${origin}${BACK_TO}&link_error=already_linked`);
  }

  const { data, error } = await supabase.auth.linkIdentity({
    provider: provider as "google" | "github",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(BACK_TO)}`,
      // No browser to redirect on the server — hand the URL back instead.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    console.error("Échec de la liaison d'identité", provider, error?.message);
    return NextResponse.redirect(`${origin}${BACK_TO}&link_error=${provider}`);
  }

  return NextResponse.redirect(data.url);
}
