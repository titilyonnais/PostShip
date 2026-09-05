-- The unified operational journal.
--
-- admin_audit_log answers "what did the operator do", which is a narrow
-- slice: it says nothing about a failed customer login, a Stripe dispute,
-- or a runner that started erroring. Those are the events you actually go
-- looking for when something is wrong, and they had nowhere to live.
--
-- admin_audit_log stays as it is. It is the tamper-evidence trail for
-- privileged actions specifically, and collapsing it into a general log
-- would bury it. Console actions are written to both.
--
-- Numbered 0062, not 0051 as the brief suggested: 0051 through 0061 are
-- taken, and reusing a number would make the runner replay the wrong file.

create table if not exists public.ops_events (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  source text not null
    check (source in ('console', 'auth', 'stripe', 'billing', 'runner', 'scan', 'admin_alert')),
  severity text not null default 'info'
    check (severity in ('info', 'warn', 'error', 'fraud')),
  action text not null,
  actor_admin_id uuid null references public.admin_accounts(id) on delete set null,
  actor_user_id uuid null,
  -- Free-form on purpose: an email, a Stripe customer id, a project id.
  -- A foreign key here would reject the very events worth recording — an
  -- attempt against an account that does not exist, a customer whose
  -- profile was deleted.
  target text null,
  ip text null,
  user_agent text null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists ops_events_at_idx on public.ops_events (at desc);
create index if not exists ops_events_source_at_idx on public.ops_events (source, at desc);
create index if not exists ops_events_user_at_idx on public.ops_events (actor_user_id, at desc);
create index if not exists ops_events_severity_at_idx on public.ops_events (severity, at desc);

-- Same lockdown as admin_audit_log: RLS on with zero policies, so every
-- role except the service role sees nothing, and the table-level grants
-- Supabase hands to anon/authenticated by default are revoked outright —
-- a policy alone would not have been enough (see migration 0026).
alter table public.ops_events enable row level security;
revoke all on public.ops_events from anon, authenticated;
