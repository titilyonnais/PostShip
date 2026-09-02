-- Project collaborators (Team plan): scoped per-project, additive on top
-- of the existing owner-based RLS — the project's original owner
-- (projects.user_id) stays the billing/plan owner, collaborators get
-- read/write access to that one project (URLs, webhooks, alerts) but no
-- billing relationship of their own. See docs/ARCHITECTURE.md decision
-- log for why this stays project-scoped rather than a full team/org
-- model with shared billing (bigger change, its own migration if ever
-- needed).
--
-- Rows are written exclusively via the service role after an explicit
-- ownership check in the server action (src/app/(app)/app/[projectId]/
-- members-actions.ts) — same pattern as discord_webhook_url etc. — so
-- there is deliberately no insert/update/delete policy for
-- `authenticated` here.
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (project_id, invited_email)
);

create index project_members_project_idx on public.project_members (project_id);
create index project_members_user_idx on public.project_members (user_id)
  where user_id is not null;
create index project_members_pending_email_idx on public.project_members (invited_email)
  where status = 'pending';

alter table public.project_members enable row level security;

create policy "read own memberships" on public.project_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- projects: split "own projects" (for all) into per-command policies so
-- collaborators can be granted select/update without also getting
-- insert/delete — those stay owner-only (insert ties to the owner's plan
-- quota, delete is destructive).
drop policy "own projects" on public.projects;

create policy "select own or member projects" on public.projects
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members m
      where m.project_id = id and m.user_id = auth.uid() and m.status = 'accepted'
    )
  );

create policy "insert own projects" on public.projects
  for insert with check (user_id = auth.uid());

create policy "update own or member projects" on public.projects
  for update using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members m
      where m.project_id = id and m.user_id = auth.uid() and m.status = 'accepted'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members m
      where m.project_id = id and m.user_id = auth.uid() and m.status = 'accepted'
    )
  );

create policy "delete own projects" on public.projects
  for delete using (user_id = auth.uid());

-- check_targets: no owner/collaborator distinction needed within this
-- table — managing monitored URLs is exactly the read/write scope a
-- collaborator is granted, so this stays a single additive policy.
drop policy "own targets" on public.check_targets;

create policy "own or member targets" on public.check_targets
  for all using (
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
  )
  with check (
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

-- check_runs, check_jobs, alert_events: read-only history, same additive
-- treatment.
drop policy "own check_runs" on public.check_runs;

create policy "own or member check_runs" on public.check_runs
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

drop policy "own check_jobs" on public.check_jobs;

create policy "own or member check_jobs" on public.check_jobs
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

drop policy "own alert_events" on public.alert_events;

create policy "own or member alert_events" on public.alert_events
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
