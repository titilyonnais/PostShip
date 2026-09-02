-- Proof that the project owner actually controls projects.base_url's
-- host, before the cron/webhook let PostShip's infrastructure make
-- scheduled requests against it on their behalf (see
-- src/lib/domain-verify.ts). Scoped per (project, host) rather than
-- purely per-project so a project could in principle verify more than
-- one host later, though today only base_url's host is checked.
create table public.domain_verifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  host text not null,
  token text not null,
  method text check (method in ('dns-txt', 'well-known')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, host)
);

create index domain_verifications_project_idx on public.domain_verifications (project_id);

alter table public.domain_verifications enable row level security;

-- Read-only for authenticated: token generation and verification writes
-- go through the service role after an ownership/membership check in the
-- server action (src/app/(app)/app/[projectId]/domain-actions.ts), same
-- pattern as discord_webhook_url etc. — there is deliberately no
-- insert/update/delete policy here.
create policy "own or member domain_verifications" on public.domain_verifications
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
