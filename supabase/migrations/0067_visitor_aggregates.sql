-- Breakdowns for the visitors page. Grouping the raw visit stream by
-- country and by path is exactly the shape PostgREST cannot express, and
-- doing it in the app would mean shipping every row to compute a count.
create or replace function public.visitor_aggregates(p_days integer default 30)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with window_visits as (
    select * from public.visits
    where at > now() - (greatest(1, least(coalesce(p_days, 30), 365)) || ' days')::interval
  )
  select jsonb_build_object(
    'by_country', coalesce((
      select jsonb_agg(t) from (
        select country, count(*) as hits
        from window_visits where country is not null
        group by country order by count(*) desc limit 30
      ) t
    ), '[]'::jsonb),
    'top_paths', coalesce((
      select jsonb_agg(t) from (
        select path, count(*) as hits
        from window_visits
        group by path order by count(*) desc limit 20
      ) t
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.visitor_aggregates(integer) from public, anon, authenticated;
grant execute on function public.visitor_aggregates(integer) to service_role;
