-- Client-side signals, collected only from visitors who accepted the
-- measurement cookie. Everything already recorded arrives in the request
-- headers and needs no consent; these do not exist server-side and are
-- therefore the part the banner actually asks about.
--
-- Screen and viewport separate a phone held in one hand from a desktop
-- with a browser window a third of the display; the pixel ratio separates
-- a retina display from a scaled one; the timezone is the visitor's own
-- rather than the one the IP suggests, which is the single most useful
-- cross-check against a proxy. Engagement is how long the page was
-- actually looked at, which is the only honest measure of whether a page
-- served its purpose.
alter table public.visits
  add column if not exists screen_w integer,
  add column if not exists screen_h integer,
  add column if not exists viewport_w integer,
  add column if not exists viewport_h integer,
  add column if not exists pixel_ratio real,
  add column if not exists client_timezone text,
  add column if not exists connection_type text,
  add column if not exists engagement_ms integer,
  add column if not exists consented boolean not null default false;

-- Filled in a second write once the visitor leaves the page, keyed by the
-- id the first write returned.
create or replace function public.record_visit_client(
  p_visit_id bigint,
  p_screen_w integer,
  p_screen_h integer,
  p_viewport_w integer,
  p_viewport_h integer,
  p_pixel_ratio real,
  p_timezone text,
  p_connection text,
  p_engagement_ms integer
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.visits set
    screen_w = p_screen_w,
    screen_h = p_screen_h,
    viewport_w = p_viewport_w,
    viewport_h = p_viewport_h,
    pixel_ratio = p_pixel_ratio,
    client_timezone = p_timezone,
    connection_type = p_connection,
    -- Kept only if it looks like a real reading: a tab left open for a
    -- week is not four days of engagement.
    engagement_ms = least(greatest(coalesce(p_engagement_ms, 0), 0), 1800000),
    consented = true
  where id = p_visit_id;
$$;

revoke all on function public.record_visit_client(
  bigint, integer, integer, integer, integer, real, text, text, integer
) from public, anon, authenticated;
grant execute on function public.record_visit_client(
  bigint, integer, integer, integer, integer, real, text, text, integer
) to service_role;

-- record_visit now hands back the row id so the client write can find it.
drop function if exists public.record_visit(
  text, text, text, uuid, text, text, text, text, text, text,
  double precision, double precision, text, text, text, text, boolean
);

create or replace function public.record_visit(
  p_ip text, p_path text, p_method text, p_user_id uuid, p_user_agent text,
  p_referer text, p_accept_language text, p_country text, p_region text,
  p_city text, p_latitude double precision, p_longitude double precision,
  p_timezone text, p_device text, p_browser text, p_os text, p_is_bot boolean
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  insert into public.visits (
    ip, path, method, user_id, user_agent, referer, accept_language,
    country, region, city, latitude, longitude, timezone,
    device, browser, os, is_bot
  ) values (
    p_ip, p_path, p_method, p_user_id, p_user_agent, p_referer, p_accept_language,
    p_country, p_region, p_city, p_latitude, p_longitude, p_timezone,
    p_device, p_browser, p_os, coalesce(p_is_bot, false)
  ) returning id into v_id;

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
      last_seen_at = now(), hits = vi.hits + 1;

    update public.visitor_ips set
      distinct_users = (select count(*) from public.visitor_identities where ip = p_ip)
    where ip = p_ip;
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_visit(
  text, text, text, uuid, text, text, text, text, text, text,
  double precision, double precision, text, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.record_visit(
  text, text, text, uuid, text, text, text, text, text, text,
  double precision, double precision, text, text, text, text, boolean
) to service_role;
