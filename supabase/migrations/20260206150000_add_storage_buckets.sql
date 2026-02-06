-- Zemichat v2 – Storage Buckets & RLS
-- Adds chat-media bucket for images, voice messages, videos, and documents.
-- Depends on: 20260205120000_add_rls_policies.sql

-- ============================================================
-- 1. CREATE STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  52428800,  -- 50MB max file size
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/webm',
    'audio/wav',
    'audio/aac',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
);

-- ============================================================
-- 2. STORAGE RLS POLICIES
-- ============================================================

-- 2.1 INSERT: Authenticated users can upload to their own folder
-- Path structure: {user_id}/{chat_id}/{timestamp}_{filename}
CREATE POLICY chat_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND auth_user_is_active()
    -- First folder segment must be the uploader's user ID
    AND (storage.foldername(name))[1] = auth.uid()::text
    -- Second folder segment must be a chat the user is a member of
    AND is_chat_member((storage.foldername(name))[2]::uuid)
  );

-- 2.2 SELECT: Three-tier access
-- a) Uploader can always see their own files
-- b) Chat members can see media in their chats
-- c) Owner can see media from Texter chats (transparency)
CREATE POLICY chat_media_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      -- Uploader can always see own files
      (storage.foldername(name))[1] = auth.uid()::text
      -- Chat member can see media from chats they're in
      OR (
        (storage.foldername(name))[2] IS NOT NULL
        AND is_chat_member((storage.foldername(name))[2]::uuid)
      )
      -- Owner oversight: can see media from chats with their Texters
      OR (
        auth_user_role() = 'owner'
        AND (storage.foldername(name))[2] IS NOT NULL
        AND chat_has_texter_from_team(
          (storage.foldername(name))[2]::uuid,
          auth_user_team_id()
        )
      )
    )
  );

-- 2.3 UPDATE: Only uploader can update their files (e.g., metadata)
CREATE POLICY chat_media_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2.4 DELETE: Only uploader can delete their files
CREATE POLICY chat_media_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
