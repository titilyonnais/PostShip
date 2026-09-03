import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { verifyOAuthState } from "@/lib/oauth-state";
import { slackWebhookSchema } from "@/lib/webhook-url-schemas";

// Must exactly match the redirect_uri sent in the authorize request
// (src/app/api/oauth/slack/start) — Slack rejects a mismatch.
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr"}/api/oauth/slack/callback`;

type SlackTokenResponse = {
  ok: boolean;
  incoming_webhook?: { url?: string };
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const state = verifyOAuthState(searchParams.get("state"));

  if (!state) {
    return NextResponse.redirect(`${origin}/app?oauth_error=slack`);
  }

  const backTo = `${origin}/app/${state.projectId}/integrations`;

  if (providerError || !code) {
    return NextResponse.redirect(`${backTo}?oauth_error=slack`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${backTo}?oauth_error=slack_not_configured`);
  }

  let tokenJson: SlackTokenResponse;
  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    tokenJson = (await tokenRes.json()) as SlackTokenResponse;
    if (!tokenRes.ok || !tokenJson.ok) {
      return NextResponse.redirect(`${backTo}?oauth_error=slack`);
    }
  } catch {
    return NextResponse.redirect(`${backTo}?oauth_error=slack`);
  }

  const parsed = slackWebhookSchema.safeParse(tokenJson.incoming_webhook?.url);
  if (!parsed.success) {
    return NextResponse.redirect(`${backTo}?oauth_error=slack`);
  }

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
    .update({ slack_webhook_url: parsed.data })
    .eq("id", state.projectId);

  if (error) {
    return NextResponse.redirect(`${backTo}?oauth_error=slack`);
  }

  return NextResponse.redirect(`${backTo}?connected=slack`);
}
