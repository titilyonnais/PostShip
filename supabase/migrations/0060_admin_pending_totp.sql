-- A TOTP rotation must never be able to lock the operator out halfway
-- through: the new secret is parked here and only becomes totp_secret once
-- a code minted by the new authenticator has been proved.
alter table public.admin_accounts
  add column if not exists pending_totp_secret text;
