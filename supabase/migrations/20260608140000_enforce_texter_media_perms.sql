-- Enforce per-texter media permissions on the SERVER, not just in the client.
--
-- The owner's per-texter toggles (can_send_images / voice / video / documents /
-- share_location) were only gated in the app UI. A determined texter could
-- bypass them by calling the API directly, because messages_insert_member only
-- checked membership + active status. This adds the permission check to the
-- INSERT policy so the database itself rejects a disallowed media message.
--
-- Non-texters (Owner/Super) are unaffected. Plain 'text'/'contact' messages are
-- always allowed. Missing texter_settings row defaults to allowed (matches the
-- client's default-allow behaviour).

CREATE OR REPLACE FUNCTION public.texter_can_send_type(msg_type text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN (SELECT role FROM public.users WHERE id = auth.uid()) <> 'texter' THEN true
    WHEN msg_type = 'image'    THEN COALESCE((SELECT can_send_images    FROM public.texter_settings WHERE user_id = auth.uid()), true)
    WHEN msg_type = 'voice'    THEN COALESCE((SELECT can_send_voice     FROM public.texter_settings WHERE user_id = auth.uid()), true)
    WHEN msg_type = 'video'    THEN COALESCE((SELECT can_send_video     FROM public.texter_settings WHERE user_id = auth.uid()), true)
    WHEN msg_type = 'document' THEN COALESCE((SELECT can_send_documents FROM public.texter_settings WHERE user_id = auth.uid()), true)
    WHEN msg_type = 'location' THEN COALESCE((SELECT can_share_location FROM public.texter_settings WHERE user_id = auth.uid()), true)
    ELSE true
  END;
$$;

GRANT EXECUTE ON FUNCTION public.texter_can_send_type(text) TO authenticated;

-- Recreate the insert policy with the media-permission check appended.
DROP POLICY IF EXISTS messages_insert_member ON public.messages;
CREATE POLICY messages_insert_member ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_chat_member(chat_id)
    AND auth_user_is_active()
    AND public.texter_can_send_type(type::text)
  );
