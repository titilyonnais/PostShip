-- Moves "which projects are due" out of the cron tick's application code
-- (which previously fetched every non-test project row, plan included,
-- and filtered in JS) into one indexed SQL query.
--
-- plan_interval_minutes() must stay in lockstep with PLAN_LIMITS in
-- src/lib/entitlements.ts (pinned there by src/lib/entitlements.test.ts)
-- — there's no automated cross-check between the two, so a plan-interval
-- change needs updating both places by hand.
create or replace function public.plan_interval_minutes(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan
    when 'solo' then 5
    when 'team' then 5
    else 30
  end;
$$;

create or replace function public.due_project_ids()
returns table (project_id uuid)
language sql
stable
as $$
  select p.id
  from public.projects p
  join public.profiles pr on pr.id = p.user_id
  where p.paused is not true
    and (
      p.last_checked_at is null
      or p.last_checked_at <= now() - make_interval(mins => public.plan_interval_minutes(pr.plan))
    );
$$;

create index if not exists projects_cron_due_idx
  on public.projects (paused, last_checked_at);
