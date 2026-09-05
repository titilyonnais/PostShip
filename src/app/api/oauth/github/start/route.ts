import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { githubAppInstallUrl, isGithubAppConfigured } from "@/lib/github-app";
import { signOAuthState } from "@/lib/oauth-state";

// Sends the user to GitHub's own "install this app" screen, where they
// pick which repositories it may touch. GitHub bounces back to the app's
// configured Setup URL (this route's sibling callback) with the resulting
// installation_id — the same shape as the Discord/Slack quick-connects,
// minus a token exchange: an App mints its own credentials from its
// private key, so there is no client secret in this half of the flow.
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

  const allowed = getPlanLimits(await getProjectOwnerPlan(project.user_id)).deployHooks;
  if (!allowed) {
    return NextResponse.redirect(`${backTo}?oauth_error=plan`);
  }

  if (!isGithubAppConfigured()) {
    return NextResponse.redirect(`${backTo}?oauth_error=github_not_configured`);
  }

  const state = signOAuthState({ projectId, userId: user.id, ts: Date.now() });
  const installUrl = githubAppInstallUrl(state);
  if (!installUrl) {
    return NextResponse.redirect(`${backTo}?oauth_error=github_not_configured`);
  }

  return NextResponse.redirect(installUrl);
}
