-- The only notification preference was "recevoir les alertes par email",
-- all or nothing: an account that wanted to hear about breakage but not
-- about every recovery had to turn the whole channel off.
--
-- These split it by event kind, matching the three kinds dispatchAlerts
-- already distinguishes (fail / recovered / mutated). They govern the
-- email channel only — Discord, Slack and Telegram are configured per
-- project, and silencing someone else's project from a personal account
-- setting would be surprising.
--
-- notify_fail has no column: email_alerts_enabled already is that switch,
-- and a second one meaning almost the same thing is how a settings page
-- becomes unreadable.
alter table public.profiles
  add column if not exists notify_recovered boolean not null default true,
  add column if not exists notify_mutated boolean not null default true,
  add column if not exists notify_digest boolean not null default true,
  add column if not exists notify_product_updates boolean not null default false;
