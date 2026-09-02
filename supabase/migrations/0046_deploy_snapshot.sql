-- D7 (drill-nav backlog): per-target outcome snapshot for a deploy, so the
-- Deploys page can show "Cassé depuis" / "Rétabli depuis" (src/lib/deploy-
-- diff.ts) without re-querying check_runs. No secrets here — deploy_events
-- already has no column-level grant lockdown (migration 0040), so no
-- extra grant is needed for this column.
alter table public.deploy_events
  add column if not exists snapshot jsonb not null default '[]'::jsonb;
