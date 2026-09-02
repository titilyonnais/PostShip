-- terms_accepted_at (0015) only records *that* someone consented, not
-- *what* they consented to — if /terms or /privacy wording changes later,
-- the timestamp alone can't tell you whether a user agreed to the current
-- text or an old one. These two columns pin the version string in effect
-- at consent time (see src/lib/legal.ts).
alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists privacy_version text;

-- Same pattern as 0015: the table-level grant was revoked in 0013, so new
-- columns need an explicit re-grant or `authenticated` can't write them at
-- all, even via the user's own session (e.g. from /accept-terms).
grant insert (terms_version, privacy_version) on public.profiles to authenticated;
grant update (terms_version, privacy_version) on public.profiles to authenticated;
