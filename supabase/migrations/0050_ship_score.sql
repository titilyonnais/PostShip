-- V7 (ia-moderne backlog): one number after each production deploy —
-- posted to the GitHub Check and shown on Aperçu (src/lib/ship-score.ts).
-- Nullable: cron/manual runs and deploys from before this feature never
-- had a score computed.
alter table public.deploy_events
  add column if not exists score int,
  -- The single "−N label" explanation line for the score (e.g. "−15
  -- carte OG") — Aperçu shows it under the big number instead of
  -- recomputing it from the snapshot, which doesn't carry enough detail
  -- (missing codes, ssl days remaining) to reproduce it.
  add column if not exists score_reason text;
