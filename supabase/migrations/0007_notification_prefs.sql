-- Account-level toggle for email alerts, surfaced in /app/account (Notifications tab).
-- Read in src/lib/runner.ts to gate ownerEmail before dispatchAlerts.
alter table public.profiles
  add column email_alerts_enabled boolean not null default true;
