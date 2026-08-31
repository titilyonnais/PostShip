-- check_runs + check_jobs (see docs/DATA_MODEL.md)
create table public.check_runs (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.check_targets (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null check (outcome in ('pass', 'fail', 'error')),
  http_status int,
  ttfb_ms int,
  fingerprint text,
  details jsonb not null default '{}'::jsonb
);

create index check_runs_project_started_idx on public.check_runs (project_id, started_at desc);
create index check_runs_target_started_idx on public.check_runs (target_id, started_at desc);

-- Vercel Cron job queue (see ARCHITECTURE.md — Inngest was not chosen)
create table public.check_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  reason text not null check (reason in ('cron', 'deploy', 'manual')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text
);

alter table public.check_runs enable row level security;
alter table public.check_jobs enable row level security;

-- Read-only for users: rows are only ever written by the service-role runner.
create policy "own check_runs" on public.check_runs
  for select using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.user_id = auth.uid())
  );

create policy "own check_jobs" on public.check_jobs
  for select using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.user_id = auth.uid())
  );
