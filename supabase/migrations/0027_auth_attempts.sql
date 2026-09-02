-- Same shape and same atomicity concern as demo_checks/demo_check_allow
-- (migration 0019): a plain count-then-insert lets concurrent requests
-- from the same IP both read a count under the limit and both get
-- through, so this reuses the advisory-lock pattern rather than a bare
-- SELECT + INSERT from the route/action.
create table public.auth_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);

create index auth_attempts_ip_created_idx on public.auth_attempts (ip, created_at desc);

alter table public.auth_attempts enable row level security;
-- No policy for `authenticated`/`anon` at all — written and read
-- exclusively via the service role from auth_attempt_allow() below.

create or replace function public.auth_attempt_allow(
  p_ip text,
  p_limit int,
  p_window_ms int
)
returns boolean
language plpgsql
as $$
declare
  recent_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_ip));

  select count(*) into recent_count
  from public.auth_attempts
  where ip = p_ip
    and created_at >= now() - make_interval(secs => p_window_ms / 1000.0);

  if recent_count >= p_limit then
    return false;
  end if;

  insert into public.auth_attempts (ip) values (p_ip);
  return true;
end;
$$;
