-- Real user identity: a unique handle and a fun generated avatar (DiceBear
-- "bottts" seed — matches the existing PostShipBot user-agent theme).
alter table public.profiles
  add column username text unique,
  add column avatar_seed text;

update public.profiles set avatar_seed = id::text where avatar_seed is null;

alter table public.profiles alter column avatar_seed set not null;
alter table public.profiles alter column avatar_seed set default gen_random_uuid()::text;

create index profiles_username_idx on public.profiles (lower(username));
