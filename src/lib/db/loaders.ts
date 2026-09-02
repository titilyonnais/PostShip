import { cache } from "react";
import { createClient } from "./server";
import { createServiceClient } from "./service";
import type { Plan } from "@/lib/entitlements";

// Wrapped in React's cache() so a value fetched once per request (e.g. by a
// layout) is reused by every page/component that asks for the same thing
// during that render, instead of re-querying Supabase — the App Router
// renders layouts and pages as separate async components, so without this
// every nested segment was paying for its own round-trip.

export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, email, display_name, username, avatar_seed, full_name, company_name, phone, team_size, plan, billing_address, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, email_alerts_enabled, locale, token_balance",
    )
    .eq("id", userId)
    .single();
  return data;
});

export const getUserProjects = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, base_url, last_status, last_checked_at, paused, user_id")
    .order("created_at");
  return data ?? [];
});

// A project's plan-gated features (interval, Discord/Slack, deploy hooks,
// collaborators) are governed by its OWNER's plan, not whoever happens to
// be viewing it — a Team-plan owner's collaborator can be on the Free
// plan personally and must still see/manage the project's actual
// features. profiles RLS only lets a user read their own row, so a
// collaborator's session client can't see the owner's plan directly;
// this deliberately reads it via the service role instead. A plan name
// isn't sensitive, and this never returns anything beyond that one field.
export const getProjectOwnerPlan = cache(async (ownerId: string): Promise<Plan> => {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", ownerId)
    .single();
  return (data?.plan as Plan) ?? "free";
});

// The five webhook-secret columns (vercel_hook_secret, discord_webhook_url,
// slack_webhook_url, netlify_hook_secret, cloudflare_hook_secret) are
// service-role-only for SELECT too (see migration 0026) — `authenticated`
// only has column-level SELECT on this exact list, and a plain
// `select("*")` fails outright (Postgres rejects the whole query if the
// role lacks privilege on any expanded column, it doesn't silently drop
// the ones it can't see). Settings UI reads the generated
// `*_configured` booleans instead of the secrets themselves.
const PROJECT_COLUMNS =
  "id, user_id, name, base_url, locale, last_checked_at, last_status, created_at, paused, check_previews, stripe_success_url, badge_public, vercel_hook_configured, discord_webhook_configured, slack_webhook_configured, netlify_hook_configured, cloudflare_hook_configured, telegram_configured, github_repo, github_connected";

export const getProject = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", projectId)
    .single();
  return data;
});

export const getProjectMembers = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_members")
    .select("id, invited_email, status, created_at")
    .eq("project_id", projectId)
    .order("created_at");
  return data ?? [];
});

export const getDomainVerification = cache(
  async (projectId: string, host: string) => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("domain_verifications")
      .select("host, token, verified_at, method")
      .eq("project_id", projectId)
      .eq("host", host)
      .maybeSingle();
    return data;
  },
);
