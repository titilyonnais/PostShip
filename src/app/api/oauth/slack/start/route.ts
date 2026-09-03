import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { signOAuthState } from "@/lib/oauth-state";

// Registered with Slack as this app's exact, stable callback — unlike the
// "back to my own app" redirects below, this one can't just follow
// whatever host the request happened to arrive on.
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr"}/api/oauth/slack/callback`;

// Quick-connect Slack: "Add to Slack" with the `incoming-webhook` scope —
// the token exchange response hands back a ready-to-use webhook URL for
// whichever channel the user picks on Slack's own authorize screen.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const backTo = projectId
    ? `${origin}/app/${projectId}/integrations`
    : `${origin}/app`;

  if (!projectId) {
    return NextResponse.redirect(`${origin}/app`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();
  if (!project) {
    return NextResponse.redirect(`${origin}/app`);
  }

  const allowed = getPlanLimits(await getProjectOwnerPlan(project.user_id)).chatWebhooks;
  if (!allowed) {
    return NextResponse.redirect(`${backTo}?oauth_error=plan`);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${backTo}?oauth_error=slack_not_configured`);
  }

  const state = signOAuthState({ projectId, userId: user.id, ts: Date.now() });
  const authorizeUrl = new URL("https://slack.com/oauth/v2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("scope", "incoming-webhook");
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl.toString());
}
