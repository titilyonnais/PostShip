-- An IP is not a bot; its traffic is. The old boolean was set on the
-- first visit that created the row and never revisited, so one crawler
-- hit branded an address permanently — including a phone behind a carrier
-- NAT, which is exactly what happened.
--
-- These count instead, and the console derives a label from the ratio.
alter table public.visitor_ips
  add column if not exists bot_hits bigint not null default 0;

-- Recount the existing rows from the raw stream so the new column starts
-- truthful rather than at zero.
update public.visitor_ips v
set bot_hits = coalesce((
  select count(*) from public.visits s where s.ip = v.ip and s.is_bot
), 0);

create or replace function public.record_visit(
  p_ip text, p_path text, p_method text, p_user_id uuid, p_user_agent text,
  p_referer text, p_accept_language text, p_country text, p_region text,
  p_city text, p_latitude double precision, p_longitude double precision,
  p_timezone text, p_device text, p_browser text, p_os text, p_is_bot boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.visits (
    ip, path, method, user_id, user_agent, referer, accept_language,
    country, region, city, latitude, longitude, timezone,
    device, browser, os, is_bot
  ) values (
    p_ip, p_path, p_method, p_user_id, p_user_agent, p_referer, p_accept_language,
    p_country, p_region, p_city, p_latitude, p_longitude, p_timezone,
    p_device, p_browser, p_os, coalesce(p_is_bot, false)
  );

  insert into public.visitor_ips as v (
    ip, country, region, city, latitude, longitude, timezone, is_bot, bot_hits
  ) values (
    p_ip, p_country, p_region, p_city, p_latitude, p_longitude, p_timezone,
    coalesce(p_is_bot, false), case when p_is_bot then 1 else 0 end
  )
  on conflict (ip) do update set
    last_seen_at = now(),
    hits = v.hits + 1,
    bot_hits = v.bot_hits + case when p_is_bot then 1 else 0 end,
    -- Kept in sync with the ratio rather than frozen at first sight.
    is_bot = (v.bot_hits + case when p_is_bot then 1 else 0 end) >= (v.hits + 1) * 0.9,
    country = coalesce(excluded.country, v.country),
    region = coalesce(excluded.region, v.region),
    city = coalesce(excluded.city, v.city),
    latitude = coalesce(excluded.latitude, v.latitude),
    longitude = coalesce(excluded.longitude, v.longitude),
    timezone = coalesce(excluded.timezone, v.timezone);

  if p_user_id is not null then
    insert into public.visitor_identities as vi (ip, user_id)
    values (p_ip, p_user_id)
    on conflict (ip, user_id) do update set
      last_seen_at = now(),
      hits = vi.hits + 1;

    update public.visitor_ips set
      distinct_users = (select count(*) from public.visitor_identities where ip = p_ip)
    where ip = p_ip;
  end if;
end;
$$;
