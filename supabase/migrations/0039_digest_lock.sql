-- F8a (features backlog): weekly digest. Same single-flight pattern as
-- cron_lock (migration for /api/cron/tick) — an atomic conditional UPDATE
-- row lock, self-healing if a previous invocation crashed without
-- releasing. last_sent_date additionally guards against sending the
-- digest twice in the same week if the endpoint is hit more than once
-- around the Monday-morning window (external cron + the GitHub Actions
-- backup both firing, say).
create table public.digest_lock (
  id int primary key,
  locked_until timestamptz,
  last_sent_date date
);

insert into public.digest_lock (id, locked_until, last_sent_date) values (1, null, null);

alter table public.digest_lock enable row level security;
-- No policies: only the service role (which bypasses RLS) ever touches this.
