-- Netlify and Cloudflare Pages deploy-webhook secrets, alongside the
-- existing vercel_hook_secret. Not added to the authenticated grant
-- allowlist from migration 0017 — like vercel_hook_secret and
-- discord_webhook_url, these are written exclusively via the service role
-- after an explicit ownership check in the server action (see
-- src/app/(app)/app/[projectId]/actions.ts), never by the user's own
-- session client.
alter table public.projects
  add column netlify_hook_secret text,
  add column cloudflare_hook_secret text;
