-- Table sizes for the console's Supabase page. pg_total_relation_size is
-- not reachable through PostgREST, and guessing at row counts from
-- count(*) tells you nothing about disk — which is the number that
-- eventually costs money.
--
-- Same lockdown as the other admin_* functions: SECURITY DEFINER with a
-- pinned search_path, execute revoked from anon and authenticated.
create or replace function public.admin_table_sizes()
returns table (table_name text, total_bytes bigint, row_estimate bigint)
language sql
security definer
set search_path = public, pg_catalog, pg_temp
stable
as $$
  select
    c.relname::text,
    pg_total_relation_size(c.oid)::bigint,
    greatest(c.reltuples, 0)::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc
  limit 15;
$$;

revoke all on function public.admin_table_sizes() from public, anon, authenticated;
grant execute on function public.admin_table_sizes() to service_role;
