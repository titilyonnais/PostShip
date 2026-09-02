-- N5 (nav-pro backlog): temporary alert silencing — a deploy at 23:00
-- shouldn't page anyone 6 times. Not a secret (unlike webhook URLs/
-- tokens), so it follows the same direct-owner-write pattern as `paused`
-- and `check_previews` (migrations 0017/0032) rather than going through
-- the service role.
alter table public.projects
  add column if not exists alerts_silenced_until timestamptz;

grant select (alerts_silenced_until) on public.projects to authenticated;
grant update (alerts_silenced_until) on public.projects to authenticated;
