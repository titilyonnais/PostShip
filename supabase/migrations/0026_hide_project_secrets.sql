-- discord_webhook_url / vercel_hook_secret / slack_webhook_url /
-- netlify_hook_secret / cloudflare_hook_secret were already locked to
-- service-role-only WRITES (migrations 0017/0020/0021), but SELECT was
-- never touched — the table-level `grant all` from Supabase's default
-- schema setup still lets `authenticated` read these raw secrets straight
-- through PostgREST with the anon key + a user's own JWT
-- (`select vercel_hook_secret from projects where id = ...`), even though
-- the app's own UI never displays them. Same lesson as 0013: a
-- column-level REVOKE cannot narrow a table-level GRANT that's still in
-- effect, so this has to revoke SELECT at the table level and re-grant an
-- explicit allowlist, not just revoke the five secret columns directly.
--
-- Generated boolean flags let the settings UI show "configured / not
-- configured" without ever reading the secret itself.
alter table public.projects
  add column if not exists vercel_hook_configured boolean
    generated always as (vercel_hook_secret is not null) stored,
  add column if not exists discord_webhook_configured boolean
    generated always as (discord_webhook_url is not null) stored,
  add column if not exists slack_webhook_configured boolean
    generated always as (slack_webhook_url is not null) stored,
  add column if not exists netlify_hook_configured boolean
    generated always as (netlify_hook_secret is not null) stored,
  add column if not exists cloudflare_hook_configured boolean
    generated always as (cloudflare_hook_secret is not null) stored;

revoke select on public.projects from authenticated;

grant select (
  id, user_id, name, base_url, locale, last_checked_at, last_status,
  created_at, paused,
  vercel_hook_configured, discord_webhook_configured, slack_webhook_configured,
  netlify_hook_configured, cloudflare_hook_configured
) on public.projects to authenticated;
