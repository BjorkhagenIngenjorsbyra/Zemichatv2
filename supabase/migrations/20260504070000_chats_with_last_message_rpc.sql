-- Audit fix #36-7: eliminate the N+1 / unbounded fetch in services/chat.ts
-- getMyChats. The old client flow ran:
--   1) chat_members (mine) join chats
--   2) chat_members (all) join users for those chats
--   3) messages SELECT * for ALL chats with no LIMIT — pulling thousands of
--      rows just to take the most recent per chat on the client.
--
-- This RPC returns one row per chat in which the caller is an active member
-- (left_at IS NULL), bundling:
--   - the chat row
--   - the caller's chat_members fields (unread_count, is_pinned, ...)
--   - all active members joined with their users row, as a JSON array
--   - the chat's most recent non-deleted message, via LATERAL LIMIT 1, as JSON
--
-- SECURITY DEFINER so it can bypass RLS recursion on chat_members; the body
-- gates on auth.uid() and only ever returns chats the caller is a member of.

CREATE OR REPLACE FUNCTION get_my_chats_with_last_message()
RETURNS TABLE (
  -- chats columns
  id           uuid,
  name         text,
  description  text,
  avatar_url   text,
  is_group     boolean,
  created_by   uuid,
  created_at   timestamptz,
  updated_at   timestamptz,
  -- caller's chat_members fields
  unread_count int,
  is_pinned    boolean,
  is_archived  boolean,
  is_muted     boolean,
  marked_unread boolean,
  -- aggregated members + last message
  members      jsonb,
  last_message jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.avatar_url,
    c.is_group,
    c.created_by,
    c.created_at,
    c.updated_at,
    my_cm.unread_count,
    my_cm.is_pinned,
    my_cm.is_archived,
    my_cm.is_muted,
    my_cm.marked_unread,
    -- All active members of the chat, with their user record nested as `user`.
    -- Aggregated into a JSON array so the client gets one round-trip.
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id',           cm.id,
                   'chat_id',      cm.chat_id,
                   'user_id',      cm.user_id,
                   'joined_at',    cm.joined_at,
                   'left_at',      cm.left_at,
                   'is_muted',     cm.is_muted,
                   'is_pinned',    cm.is_pinned,
                   'is_archived',  cm.is_archived,
                   'unread_count', cm.unread_count,
                   'last_read_at', cm.last_read_at,
                   'marked_unread', cm.marked_unread,
                   'muted_until',  cm.muted_until,
                   'user', jsonb_build_object(
                     'id',             u.id,
                     'team_id',        u.team_id,
                     'role',           u.role,
                     'zemi_number',    u.zemi_number,
                     'display_name',   u.display_name,
                     'avatar_url',     u.avatar_url,
                     'status_message', u.status_message,
                     'last_seen_at',   u.last_seen_at,
                     'is_active',      u.is_active,
                     'is_paused',      u.is_paused,
                     'wall_enabled',   u.wall_enabled,
                     'consent_accepted_at', u.consent_accepted_at,
                     'created_at',     u.created_at,
                     'updated_at',     u.updated_at
                   )
                 )
               )
        FROM chat_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.chat_id = c.id AND cm.left_at IS NULL
      ),
      '[]'::jsonb
    ) AS members,
    -- Most recent non-deleted message in the chat (or NULL if none).
    -- Uses idx_messages_created (chat_id, created_at DESC) for an O(log n)
    -- index lookup per chat instead of scanning all rows.
    to_jsonb(lm) AS last_message
  FROM chat_members my_cm
  JOIN chats c ON c.id = my_cm.chat_id
  LEFT JOIN LATERAL (
    SELECT m.id,
           m.chat_id,
           m.sender_id,
           m.type,
           m.content,
           m.media_url,
           m.media_metadata,
           m.reply_to_id,
           m.forwarded_from_id,
           m.contact_zemi_number,
           m.is_edited,
           m.edited_at,
           m.deleted_at,
           m.deleted_by,
           m.deleted_for_all,
           m.created_at
    FROM messages m
    WHERE m.chat_id = c.id
      AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE my_cm.user_id = v_uid
    AND my_cm.left_at IS NULL
  ORDER BY my_cm.is_pinned DESC,
           COALESCE(lm.created_at, c.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_chats_with_last_message() TO authenticated;
