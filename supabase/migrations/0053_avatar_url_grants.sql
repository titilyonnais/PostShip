-- 0051/0052 fix: profiles.avatar_url is written by the user's own session
-- (auth callback's upsert on first OAuth login, and the profile photo
-- upload action) — public.profiles' RLS "own profile" policy allows it,
-- but this table also uses column-level GRANTs as a second, stricter
-- allowlist for `authenticated` (see avatar_seed/display_name/etc. for
-- the existing pattern) that a plain `alter table add column` doesn't
-- extend on its own. Without this, both writes silently no-op.
grant insert (avatar_url), update (avatar_url) on public.profiles to authenticated;
