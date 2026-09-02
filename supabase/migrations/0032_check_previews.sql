-- G1: opt-in per-project toggle to also run checks against Vercel preview
-- deployments (deployment.ready events where payload.target !== "production").
-- Same access pattern as `paused` (migration 0017): a simple owner-only
-- boolean with no security implication of the owner writing it directly.
alter table public.projects
  add column if not exists check_previews boolean not null default false;

grant select (check_previews) on public.projects to authenticated;
grant update (check_previews) on public.projects to authenticated;
