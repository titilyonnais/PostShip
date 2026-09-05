-- The console runs on a single factor by decision of the operator, so the
-- TOTP columns are dropped rather than left populated and unread: a stored
-- secret that nothing verifies is security theatre, and keeping a live
-- shared secret in a table for a check that no longer happens is strictly
-- worse than not having it.
--
-- Recoverable from git if the second factor is ever restored: this drops
-- state, not the ability to add it back.
alter table public.admin_accounts
  drop column if exists totp_secret,
  drop column if exists totp_enrolled_at,
  drop column if exists totp_last_step,
  drop column if exists pending_totp_secret;
