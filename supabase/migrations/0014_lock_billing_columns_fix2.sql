-- 0013's UPDATE grant deliberately left out `id` (it should never change
-- value) — but PostgREST's upsert() compiles to `insert ... on conflict (id)
-- do update set id = excluded.id, ...` for every column in the payload,
-- `id` included, and Postgres checks UPDATE privilege against the columns
-- listed in that SET clause syntactically, regardless of whether the value
-- actually changes. Verified live: upsert({id, email}) — exactly what
-- src/app/auth/callback/route.ts and src/app/onboarding/actions.ts do on
-- every login/onboarding — failed with "permission denied for table
-- profiles" until `id` is grantable too.
grant update (id) on public.profiles to authenticated;
