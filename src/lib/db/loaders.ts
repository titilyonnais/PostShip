import { cache } from "react";
import { createClient } from "./server";

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
    .select("id, name, base_url, last_status, last_checked_at, paused")
    .order("created_at");
  return data ?? [];
});

export const getProject = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  return data;
});
