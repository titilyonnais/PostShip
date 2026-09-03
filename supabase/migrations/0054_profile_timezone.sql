-- Feedback fix: every date shown in the app was rendered in the server's
-- own timezone via toLocaleString("fr-FR", ...) with no timeZone option —
-- wrong for anyone not on the server's clock. profiles.timezone holds an
-- IANA zone name (e.g. "Europe/Paris"); null means "not captured yet",
-- in which case the UI falls back to the browser's own zone and silently
-- records it once (see TimezoneCapture), and the account Profil tab lets
-- the user override it explicitly.
alter table public.profiles
  add column if not exists timezone text;

grant insert (timezone), update (timezone) on public.profiles to authenticated;
