-- Single-flight guard for /api/cron/tick. check_jobs is a log, not a queue:
-- rows are inserted and run in the same request with no claim/lease, so two
-- overlapping invocations (a slow tick still running when the next one
-- fires, or a manual trigger racing the cron) could both see the same
-- "due" projects and double-run checks — duplicate alerts, double token
-- spend on an in-flight site scan.
--
-- A session-level advisory lock (pg_advisory_lock) doesn't reliably survive
-- across separate PostgREST calls under connection pooling, so this uses a
-- plain row with an atomic conditional UPDATE instead — self-healing if a
-- previous invocation crashed without releasing, once locked_until passes.
create table public.cron_lock (
  id int primary key,
  locked_until timestamptz
);

insert into public.cron_lock (id, locked_until) values (1, null);

alter table public.cron_lock enable row level security;
-- No policies: only the service role (which bypasses RLS) ever touches this.
