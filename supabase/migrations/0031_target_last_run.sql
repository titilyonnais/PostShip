-- Denormalized onto check_targets so "what was this target's last
-- outcome" (used to detect fail->pass recoveries and to recompute a
-- project's overall badge) never needs a `limit 500` scan of check_runs
-- sorted by started_at desc, deduped in application code — check_runs is
-- the append-only history, these three columns are just "the latest run,
-- cached on the row it belongs to." Kept in sync by runSingleTarget
-- (src/lib/runner.ts) every time it inserts a new check_runs row.
alter table public.check_targets
  add column if not exists last_outcome text check (last_outcome in ('pass', 'fail', 'error')),
  add column if not exists last_fingerprint text,
  add column if not exists last_started_at timestamptz;
