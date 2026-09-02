-- M2 (menu backlog): deploy history. The 3 deploy webhook routes
-- (vercel/netlify/cloudflare) call runProjectChecks/runPreviewChecks
-- directly and never touch check_jobs (that queue is cron/tick-specific),
-- so there's no existing row per deploy to read a payload SHA/provider
-- off of — a dedicated table, not a check_jobs column addition.
create table public.deploy_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  provider text not null check (provider in ('vercel', 'netlify', 'cloudflare')),
  kind text not null check (kind in ('production', 'preview')),
  sha text,
  deployment_url text,
  started_at timestamptz not null default now(),
  outcome text check (outcome in ('pass', 'fail', 'error')),
  fail_count int not null default 0
);

create index deploy_events_project_started_idx
  on public.deploy_events (project_id, started_at desc);

alter table public.deploy_events enable row level security;

-- Read-only for users, same "own or member" shape as check_runs/
-- check_jobs/alert_events (migration 0022) — rows are only ever written
-- by the service role from the deploy webhook routes.
create policy "own or member deploy_events" on public.deploy_events
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
