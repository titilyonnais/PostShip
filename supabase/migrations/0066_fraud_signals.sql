-- Signal gathering for the fraud engine. These are joins across visits,
-- visitor_ips, visitor_identities and ops_events that PostgREST cannot
-- express — max accounts on any one of this user's addresses, distinct
-- countries in a window, the fastest implied travel between consecutive
-- visits, and the account's habitual hour.
--
-- Doing them in SQL rather than in TypeScript is not a preference: the
-- alternative is pulling every visit row for a user into the app to
-- compute a maximum over it.
create or replace function public.fraud_signals(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with user_ips as (
    select ip from public.visitor_identities where user_id = p_user_id
  ),
  recent as (
    select at, country, latitude, longitude, user_agent, is_bot
    from public.visits
    where user_id = p_user_id and at > now() - interval '30 days'
    order by at
  ),
  -- Consecutive visits with coordinates, so an implied speed can be
  -- computed between each pair. A null-island coordinate would produce a
  -- fake trip, hence the explicit exclusion.
  hops as (
    select
      at,
      latitude,
      longitude,
      lag(at) over (order by at) as prev_at,
      lag(latitude) over (order by at) as prev_lat,
      lag(longitude) over (order by at) as prev_lon
    from recent
    where latitude is not null and longitude is not null
      and not (latitude = 0 and longitude = 0)
  ),
  speeds as (
    select
      -- Great-circle distance in km, then divided by the elapsed hours.
      (
        6371 * 2 * asin(least(1, sqrt(
          power(sin(radians(latitude - prev_lat) / 2), 2) +
          cos(radians(prev_lat)) * cos(radians(latitude)) *
          power(sin(radians(longitude - prev_lon) / 2), 2)
        )))
      ) / greatest(extract(epoch from (at - prev_at)) / 3600.0, 0.0167) as kmh
    from hops
    where prev_at is not null
  ),
  -- The habitual hour, as a circular mean: averaging 23 and 1 linearly
  -- gives noon, which is the failure the periodic feature exists to avoid.
  habit as (
    select
      (degrees(atan2(
        avg(sin(radians(extract(hour from at) * 15))),
        avg(cos(radians(extract(hour from at) * 15)))
      )) / 15 + 24)::numeric % 24 as mean_hour
    from public.visits
    where user_id = p_user_id and at > now() - interval '90 days'
  ),
  latest as (
    select (extract(hour from at))::numeric as hour, country
    from recent order by at desc limit 1
  )
  select jsonb_build_object(
    'max_accounts_per_ip', coalesce((
      select max(vi.distinct_users) from public.visitor_ips vi
      where vi.ip in (select ip from user_ips) and not vi.trusted
    ), 0),
    'distinct_ips_30d', (select count(distinct ip) from public.visitor_identities where user_id = p_user_id),
    'signups_from_same_ip_30d', coalesce((
      select max(c) from (
        select count(distinct p.id) as c
        from public.profiles p
        join public.visitor_identities v on v.user_id = p.id
        where v.ip in (select ip from user_ips)
          and p.created_at > now() - interval '30 days'
        group by v.ip
      ) t
    ), 0),
    'distinct_countries_7d', (
      select count(distinct country) from public.visits
      where user_id = p_user_id and at > now() - interval '7 days' and country is not null
    ),
    'max_implied_speed_kmh', coalesce((select max(kmh) from speeds), 0),
    'distinct_user_agents_30d', (select count(distinct user_agent) from recent),
    'bot_session_seen', coalesce((select bool_or(is_bot) from recent), false),
    'visit_country', (select country from latest),
    'mean_hour', coalesce((select mean_hour from habit), 12),
    'latest_hour', coalesce((select hour from latest), 12),
    'failed_logins_24h', (
      select count(*) from public.ops_events
      where source = 'auth' and actor_user_id = p_user_id
        and action like '%failed%' and at > now() - interval '24 hours'
    )
  );
$$;

revoke all on function public.fraud_signals(uuid) from public, anon, authenticated;
grant execute on function public.fraud_signals(uuid) to service_role;
