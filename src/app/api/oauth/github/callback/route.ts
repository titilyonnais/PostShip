import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { verifyInstallation } from "@/lib/github-app";
import { verifyOAuthState } from "@/lib/oauth-state";

// The GitHub App's Setup URL. GitHub sends the user here after they pick
// the repositories, with installation_id + setup_action + the signed state
// we handed it in .../github/start.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const state = verifyOAuthState(searchParams.get("state"));

  if (!state) {
    return NextResponse.redirect(`${origin}/app?oauth_error=github`);
  }

  const backTo = `${origin}/app/${state.projectId}/integrations`;

  // "request" means the user could only ask an org owner to approve the
  // install — nothing exists to record yet, and saying so beats a generic
  // failure.
  if (searchParams.get("setup_action") === "request") {
    return NextResponse.redirect(`${backTo}?oauth_error=github_pending`);
  }

  const rawId = searchParams.get("installation_id");
  const installationId = Number(rawId);
  if (!rawId || !Number.isSafeInteger(installationId) || installationId <= 0) {
    return NextResponse.redirect(`${backTo}?oauth_error=github`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Ownership + plan gate, re-derived here for the same reason the Discord
  // callback re-derives it: a route handler can't call a "use server"
  // action directly.
  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", state.projectId)
    .single();
  if (!project) {
    return NextResponse.redirect(`${origin}/app`);
  }

  const allowed = getPlanLimits(await getProjectOwnerPlan(project.user_id)).deployHooks;
  if (!allowed) {
    return NextResponse.redirect(`${backTo}?oauth_error=plan`);
  }

  // installation_id arrives as a plain query parameter, so it is untrusted
  // until GitHub itself confirms the installation belongs to this app —
  // without this, anyone could point a project at someone else's
  // installation id and have PostShip mint tokens against it.
  if (!(await verifyInstallation(installationId))) {
    return NextResponse.redirect(`${backTo}?oauth_error=github`);
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ github_installation_id: installationId })
    .eq("id", state.projectId);

  if (error) {
    return NextResponse.redirect(`${backTo}?oauth_error=github`);
  }

  return NextResponse.redirect(`${backTo}?connected=github`);
}
