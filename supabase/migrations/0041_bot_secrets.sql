-- M3b (menu backlog): Telegram incoming webhook secret. Same treatment as
-- telegram_bot_token (migration 0036) — never added to the authenticated
-- grant allowlist, so it's unreadable/unwritable by a user's own session
-- client by construction, only ever set by the service role after
-- calling Telegram's setWebhook API.
alter table public.projects
  add column if not exists telegram_webhook_secret text;
