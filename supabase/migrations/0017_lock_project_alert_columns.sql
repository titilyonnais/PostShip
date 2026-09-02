-- Same class of bug as 0013 (profiles): the "own projects" RLS policy is
-- `for all`, so an authenticated user can UPDATE any column on their own
-- project row via a direct PostgREST/supabase-js call — bypassing the
-- Discord-domain regex and plan gating that setDiscordWebhook() enforces
-- in application code. discord_webhook_url is fetched directly by
-- src/lib/alerts.ts, so a bypassed value becomes a stored SSRF target.
-- vercel_hook_secret is a shared secret, not something the owner should be
-- able to silently overwrite either. last_checked_at/last_status are
-- runner-only and already written exclusively via the service role
-- (src/lib/runner.ts), so they were never meant to be user-writable.
--
-- Same fix pattern as 0013: revoke the table-level grant, then re-grant
-- only the columns the app's own server actions actually write with the
-- user's session client (name, base_url, paused). discord_webhook_url and
-- vercel_hook_secret become service-role-only — the corresponding server
-- actions now verify ownership with the user client, then write with
-- createServiceClient() after their own validation has run.
revoke insert, update on public.projects from authenticated;

grant insert (
  id, user_id, name, base_url, locale
) on public.projects to authenticated;

grant update (
  name, base_url, paused
) on public.projects to authenticated;
