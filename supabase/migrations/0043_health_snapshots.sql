-- M4 (menu backlog): cached DNS + RDAP domain-expiry lookups for the
-- Santé page, computed at page-open time (not a new cron check kind) and
-- cached 6h so opening the page repeatedly doesn't hammer rdap.org.
create table public.health_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  checked_at timestamptz not null default now(),
  payload jsonb not null
);

create index health_snapshots_project_idx
  on public.health_snapshots (project_id, checked_at desc);

alter table public.health_snapshots enable row level security;

-- Read-only for users, same "own or member" shape as check_runs/
-- deploy_events — rows are only ever written by the service role from
-- the page's own server-side computation (src/lib/health.ts).
create policy "own or member health_snapshots" on public.health_snapshots
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
