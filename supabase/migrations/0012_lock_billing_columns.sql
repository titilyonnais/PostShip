-- The "own profile" policy from 0001 (`for all using (id = auth.uid())`) is
-- row-scoped only, not column-scoped: any authenticated user could already
-- do `update profiles set plan = 'team', token_balance = 999999 where id =
-- auth.uid()` straight through PostgREST with the anon key + their own JWT,
-- bypassing Stripe entirely. Entitlements are read from these columns
-- everywhere (src/lib/entitlements.ts, the cron runner, settings pages), so
-- this was a full self-service upgrade.
--
-- Every legitimate write to these columns already goes through the service
-- role (Stripe webhook, spend_tokens() RPC, and now the onboarding Stripe
-- customer-id write — see src/app/onboarding/actions.ts) — normal app code
-- never needs `authenticated` to touch them, so revoke it outright rather
-- than trying to encode "only if service_role" as an RLS check.
revoke insert (plan, token_balance, stripe_customer_id, stripe_subscription_id, stripe_subscription_status)
  on public.profiles from authenticated;

revoke update (plan, token_balance, stripe_customer_id, stripe_subscription_id, stripe_subscription_status)
  on public.profiles from authenticated;
