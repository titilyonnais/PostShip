-- Pay-per-use tokens, independent of the subscription plan (docs/DATA_MODEL.md
-- note: "toutes les données du client" work extended this — see chat log).
alter table public.profiles
  add column token_balance integer not null default 0 check (token_balance >= 0);

-- Idempotency + audit trail for one-time Stripe token-pack purchases,
-- credited from src/app/api/stripe/webhook/route.ts on checkout.session.completed
-- (mode: "payment", metadata.kind = "tokens"). The unique session id means a
-- retried webhook delivery can't double-credit a balance.
create table public.token_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  tokens integer not null,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);

alter table public.token_purchases enable row level security;

create policy "own token purchases" on public.token_purchases
  for select using (user_id = auth.uid());

-- One-off "scan the whole site" audits: a point-in-time report, not a set of
-- continuously-monitored check_targets, so it never touches plan URL quotas.
create table public.site_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  seed_url text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  pages_scanned int not null default 0,
  pages_ok int not null default 0,
  pages_failed int not null default 0,
  tokens_spent int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index site_scans_status_idx on public.site_scans (status, created_at);
create index site_scans_project_idx on public.site_scans (project_id, created_at desc);

alter table public.site_scans enable row level security;

create policy "own site scans" on public.site_scans
  for select using (user_id = auth.uid());

create table public.site_scan_pages (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.site_scans (id) on delete cascade,
  url text not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  outcome text check (outcome in ('pass', 'fail', 'error')),
  http_status int,
  ttfb_ms int,
  error text,
  created_at timestamptz not null default now()
);

create index site_scan_pages_scan_idx on public.site_scan_pages (scan_id, status);

alter table public.site_scan_pages enable row level security;

create policy "own site scan pages" on public.site_scan_pages
  for select using (
    exists (
      select 1 from public.site_scans s
      where s.id = scan_id and s.user_id = auth.uid()
    )
  );

-- Atomic, race-safe spend used by src/lib/scan.ts when a batch of pages
-- finishes processing — clamps at 0 instead of allowing a negative balance
-- if two scans somehow raced past an application-level balance check.
create or replace function public.spend_tokens(p_user_id uuid, p_amount int)
returns int
language plpgsql
as $$
declare
  new_balance int;
begin
  update public.profiles
  set token_balance = greatest(token_balance - p_amount, 0)
  where id = p_user_id
  returning token_balance into new_balance;

  return new_balance;
end;
$$;
