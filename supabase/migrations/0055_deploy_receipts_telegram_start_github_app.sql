-- Three integration improvements that all land on public.projects.
--
-- 1. Deploy-hook receipts. Wiring a deploy webhook means pasting a URL
--    into Vercel/Netlify/Cloudflare and a secret back into PostShip, with
--    nothing anywhere to say whether it worked — you find out at the next
--    deploy, or never. These record the last time a *signature-verified*
--    request arrived from each provider, so Intégrations can say
--    "reçu il y a 3 min" instead of leaving the user guessing.
--    Not secrets, just timestamps: safe in the authenticated allowlist.
--
-- 2. telegram_awaiting_start. The chat ID no longer has to be copied out
--    of a getUpdates JSON dump — the bot adopts the first chat that sends
--    it /start (src/app/api/telegram/webhook/[projectId]). This flag is
--    the in-between state (token saved, still waiting for that /start) so
--    the card can say what to do next. telegram_configured keeps its
--    original meaning, "can actually send", since both halves are still
--    needed before an alert can go out.
--
-- 3. github_installation_id. A GitHub App installation replaces the
--    fine-grained PAT: nothing to create by hand, nothing to rotate, and
--    revocation is one click on GitHub's side. The id itself is useless
--    without the app's private key, but it stays out of the authenticated
--    allowlist anyway, same as every other integration identifier here —
--    the UI reads the generated github_app_installed instead.
--    github_connected has to be dropped and recreated because Postgres
--    can't alter a generated expression in place; both PAT and App count
--    as connected, so the legacy path keeps working untouched.

alter table public.projects
  add column if not exists vercel_hook_last_received_at timestamptz,
  add column if not exists netlify_hook_last_received_at timestamptz,
  add column if not exists cloudflare_hook_last_received_at timestamptz;

grant select (
  vercel_hook_last_received_at,
  netlify_hook_last_received_at,
  cloudflare_hook_last_received_at
) on public.projects to authenticated;

alter table public.projects
  add column if not exists telegram_awaiting_start boolean
    generated always as (
      telegram_bot_token is not null and telegram_chat_id is null
    ) stored;

grant select (telegram_awaiting_start) on public.projects to authenticated;

alter table public.projects
  add column if not exists github_installation_id bigint;

alter table public.projects drop column if exists github_connected;

alter table public.projects
  add column github_connected boolean
    generated always as (
      github_repo is not null
      and (github_token_enc is not null or github_installation_id is not null)
    ) stored,
  add column if not exists github_app_installed boolean
    generated always as (github_installation_id is not null) stored;

grant select (github_connected, github_app_installed) on public.projects to authenticated;
