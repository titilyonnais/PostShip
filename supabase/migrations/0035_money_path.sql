-- F2 (features backlog): structural assertions for "money path" HTTP
-- targets (pricing/login/checkout) — a preset, not a new check kind. No
-- column-level grant needed: check_targets has never had the
-- table-level-grant lockdown applied (unlike projects/profiles), so
-- `authenticated` already has full column access via the Supabase
-- default grant, same as expect_contains/expect_not_contains.
alter table public.check_targets
  add column if not exists assertions jsonb not null default '{}'::jsonb;
