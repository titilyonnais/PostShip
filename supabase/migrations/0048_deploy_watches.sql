-- V5 (ia-moderne backlog): "the 8 minutes after the ship" — the tick
-- (src/app/api/cron/tick/route.ts) now also consumes 2 delayed re-checks
-- per production deploy (T+2, T+8), queued as check_jobs rows by the
-- deploy webhook routes right after the immediate T+0 run.
alter table public.check_jobs
  add column if not exists run_after timestamptz,
  add column if not exists deploy_event_id uuid references public.deploy_events (id) on delete cascade,
  add column if not exists outcome text check (outcome in ('pass', 'fail'));

alter table public.check_jobs drop constraint if exists check_jobs_reason_check;
alter table public.check_jobs
  add constraint check_jobs_reason_check
  check (reason in ('cron', 'deploy', 'manual', 'watch_t2', 'watch_t8'));

-- At most one T+2 and one T+8 row per deploy — a retried webhook delivery
-- (or any other double-insert) hits this instead of queuing a 3rd watch.
create unique index if not exists check_jobs_deploy_watch_unique
  on public.check_jobs (project_id, deploy_event_id, reason)
  where deploy_event_id is not null;

create index if not exists check_jobs_due_watch_idx
  on public.check_jobs (run_after)
  where status = 'queued' and deploy_event_id is not null;
