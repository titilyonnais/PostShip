-- Risk signals for the users list. Computing them per row in TypeScript
-- would mean one Stripe round-trip per user, which is why the list had no
-- risk column at all — this returns the two signals that live in our own
-- database, cheaply, for every user at once.
--
-- The Stripe-derived signals (disputes, failed invoices, past due) stay on
-- the detail page where a single customer is being looked at. The list
-- flags who is worth opening; it does not pretend to the full score.
create or replace function public.admin_user_risk_signals()
returns table (
  user_id uuid,
  failed_logins_24h bigint,
  accounts_sharing_customer bigint,
  tokens_purchased boolean,
  project_count bigint
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    p.id,
    (
      select count(*) from public.ops_events e
      where e.source = 'auth' and e.actor_user_id = p.id
        and e.action like '%failed%' and e.at > now() - interval '24 hours'
    ),
    case
      when p.stripe_customer_id is null then 1
      else (
        select count(*) from public.profiles q
        where q.stripe_customer_id = p.stripe_customer_id
      )
    end,
    coalesce(p.token_balance, 0) > 0
      or exists (select 1 from public.token_purchases t where t.user_id = p.id),
    (select count(*) from public.projects pr where pr.user_id = p.id)
  from public.profiles p;
$$;

revoke all on function public.admin_user_risk_signals() from public, anon, authenticated;
grant execute on function public.admin_user_risk_signals() to service_role;
