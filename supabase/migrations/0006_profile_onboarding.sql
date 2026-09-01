-- Onboarding fields collected after first login, before /app access.
-- full_name gates the /onboarding redirect in src/lib/db/middleware.ts.
alter table public.profiles
  add column full_name text,
  add column company_name text,
  add column phone text,
  add column team_size text check (team_size in ('solo', '2-5', '6-20', '20+')),
  add column billing_address jsonb;
