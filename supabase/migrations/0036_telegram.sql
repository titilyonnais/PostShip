-- F5 (features backlog): Telegram alerts alongside Discord/Slack. Same
-- treatment as discord_webhook_url/slack_webhook_url — not added to the
-- authenticated grant allowlist (migrations 0017/0026 already made that
-- allowlist the only way `authenticated` can touch/see any projects
-- column), so both columns are service-role-only for read AND write by
-- construction, written only via the ownership-checked server action.
alter table public.projects
  add column if not exists telegram_bot_token text,
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_configured boolean
    generated always as (telegram_bot_token is not null and telegram_chat_id is not null) stored;

grant select (telegram_configured) on public.projects to authenticated;

alter table public.alert_events
  drop constraint alert_events_channel_check,
  add constraint alert_events_channel_check check (channel in ('email', 'discord', 'slack', 'telegram'));
