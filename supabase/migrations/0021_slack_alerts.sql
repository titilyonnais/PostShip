-- Slack alerts, alongside the existing Discord channel. Same treatment as
-- discord_webhook_url (migration 0017): not added to the authenticated
-- grant allowlist, so this column is service-role-only — written only via
-- setSlackWebhook's ownership-checked server action, never directly by the
-- user's own session client.
alter table public.projects
  add column slack_webhook_url text;

alter table public.alert_events
  drop constraint alert_events_channel_check,
  add constraint alert_events_channel_check check (channel in ('email', 'discord', 'slack'));
