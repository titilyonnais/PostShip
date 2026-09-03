-- Feedback fix: profile photo upload. Public bucket (avatars are already
-- rendered from public DiceBear URLs everywhere — same trust level, no
-- private data), one file per user at a fixed key so re-uploading just
-- overwrites it — no orphaned old files to clean up.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- A user may only write to their own path: avatars/<their-uid>/*.
create policy "avatar owner can upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar owner can update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar owner can delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public bucket — anyone can read (same as a DiceBear URL today, and
-- required for the img tags that render other users' avatars, e.g. a
-- collaborator's photo on a shared project).
create policy "avatars are publicly readable" on storage.objects
  for select to public
  using (bucket_id = 'avatars');
