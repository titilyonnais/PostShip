import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { verifyOAuthState } from "@/lib/oauth-state";
import { discordWebhookSchema } from "@/lib/webhook-url-schemas";

// Must exactly match the redirect_uri sent in the authorize request
// (src/app/api/oauth/discord/start) — Discord rejects a mismatch.
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr"}/api/oauth/discord/callback`;

type DiscordTokenResponse = {
  webhook?: { url?: string };
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const state = verifyOAuthState(searchParams.get("state"));

  if (!state) {
    return NextResponse.redirect(`${origin}/app?oauth_error=discord`);
  }

  const backTo = `${origin}/app/${state.projectId}/integrations`;

  if (providerError || !code) {
    return NextResponse.redirect(`${backTo}?oauth_error=discord`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${backTo}?oauth_error=discord_not_configured`);
  }

  let tokenJson: DiscordTokenResponse;
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(`${backTo}?oauth_error=discord`);
    }
    tokenJson = (await tokenRes.json()) as DiscordTokenResponse;
  } catch {
    return NextResponse.redirect(`${backTo}?oauth_error=discord`);
  }

  const parsed = discordWebhookSchema.safeParse(tokenJson.webhook?.url);
  if (!parsed.success) {
    return NextResponse.redirect(`${backTo}?oauth_error=discord`);
  }

  // Ownership + plan gate — same checks src/lib/[projectId]/actions.ts's
  // setChatWebhook applies to a manually pasted URL, just re-derived here
  // since this route can't call a "use server" action directly.
  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", state.projectId)
    .single();
  if (!project) {
    return NextResponse.redirect(`${origin}/app`);
  }

  const allowed = getPlanLimits(await getProjectOwnerPlan(project.user_id)).chatWebhooks;
  if (!allowed) {
    return NextResponse.redirect(`${backTo}?oauth_error=plan`);
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ discord_webhook_url: parsed.data })
    .eq("id", state.projectId);

  if (error) {
    return NextResponse.redirect(`${backTo}?oauth_error=discord`);
  }

  return NextResponse.redirect(`${backTo}?connected=discord`);
}
