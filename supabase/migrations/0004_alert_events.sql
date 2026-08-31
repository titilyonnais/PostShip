-- alert_events (see docs/DATA_MODEL.md)
create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  target_id uuid references public.check_targets (id) on delete set null,
  kind text not null check (kind in ('fail', 'recovered')),
  fingerprint text not null,
  channel text not null check (channel in ('email', 'discord')),
  sent_at timestamptz not null default now()
);

create index alert_events_dedup_idx
  on public.alert_events (project_id, fingerprint, channel, sent_at desc);

alter table public.alert_events enable row level security;

-- Read-only for users: rows are only ever written by the service-role runner.
create policy "own alert_events" on public.alert_events
  for select using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.user_id = auth.uid())
  );
