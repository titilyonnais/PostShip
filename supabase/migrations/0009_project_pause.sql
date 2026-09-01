-- "Mode maintenance": pauses automatic (cron) checks and alerts for a
-- project without deleting its targets or history. Manual "Lancer
-- maintenant" still works while paused — see src/lib/runner.ts and
-- src/app/api/cron/tick/route.ts.
alter table public.projects
  add column paused boolean not null default false;
