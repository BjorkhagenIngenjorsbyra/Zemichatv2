-- Fix: call_logs_insert_initiator must enforce texter_settings for call permissions.
-- Previously, a Texter with can_voice_call=false or can_video_call=false could still
-- create call_logs entries because the INSERT policy only checked membership and is_active.
-- This migration adds a SECURITY DEFINER helper and updates the policy.

-- Helper: checks if a texter is allowed to make the given call type.
-- Returns true for non-texter roles (owner, super).
-- Returns false if texter_settings row is missing (deny by default).
CREATE OR REPLACE FUNCTION can_initiate_call(target_call_type call_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT role FROM users WHERE id = auth.uid()) IN ('owner', 'super') THEN true
    WHEN target_call_type = 'voice' THEN
      COALESCE((SELECT can_voice_call FROM texter_settings WHERE user_id = auth.uid()), false)
    WHEN target_call_type = 'video' THEN
      COALESCE((SELECT can_video_call FROM texter_settings WHERE user_id = auth.uid()), false)
    ELSE false
  END;
$$;

-- Drop the old policy
DROP POLICY IF EXISTS call_logs_insert_initiator ON call_logs;

-- Recreate with texter_settings enforcement
CREATE POLICY call_logs_insert_initiator ON call_logs
  FOR INSERT WITH CHECK (
    initiator_id = auth.uid()
    AND is_chat_member(chat_id)
    AND auth_user_is_active()
    AND can_initiate_call(type)
  );
