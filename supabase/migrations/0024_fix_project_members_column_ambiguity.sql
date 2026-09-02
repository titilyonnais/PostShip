-- 0022's "select own or member projects" and "update own or member
-- projects" policies wrote `m.project_id = id` inside a subquery over
-- project_members — but project_members has its own `id` primary-key
-- column, so the unqualified `id` resolved to `project_members.id` (the
-- innermost scope), not `projects.id` as intended. The membership branch
-- silently never matched (`m.project_id = m.id` is never true), so
-- collaborators could never actually see or update a project — only
-- caught because the read/update "worked" without erroring (RLS
-- filtering to zero rows isn't an error) and the test checked for an
-- error instead of confirming the row actually changed.
drop policy "select own or member projects" on public.projects;

create policy "select own or member projects" on public.projects
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members m
      where m.project_id = projects.id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  );

drop policy "update own or member projects" on public.projects;

create policy "update own or member projects" on public.projects
  for update using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members m
      where m.project_id = projects.id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members m
      where m.project_id = projects.id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  );
