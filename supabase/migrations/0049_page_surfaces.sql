-- V6 (ia-moderne backlog): "mutation radar" — one row per http target,
-- upserted on every check run (cron/manual/deploy alike), holding the
-- page's last-seen title/h1/description/og:title so a deploy run can
-- detect one of them disappearing or turning into a placeholder (see
-- src/lib/surface.ts). Read-only for users, written by the service-role
-- runner only, same shape as check_runs/check_jobs.
create table public.page_surfaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  target_id uuid not null references public.check_targets (id) on delete cascade,
  title text,
  h1 text,
  description text,
  og_title text,
  seen_at timestamptz not null default now(),
  -- Set whenever detectSurfaceMutations flags this target on a deploy run
  -- (src/lib/runner.ts's trackPageSurface) — the URLs page compares this
  -- against the project's most recent deploy to show the amber "mutated
  -- since last deploy" pill.
  mutated_at timestamptz,
  unique (target_id)
);

create index page_surfaces_project_idx on public.page_surfaces (project_id);

alter table public.page_surfaces enable row level security;

create policy "own or member page_surfaces" on public.page_surfaces
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.project_members m
            where m.project_id = p.id and m.user_id = auth.uid() and m.status = 'accepted'
          )
        )
    )
  );
