-- The console was showing two different numbers for the same thing: the
-- customer file computed the full score (Stripe included), while the list
-- computed a cheaper one from database signals only. 14 on one page and 4
-- on the other, for the same account, with nothing saying why.
--
-- The fix is not to compute the expensive score per row — that is one
-- Stripe round trip per line — but to store the one the nightly sweep
-- already computes and read it everywhere. The list then shows a real
-- score with the date it was taken, and the file shows a live one; when
-- they differ, the timestamp explains it.
create table if not exists public.fraud_scores (
  user_id uuid primary key,
  score integer not null,
  band text not null,
  -- The features that produced it, so the list can explain a number
  -- without recomputing anything.
  features jsonb not null default '[]'::jsonb,
  scored_at timestamptz not null default now()
);

create index if not exists fraud_scores_score_idx on public.fraud_scores (score desc);

alter table public.fraud_scores enable row level security;
revoke all on public.fraud_scores from anon, authenticated;
