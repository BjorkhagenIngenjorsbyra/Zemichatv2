-- Audit fix #26: messages soft-deleted with deleted_for_all = true must
-- be visible to other chat members so the UI can render the "Detta
-- meddelande har raderats" placeholder. The previous policy
--   USING (is_chat_member(chat_id) AND deleted_at IS NULL)
-- filtered every soft-deleted row out at the server, so the client's
-- attempt to OR `deleted_for_all = true` had no effect — the row was
-- never returned in the first place.
--
-- New policy returns:
--   * all non-deleted rows the user has access to, OR
--   * soft-deleted rows where the sender flagged delete-for-all.
--
-- The sender always sees their own messages (messages_select_sender,
-- unchanged) so they can re-issue an action on them. The Owner-oversight
-- policy (messages_select_owner_oversight) is unchanged — Owner already
-- sees everything including deleted_at IS NOT NULL with deleted_for_all
-- = false (delete-for-me).
--
-- Client code must filter `content` by deleted_for_all when rendering —
-- delete_super_account migration #24 already replaces content with
-- '[user deleted]', and message senders setting delete-for-all may want
-- to scrub content too. We don't change that flow here; the placeholder
-- rendering already lives in CallLogMessage / MessageBubble.

DROP POLICY IF EXISTS messages_select_member ON messages;

CREATE POLICY messages_select_member ON messages
  FOR SELECT USING (
    is_chat_member(chat_id)
    AND (deleted_at IS NULL OR deleted_for_all = true)
  );
