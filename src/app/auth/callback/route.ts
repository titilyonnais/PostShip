import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { linkPendingProjectInvites } from "@/lib/project-members";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  // Only ever redirect to a same-app relative path — no `next` param is
  // emitted by any flow today, but a naive `${origin}${next}` concatenation
  // is an open-redirect footgun for whoever adds one next.
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/app";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
      });

      if (data.user.email) {
        await linkPendingProjectInvites(
          createServiceClient(),
          data.user.id,
          data.user.email,
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
