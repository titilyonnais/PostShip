-- D8 (drill-nav backlog): signed outbound webhook. Same lockdown as
-- Discord (migrations 0017/0026) — outbound_webhook_url is arbitrary user
-- input fetched directly by src/lib/outbound-webhook.ts (a stored SSRF
-- target if it leaked into the authenticated grant), and
-- outbound_webhook_secret is a genuine secret the receiving endpoint
-- verifies HMAC signatures against, shown to the owner only once at
-- generation time. Both stay service-role-only; the generated
-- `_configured` flag lets the Intégrations card show "configured" without
-- ever reading either column back.
alter table public.projects
  add column if not exists outbound_webhook_url text,
  add column if not exists outbound_webhook_secret text,
  add column if not exists outbound_webhook_configured boolean
    generated always as (outbound_webhook_url is not null) stored;

grant select (outbound_webhook_configured) on public.projects to authenticated;
