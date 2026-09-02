-- F7 (features backlog): optional GitHub Checks integration — after a
-- Vercel deploy webhook's checks run, POST a check-run to the linked
-- GitHub repo so PostShip's result shows up on the commit/PR. Token is a
-- real secret (a fine-grained PAT), so it stays out of the authenticated
-- grant allowlist entirely (same treatment as discord_webhook_url /
-- telegram_bot_token) — github_repo alone is just "owner/repo" and safe
-- to read back into the settings form.
alter table public.projects
  add column if not exists github_repo text,
  add column if not exists github_token_enc text,
  add column if not exists github_connected boolean
    generated always as (github_repo is not null and github_token_enc is not null) stored;

grant select (github_repo, github_connected) on public.projects to authenticated;
