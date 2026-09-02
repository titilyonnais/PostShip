-- src/app/api/demo/check/route.ts used to SELECT count(*) then INSERT as
-- two separate round-trips — two concurrent requests from the same IP
-- could both read a count under the limit and both get through. An
-- advisory lock keyed by the IP serializes concurrent calls for the same
-- IP for the lifetime of the PostgREST call's transaction, so the
-- count-then-insert becomes effectively atomic without needing a unique
-- constraint on a time bucket.
create or replace function public.demo_check_allow(
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
  from public.demo_checks
  where ip = p_ip
    and created_at >= now() - make_interval(secs => p_window_ms / 1000.0);

  if recent_count >= p_limit then
    return false;
  end if;

  insert into public.demo_checks (ip) values (p_ip);
  return true;
end;
$$;
