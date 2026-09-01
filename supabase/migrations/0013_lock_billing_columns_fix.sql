-- 0012 tried to block self-service plan/token upgrades with a column-level
-- REVOKE, but that doesn't work in Postgres: Supabase's default schema
-- setup already does `grant all on all tables in schema public to
-- authenticated`, a *table-level* grant, and column-level REVOKE cannot
-- narrow a table-level GRANT that's still in effect — the two are tracked
-- independently, and the broader one wins. Verified live: the exact
-- `update profiles set plan = 'team', token_balance = 999999 where id =
-- auth.uid()` attack still succeeded after 0012.
--
-- The correct pattern is the reverse: revoke the table-level privilege
-- entirely, then grant it back only on the columns `authenticated` is
-- actually allowed to write. Every other write path in the app (Stripe
-- webhook, spend_tokens() RPC, the onboarding Stripe customer-id write)
-- already goes through the service role, which is unaffected by any of
-- this — service_role isn't a member of authenticated.
revoke insert, update on public.profiles from authenticated;

grant insert (
  id, email, display_name, username, avatar_seed,
  full_name, company_name, phone, team_size,
  billing_address, email_alerts_enabled, locale
) on public.profiles to authenticated;

grant update (
  email, display_name, username, avatar_seed,
  full_name, company_name, phone, team_size,
  billing_address, email_alerts_enabled, locale
) on public.profiles to authenticated;
