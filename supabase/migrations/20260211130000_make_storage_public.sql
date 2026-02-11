-- Make chat-media bucket public so getPublicUrl() works.
-- RLS policies on storage.objects still control upload/delete access.
-- File paths contain UUIDs and timestamps, making them unguessable.

UPDATE storage.buckets
SET public = true
WHERE id = 'chat-media';
