-- Replaces the two-step insert-then-increment-token_balance pattern
-- (0018's increment_token_balance() + a separate token_purchases insert
-- in application code) with one transactional RPC: the insert's unique
-- constraint on stripe_checkout_session_id (0008) makes idempotency and
-- the balance credit atomic together, instead of two round-trips that
-- could observe each other's partial state.
create or replace function public.credit_tokens(
  p_user_id uuid,
  p_session_id text,
  p_tokens int,
  p_amount_cents int
) returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tokens is null or p_tokens <= 0 or p_user_id is null or p_session_id is null then
    return 'invalid';
  end if;

  insert into public.token_purchases (user_id, stripe_checkout_session_id, tokens, amount_cents)
  values (p_user_id, p_session_id, p_tokens, p_amount_cents);

  update public.profiles
    set token_balance = token_balance + p_tokens
    where id = p_user_id;

  return 'credited';
exception
  when unique_violation then
    return 'duplicate';
end;
$$;

revoke execute on function public.credit_tokens(uuid, text, int, int) from public;
revoke execute on function public.credit_tokens(uuid, text, int, int) from authenticated, anon;
grant execute on function public.credit_tokens(uuid, text, int, int) to service_role;

-- Superseded by credit_tokens() above — its balance-update-only half is
-- now folded into the same transaction as the idempotent insert.
drop function if exists public.increment_token_balance(uuid, int);
