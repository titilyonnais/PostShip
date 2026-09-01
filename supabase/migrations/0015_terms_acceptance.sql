-- Traceable record that a user actually agreed to the CGU/politique de
-- confidentialité at signup, not just implied acceptance from creating an
-- account (see /terms — "toute création de compte implique l'acceptation").
alter table public.profiles
  add column terms_accepted_at timestamptz;

grant insert (terms_accepted_at) on public.profiles to authenticated;
grant update (terms_accepted_at) on public.profiles to authenticated;
