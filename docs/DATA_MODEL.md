# PostShip — Data model

All tables in `public`. RLS enabled. EU Supabase.

```sql
-- profiles: 1-1 with auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  plan text not null default 'free' check (plan in ('free', 'solo', 'team')),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  stripe_subscription_status text,
  -- Onboarding fields (0006_profile_onboarding.sql), collected at
  -- /onboarding before first /app access. full_name gates that redirect.
  full_name text,
  company_name text,
  phone text,
  team_size text check (team_size in ('solo', '2-5', '6-20', '20+')),
  billing_address jsonb,
  -- 0007_notification_prefs.sql
  email_alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table public.check_runs (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.check_targets (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null check (outcome in ('pass', 'fail', 'error')),
  http_status int,
  ttfb_ms int,
  fingerprint text,
  details jsonb not null default '{}'::jsonb
);

create index check_runs_project_started_idx on public.check_runs (project_id, started_at desc);
create index check_runs_target_started_idx on public.check_runs (target_id, started_at desc);

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  target_id uuid references public.check_targets (id) on delete set null,
  kind text not null check (kind in ('fail', 'recovered')),
  fingerprint text not null,
  channel text not null check (channel in ('email', 'discord')),
  sent_at timestamptz not null default now()
);

create index alert_events_dedup_idx
  on public.alert_events (project_id, fingerprint, channel, sent_at desc);

-- Vercel Cron job queue (see ARCHITECTURE.md — Inngest was not chosen)
create table public.check_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  reason text not null check (reason in ('cron', 'deploy', 'manual')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text
);
```

## RLS (sketch)

```sql
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.check_targets enable row level security;
alter table public.check_runs enable row level security;
alter table public.alert_events enable row level security;
alter table public.check_jobs enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

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

-- same exists() pattern for check_runs, alert_events, check_jobs
```

`plan` and Stripe IDs must only change via service role in the webhook handler, not from the user client. Add a separate policy or use service role for those columns.

## details jsonb examples

Fail HTTP:

```json
{
  "url": "https://app.example.com/checkout",
  "error": null,
  "redirects": 1,
  "bodyExcerpt": "Application error",
  "missing": []
}
```

Fail OG:

```json
{
  "ogTitle": "Acme",
  "ogImage": "https://cdn.example.com/og.png",
  "ogImageStatus": 404,
  "missing": ["og:image reachable"]
}
```
