-- F6 (features backlog): an optional request header (name + value) so an
-- http target can monitor a page that sits behind a shared secret
-- (e.g. /app or /api/health guarded by a monitoring header). The value is
-- a genuine secret (Authorization/API-key style) — this is the first time
-- check_targets needs the same table-level-grant lockdown
-- projects/profiles already got (migrations 0013/0017/0026): a bare RLS
-- policy alone can't hide one column while leaving the rest world-visible
-- to `authenticated`, so the whole table now needs an explicit column
-- allowlist instead of Supabase's default "grant all".
alter table public.check_targets
  add column if not exists request_header_name text,
  add column if not exists request_header_value text,
  add column if not exists request_header_configured boolean
    generated always as (request_header_value is not null) stored;

revoke insert, update, select on public.check_targets from authenticated;

grant select (
  id, project_id, url, kind, expect_status, expect_contains,
  expect_not_contains, enabled, created_at, last_outcome, last_fingerprint,
  last_started_at, assertions, request_header_name, request_header_configured
) on public.check_targets to authenticated;

grant insert (
  project_id, url, kind, expect_status, expect_contains,
  expect_not_contains, assertions, request_header_name
) on public.check_targets to authenticated;

grant update (
  url, kind, expect_status, expect_contains, expect_not_contains, enabled,
  assertions, request_header_name
) on public.check_targets to authenticated;
