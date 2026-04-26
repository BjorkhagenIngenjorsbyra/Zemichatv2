-- Audit fix #25: replace the n+1 query pattern in oversight.getTexterChats
-- with a single SECURITY DEFINER RPC that returns the data the dashboard
-- needs in one round-trip.
--
-- Returns one row per (chat_id, texter_id) pair in the requested team.
-- Includes the chat row, the Texter, the last message in the chat
-- (regardless of sender — Owner sees deleted messages too via oversight
-- policies, so this includes them), and a total message count.
--
-- The function checks that the caller is the Owner of the supplied team
-- before returning anything.

CREATE OR REPLACE FUNCTION get_texter_chat_overview(p_team_id uuid)
RETURNS TABLE (
  chat_id uuid,
  chat_name text,
  chat_is_group boolean,
  chat_created_at timestamptz,
  texter_id uuid,
  texter_zemi_number text,
  texter_display_name text,
  texter_avatar_url text,
  texter_is_active boolean,
  texter_is_paused boolean,
  last_message_id uuid,
  last_message_content text,
  last_message_type text,
  last_message_sender_id uuid,
  last_message_created_at timestamptz,
  last_message_deleted_at timestamptz,
  message_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller must be the Owner of the requested team.
  SELECT u.role INTO v_role
  FROM users u
  WHERE u.id = v_uid AND u.team_id = p_team_id AND u.role = 'owner';

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Only the team owner can read this overview';
  END IF;

  RETURN QUERY
  WITH team_texters AS (
    SELECT u.id, u.zemi_number, u.display_name, u.avatar_url, u.is_active, u.is_paused
    FROM users u
    WHERE u.team_id = p_team_id AND u.role = 'texter'
  ),
  texter_chats AS (
    -- Active chat memberships for each Texter
    SELECT cm.chat_id, cm.user_id AS texter_id
    FROM chat_members cm
    JOIN team_texters t ON t.id = cm.user_id
    WHERE cm.left_at IS NULL
  ),
  last_messages AS (
    -- One row per chat: the most recent message (incl. soft-deleted, since
    -- Owner-oversight is allowed to see deleted_at IS NOT NULL rows)
    SELECT DISTINCT ON (m.chat_id)
      m.chat_id,
      m.id          AS message_id,
      m.content,
      m.type::text  AS type,
      m.sender_id,
      m.created_at,
      m.deleted_at
    FROM messages m
    WHERE m.chat_id IN (SELECT DISTINCT tc.chat_id FROM texter_chats tc)
    ORDER BY m.chat_id, m.created_at DESC
  ),
  message_counts AS (
    SELECT m.chat_id, COUNT(*)::bigint AS count
    FROM messages m
    WHERE m.chat_id IN (SELECT DISTINCT tc.chat_id FROM texter_chats tc)
    GROUP BY m.chat_id
  )
  SELECT
    c.id                                AS chat_id,
    c.name                              AS chat_name,
    c.is_group                          AS chat_is_group,
    c.created_at                        AS chat_created_at,
    t.id                                AS texter_id,
    t.zemi_number                       AS texter_zemi_number,
    t.display_name                      AS texter_display_name,
    t.avatar_url                        AS texter_avatar_url,
    t.is_active                         AS texter_is_active,
    t.is_paused                         AS texter_is_paused,
    lm.message_id                       AS last_message_id,
    lm.content                          AS last_message_content,
    lm.type                             AS last_message_type,
    lm.sender_id                        AS last_message_sender_id,
    lm.created_at                       AS last_message_created_at,
    lm.deleted_at                       AS last_message_deleted_at,
    COALESCE(mc.count, 0)               AS message_count
  FROM texter_chats tc
  JOIN chats c             ON c.id = tc.chat_id
  JOIN team_texters t      ON t.id = tc.texter_id
  LEFT JOIN last_messages lm  ON lm.chat_id = c.id
  LEFT JOIN message_counts mc ON mc.chat_id = c.id
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_texter_chat_overview(uuid) TO authenticated;
