-- Visit telemetry, for abuse detection and for the IP intelligence the
-- console needs to answer "is this the same person".
--
-- Two tables on purpose. `visits` is the raw event stream, which is
-- high-volume and short-lived; `visitor_ips` is the rolled-up profile per
-- address, which is what an operator actually reads and what the fraud
-- scoring joins against. Querying "how many times has this IP appeared"
-- against the raw stream would scan the whole table every time.
--
-- Legal basis, stated because it constrains the design rather than
-- decorating it: an IP address is personal data under the GDPR, and this
-- is collected under legitimate interest for security and fraud
-- prevention (Recital 49 names exactly that). That basis does not extend
-- to marketing analytics, so nothing here feeds one: no cross-site
-- identifier, no canvas or WebGL fingerprint, no cookie. Retention is
-- bounded at 90 days by the nightly purge — an indefinite log of who
-- visited from where is not defensible under any basis.

create table if not exists public.visits (
  id bigserial primary key,
  at timestamptz not null default now(),
  ip text not null,
  path text not null,
  method text not null default 'GET',
  -- Null for anonymous traffic, set once a session is identified.
  user_id uuid null,
  user_agent text null,
  referer text null,
  accept_language text null,
  -- Vercel's edge resolves these from the IP at no cost and with no
  -- third-party processor, which is why the geo columns exist at all.
  country text null,
  region text null,
  city text null,
  latitude double precision null,
  longitude double precision null,
  timezone text null,
  -- Derived at write time so the console never re-parses a user agent.
  device text null,
  browser text null,
  os text null,
  is_bot boolean not null default false
);

create index if not exists visits_at_idx on public.visits (at desc);
create index if not exists visits_ip_at_idx on public.visits (ip, at desc);
create index if not exists visits_user_at_idx on public.visits (user_id, at desc);
create index if not exists visits_country_idx on public.visits (country);

create table if not exists public.visitor_ips (
  ip text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  hits bigint not null default 1,
  country text null,
  region text null,
  city text null,
  latitude double precision null,
  longitude double precision null,
  timezone text null,
  -- How many distinct accounts have been seen from this address. More
  -- than a couple is the single strongest linkage signal available
  -- without third-party data.
  distinct_users integer not null default 0,
  distinct_user_agents integer not null default 0,
  is_bot boolean not null default false,
  -- Set by hand from the console when an address is known-good (an
  -- office, a VPN the operator uses) so it stops scoring.
  trusted boolean not null default false
);

create index if not exists visitor_ips_last_seen_idx on public.visitor_ips (last_seen_at desc);
create index if not exists visitor_ips_hits_idx on public.visitor_ips (hits desc);

-- Which accounts have been seen from which address. This is the join the
-- fraud engine needs and the one thing neither table above can answer on
-- its own.
create table if not exists public.visitor_identities (
  ip text not null,
  user_id uuid not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  hits bigint not null default 1,
  primary key (ip, user_id)
);

create index if not exists visitor_identities_user_idx on public.visitor_identities (user_id);

-- Same lockdown as every other operational table: RLS on with no policy,
-- and the default grants revoked. Nothing here is ever read from a
-- browser.
alter table public.visits enable row level security;
alter table public.visitor_ips enable row level security;
alter table public.visitor_identities enable row level security;

revoke all on public.visits from anon, authenticated;
revoke all on public.visitor_ips from anon, authenticated;
revoke all on public.visitor_identities from anon, authenticated;
revoke all on sequence public.visits_id_seq from anon, authenticated;

-- One statement per visit rather than a read-then-write from the app:
-- concurrent requests from the same address would otherwise race and
-- lose hits.
create or replace function public.record_visit(
  p_ip text,
  p_path text,
  p_method text,
  p_user_id uuid,
  p_user_agent text,
  p_referer text,
  p_accept_language text,
  p_country text,
  p_region text,
  p_city text,
  p_latitude double precision,
  p_longitude double precision,
  p_timezone text,
  p_device text,
  p_browser text,
  p_os text,
  p_is_bot boolean
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
    ip, country, region, city, latitude, longitude, timezone, is_bot
  ) values (
    p_ip, p_country, p_region, p_city, p_latitude, p_longitude, p_timezone,
    coalesce(p_is_bot, false)
  )
  on conflict (ip) do update set
    last_seen_at = now(),
    hits = v.hits + 1,
    -- Geo is refreshed rather than frozen: an address can be reassigned,
    -- and the newest resolution is the one worth showing.
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
      distinct_users = (
        select count(*) from public.visitor_identities where ip = p_ip
      )
    where ip = p_ip;
  end if;
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
