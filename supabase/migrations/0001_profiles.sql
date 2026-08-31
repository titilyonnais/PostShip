-- profiles: 1-1 with auth.users (see docs/DATA_MODEL.md)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  plan text not null default 'free' check (plan in ('free', 'solo', 'team')),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  stripe_subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
