-- Feedback fix: signing in with GitHub/Google never surfaced the
-- provider's own name/photo — every OAuth user fell back to the
-- DiceBear-generated avatar and their raw email everywhere in the UI.
-- profiles.avatar_url holds the real provider photo when one was given
-- at first sign-in (see src/app/auth/callback/route.ts); avatar_seed and
-- the DiceBear helper stay as the fallback for magic-link/password users
-- who never had one.
alter table public.profiles
  add column if not exists avatar_url text;
