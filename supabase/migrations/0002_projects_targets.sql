-- projects + check_targets (see docs/DATA_MODEL.md)
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  base_url text not null,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  discord_webhook_url text,
  vercel_hook_secret text,
  last_checked_at timestamptz,
  last_status text check (last_status in ('pass', 'fail', 'error', 'pending')),
  created_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);

create table public.check_targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  kind text not null default 'http'
    check (kind in ('http', 'sitemap', 'og', 'ssl', 'stripe_health')),
  expect_status int not null default 200,
  expect_contains text,
  expect_not_contains text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index check_targets_project_id_idx on public.check_targets (project_id);

alter table public.projects enable row level security;
alter table public.check_targets enable row level security;

create policy "own projects" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own targets" on public.check_targets
  for all using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.projects p
            where p.id = project_id and p.user_id = auth.uid())
  );
