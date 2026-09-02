-- G4: opt-in public status badge. Off by default — a project's status is
-- private unless the owner explicitly turns this on. Same access model as
-- check_previews (migration 0032): plain owner-writable boolean, no
-- security implication of writing it directly.
alter table public.projects
  add column if not exists badge_public boolean not null default false;

grant select (badge_public) on public.projects to authenticated;
grant update (badge_public) on public.projects to authenticated;
