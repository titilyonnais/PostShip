-- 0022's "read own memberships" policy on project_members subqueries
-- projects, and projects' own "select/update own or member" policies
-- subquery project_members right back — Postgres re-evaluates each
-- table's RLS when a policy references it, so this pair is mutually
-- recursive: `infinite recursion detected in policy for relation
-- "projects"`. Verified live: any select/insert touching either table
-- errored with 42P17 after 0022.
--
-- Standard fix: a security definer function runs as its owner (the
-- migration role, which bypasses RLS), so calling it from a policy checks
-- ownership without re-triggering that table's own RLS.
create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.user_id = auth.uid()
  );
$$;

drop policy "read own memberships" on public.project_members;

create policy "read own memberships" on public.project_members
  for select using (
    user_id = auth.uid()
    or public.is_project_owner(project_id)
  );
