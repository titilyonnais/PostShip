-- G3: optional project-level override for the Stripe success-page URL a
-- stripe_health target checks. Same access model as base_url (migration
-- 0017): direct owner UPDATE via RLS, with the actual validation done by
-- the server action (assertRegisterableHttpsUrl) before the write — the
-- real SSRF protection is enforced at fetch time by guardedFetch
-- regardless of what's stored here.
alter table public.projects
  add column if not exists stripe_success_url text;

grant select (stripe_success_url) on public.projects to authenticated;
grant update (stripe_success_url) on public.projects to authenticated;
