-- Rate-limit log for the public "try one URL" demo (not in the original
-- Phase 0 schema — added to back the IP rate limit required by
-- docs/ARCHITECTURE.md and PROMPT-DEPART-CLAUDE-CODE.md, Slice 8).
create table public.demo_checks (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);

create index demo_checks_ip_created_idx on public.demo_checks (ip, created_at desc);

alter table public.demo_checks enable row level security;
-- No policies: this table has no legitimate client-side access path.
-- Only the service role (which bypasses RLS) may read or write it.
