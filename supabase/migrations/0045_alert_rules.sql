-- D6 (drill-nav backlog): alert rules — confirm-after-N-fails, quiet
-- hours, per-URL silence. None of these are secrets (unlike webhook
-- URLs/tokens), so they follow the same direct-owner-write pattern as
-- alerts_silenced_until (migration 0044) rather than going through the
-- service role.
alter table public.projects
  add column if not exists alert_confirm_count int not null default 1
    check (alert_confirm_count between 1 and 3),
  add column if not exists quiet_hours_start smallint
    check (quiet_hours_start between 0 and 23),
  add column if not exists quiet_hours_end smallint
    check (quiet_hours_end between 0 and 23),
  add column if not exists quiet_hours_tz text not null default 'Europe/Paris';

grant select (
  alert_confirm_count, quiet_hours_start, quiet_hours_end, quiet_hours_tz
) on public.projects to authenticated;
grant update (
  alert_confirm_count, quiet_hours_start, quiet_hours_end, quiet_hours_tz
) on public.projects to authenticated;

-- check_targets already uses an explicit column allowlist (migration
-- 0037) — consecutive_fails is service-role-only (written only by the
-- runner, never read client-side), silenced_until is user-facing (the
-- "Couper 4h" action on /urls and the silenced-list on /rules).
alter table public.check_targets
  add column if not exists consecutive_fails int not null default 0,
  add column if not exists silenced_until timestamptz;

grant select (silenced_until) on public.check_targets to authenticated;
grant update (silenced_until) on public.check_targets to authenticated;
