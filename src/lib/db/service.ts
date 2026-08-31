import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Bypasses RLS — only for trusted server contexts with no user session
// (the cron runner), never reachable from a request made on a user's behalf.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
