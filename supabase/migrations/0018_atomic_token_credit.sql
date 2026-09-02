-- creditTokenPurchase() (src/lib/token-purchases.ts) used to read
-- token_balance then write it back — two Stripe webhook deliveries for the
-- same user landing close together (two different purchases, not a retried
-- duplicate — that part is already covered by the token_purchases unique
-- constraint) could both read the same stale balance and the second write
-- would clobber the first credit. Same "atomic in SQL, not in app code"
-- fix as spend_tokens() (0008) for the symmetric increment case.
create or replace function public.increment_token_balance(p_user_id uuid, p_amount int)
returns int
language plpgsql
as $$
declare
  new_balance int;
begin
  update public.profiles
  set token_balance = token_balance + p_amount
  where id = p_user_id
  returning token_balance into new_balance;

  return new_balance;
end;
$$;
