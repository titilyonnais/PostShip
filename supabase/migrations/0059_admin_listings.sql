-- Listings for the operator console. Same reasoning as admin_overview:
-- SECURITY DEFINER with a pinned search_path, execute revoked from anon
-- and authenticated, granted only to service_role — the console reaches
-- these from the server, never from a browser.
--
-- The joins here are what makes them worth being functions: a user row
-- needs a project count, a target count and a last-seen timestamp that
-- lives in auth.sessions, which PostgREST cannot reach at all.

create or replace function public.admin_users(p_limit integer default 200)
returns table (
  id uuid,
  email text,
  username text,
  plan text,
  token_balance integer,
  stripe_subscription_status text,
  created_at timestamptz,
  projects bigint,
  targets bigint,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = public, auth, pg_temp
stable
as $$
  select
    p.id,
    p.email,
    p.username,
    p.plan,
    p.token_balance,
    p.stripe_subscription_status,
    p.created_at,
    (select count(*) from public.projects pr where pr.user_id = p.id) as projects,
    (
      select count(*)
      from public.check_targets t
      join public.projects pr on pr.id = t.project_id
      where pr.user_id = p.id
    ) as targets,
    (select max(s.updated_at) from auth.sessions s where s.user_id = p.id) as last_seen_at
  from public.profiles p
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

create or replace function public.admin_projects(p_limit integer default 200)
returns table (
  id uuid,
  name text,
  base_url text,
  owner_email text,
  paused boolean,
  targets bigint,
  failing bigint,
  last_checked_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    pr.id,
    pr.name,
    pr.base_url,
    p.email as owner_email,
    pr.paused,
    (select count(*) from public.check_targets t where t.project_id = pr.id) as targets,
    (
      select count(*) from public.check_targets t
      where t.project_id = pr.id and t.enabled and t.last_outcome in ('fail', 'error')
    ) as failing,
    pr.last_checked_at,
    pr.created_at
  from public.projects pr
  left join public.profiles p on p.id = pr.user_id
  order by pr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

revoke all on function public.admin_users(integer) from public, anon, authenticated;
revoke all on function public.admin_projects(integer) from public, anon, authenticated;
grant execute on function public.admin_users(integer) to service_role;
grant execute on function public.admin_projects(integer) to service_role;
