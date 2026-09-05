-- Supervision for the operator, behind /app/admin.
--
-- One function rather than twenty round-trips: the page needs totals,
-- a daily series and a few breakdowns at once, and doing that from
-- PostgREST would mean a query per bucket per metric.
--
-- SECURITY DEFINER because it reads auth.sessions — that is where "who is
-- connected right now" actually lives, and PostgREST cannot reach the auth
-- schema. It is revoked from anon and authenticated: only service_role can
-- call it, and the page above it re-checks the caller against
-- ADMIN_USER_IDS before ever getting that far.
--
-- search_path is pinned, as it must be on any SECURITY DEFINER function:
-- without it a caller could shadow `profiles` with their own table and
-- have this run against it with the definer's rights.

create or replace function public.admin_overview(days integer default 30)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
stable
as $$
  with bounds as (
    select
      greatest(1, least(coalesce(days, 30), 365)) as window_days,
      (current_date - (greatest(1, least(coalesce(days, 30), 365)) - 1)) as first_day
  ),
  calendar as (
    select generate_series(
      (select first_day from bounds),
      current_date,
      interval '1 day'
    )::date as day
  ),
  signups as (
    select created_at::date as day, count(*) as n
    from public.profiles
    where created_at >= (select first_day from bounds)
    group by 1
  ),
  -- A session row is touched on every token refresh, so its updated_at is
  -- the closest thing to "this person was using the app that day".
  active as (
    select updated_at::date as day, count(distinct user_id) as n
    from auth.sessions
    where updated_at >= (select first_day from bounds)
    group by 1
  ),
  runs as (
    select
      started_at::date as day,
      count(*) as n,
      count(*) filter (where outcome <> 'pass') as failed
    from public.check_runs
    where started_at >= (select first_day from bounds)
    group by 1
  ),
  series as (
    select
      c.day,
      coalesce(s.n, 0) as signups,
      coalesce(a.n, 0) as active_users,
      coalesce(r.n, 0) as check_runs,
      coalesce(r.failed, 0) as failed_runs
    from calendar c
    left join signups s on s.day = c.day
    left join active a on a.day = c.day
    left join runs r on r.day = c.day
    order by c.day
  )
  select jsonb_build_object(
    'generated_at', now(),
    'window_days', (select window_days from bounds),

    'totals', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'projects', (select count(*) from public.projects),
      'targets', (select count(*) from public.check_targets),
      'targets_enabled', (select count(*) from public.check_targets where enabled),
      'incidents_open', (
        select count(*) from public.check_targets
        where enabled and last_outcome in ('fail', 'error')
      )
    ),

    'presence', jsonb_build_object(
      -- Refreshed in the last quarter hour: a live session, not merely an
      -- unexpired one (a token can stay valid for days unused).
      'online_now', (
        select count(distinct user_id) from auth.sessions
        where updated_at > now() - interval '15 minutes'
      ),
      'active_24h', (
        select count(distinct user_id) from auth.sessions
        where updated_at > now() - interval '24 hours'
      ),
      'active_7d', (
        select count(distinct user_id) from auth.sessions
        where updated_at > now() - interval '7 days'
      ),
      'active_30d', (
        select count(distinct user_id) from auth.sessions
        where updated_at > now() - interval '30 days'
      )
    ),

    'plans', (
      select coalesce(jsonb_object_agg(plan, n), '{}'::jsonb)
      from (
        select coalesce(plan, 'free') as plan, count(*) as n
        from public.profiles group by 1
      ) t
    ),

    'checks_24h', jsonb_build_object(
      'total', (
        select count(*) from public.check_runs
        where started_at > now() - interval '24 hours'
      ),
      'failed', (
        select count(*) from public.check_runs
        where started_at > now() - interval '24 hours' and outcome <> 'pass'
      )
    ),

    -- Cron health: the runner writes a run every cycle, so the age of the
    -- newest one is how you tell a stalled scheduler from a quiet night.
    'last_check_run_at', (select max(started_at) from public.check_runs),
    'last_deploy_event_at', (select max(started_at) from public.deploy_events),

    'series', (select coalesce(jsonb_agg(to_jsonb(series)), '[]'::jsonb) from series),

    'noisiest_projects', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      from (
        select p.name, p.id, count(*) filter (where r.outcome <> 'pass') as failed
        from public.check_runs r
        join public.projects p on p.id = r.project_id
        where r.started_at >= (select first_day from bounds)
        group by p.id, p.name
        having count(*) filter (where r.outcome <> 'pass') > 0
        order by failed desc
        limit 8
      ) t
    )
  );
$$;

revoke all on function public.admin_overview(integer) from public;
revoke all on function public.admin_overview(integer) from anon;
revoke all on function public.admin_overview(integer) from authenticated;
grant execute on function public.admin_overview(integer) to service_role;
