-- Kardia private task attachment storage.
-- Run after 003_workspace_collaboration.sql. Safe to run repeatedly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  10485760,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/zip'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users upload task attachments" on storage.objects;
create policy "authenticated users upload task attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'task-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users read task attachments" on storage.objects;
create policy "authenticated users read task attachments"
on storage.objects for select to authenticated
using (bucket_id = 'task-attachments');

drop policy if exists "users delete their task attachments" on storage.objects;
create policy "users delete their task attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'task-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
