-- Migration: Add deleted_for_all column to messages
-- Purpose: Distinguish "delete for me" (only hides for sender) from
--          "delete for all" (shows placeholder for everyone, but Owner
--          still sees original content per transparency model).

ALTER TABLE messages ADD COLUMN deleted_for_all boolean NOT NULL DEFAULT false;

-- Update the soft-delete policy to also allow setting deleted_for_all.
-- Drop and recreate since we need to change the WITH CHECK clause.
DROP POLICY IF EXISTS messages_update_soft_delete ON messages;

CREATE POLICY messages_update_soft_delete ON messages
  FOR UPDATE USING (
    sender_id = auth.uid()
    AND deleted_at IS NULL
  ) WITH CHECK (
    sender_id = auth.uid()
    AND deleted_by = auth.uid()
    AND deleted_at IS NOT NULL
    -- deleted_for_all can be true or false — both are allowed
  );
