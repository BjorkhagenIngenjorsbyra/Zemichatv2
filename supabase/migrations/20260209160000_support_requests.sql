-- Support requests table + storage bucket
-- Allows users to submit bug reports, suggestions, and support requests

-- 1. Enum for request type
CREATE TYPE support_request_type AS ENUM ('bug', 'suggestion', 'support');

-- 2. Table
CREATE TABLE support_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        support_request_type NOT NULL,
  subject     text NOT NULL CHECK (char_length(subject) <= 200),
  description text NOT NULL CHECK (char_length(description) <= 5000),
  email       text NOT NULL,
  screenshot_url text,
  device_info jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_requests_user ON support_requests(user_id);

-- 3. RLS
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests (must be active)
CREATE POLICY support_requests_insert_own ON support_requests
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND auth_user_is_active()
  );

-- Users can read their own requests
CREATE POLICY support_requests_select_own ON support_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- No UPDATE or DELETE — requests are immutable once submitted

-- 4. Storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  10485760, -- 10MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
);

-- Storage RLS: users can upload to their own folder
CREATE POLICY support_attachments_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: users can read their own uploads
CREATE POLICY support_attachments_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
