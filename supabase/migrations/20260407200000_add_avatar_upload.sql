-- Add avatar upload support
-- 1. Create avatars storage bucket
-- 2. Extend update_user_profile to accept avatar_url

-- Create avatars bucket (public for easy access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- RLS: users can upload their own avatar
CREATE POLICY avatars_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: users can update/overwrite their own avatar
CREATE POLICY avatars_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: anyone can read avatars (public bucket)
CREATE POLICY avatars_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'avatars'
  );

-- RLS: users can delete their own avatar
CREATE POLICY avatars_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Extend update_user_profile to accept avatar_url
CREATE OR REPLACE FUNCTION update_user_profile(
  new_display_name TEXT DEFAULT NULL,
  new_avatar_url TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate display_name length
  IF new_display_name IS NOT NULL AND length(new_display_name) > 100 THEN
    RAISE EXCEPTION 'Display name too long (max 100 characters)';
  END IF;

  -- Validate avatar_url length
  IF new_avatar_url IS NOT NULL AND length(new_avatar_url) > 500 THEN
    RAISE EXCEPTION 'Avatar URL too long (max 500 characters)';
  END IF;

  UPDATE users
  SET
    display_name = COALESCE(new_display_name, display_name),
    avatar_url = COALESCE(new_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_profile TO authenticated;
