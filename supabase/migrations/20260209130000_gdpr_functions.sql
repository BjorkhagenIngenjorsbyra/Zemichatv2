-- GDPR compliance: account deletion log, data export, and account deletion
-- Provides: account_deletion_log table, export_user_data(), delete_owner_account()

-- ============================================================
-- 1. ACCOUNT DELETION LOG (anonymised)
-- ============================================================

CREATE TABLE account_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  team_name_hash text,
  member_count int NOT NULL,
  deletion_type text NOT NULL,
  initiated_by_role user_role NOT NULL
);

-- No RLS policies — only SECURITY DEFINER functions write here
ALTER TABLE account_deletion_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. EXPORT USER DATA
-- ============================================================

CREATE OR REPLACE FUNCTION export_user_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT json_build_object(
    'exported_at', now(),
    'user_id', v_uid,

    'profile', (
      SELECT row_to_json(u.*)
      FROM users u
      WHERE u.id = v_uid
    ),

    'texter_settings', (
      SELECT row_to_json(ts.*)
      FROM texter_settings ts
      WHERE ts.user_id = v_uid
    ),

    'friendships', (
      SELECT COALESCE(json_agg(row_to_json(f.*)), '[]'::json)
      FROM friendships f
      WHERE f.requester_id = v_uid OR f.addressee_id = v_uid
    ),

    'chats', (
      SELECT COALESCE(json_agg(row_to_json(c.*)), '[]'::json)
      FROM chats c
      WHERE c.id IN (
        SELECT cm.chat_id FROM chat_members cm WHERE cm.user_id = v_uid
      )
    ),

    'chat_memberships', (
      SELECT COALESCE(json_agg(row_to_json(cm.*)), '[]'::json)
      FROM chat_members cm
      WHERE cm.user_id = v_uid
    ),

    'messages', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', m.id,
        'chat_id', m.chat_id,
        'type', m.type,
        'content', m.content,
        'media_url', m.media_url,
        'reply_to_id', m.reply_to_id,
        'is_edited', m.is_edited,
        'edited_at', m.edited_at,
        'deleted_at', m.deleted_at,
        'created_at', m.created_at
      )), '[]'::json)
      FROM messages m
      WHERE m.sender_id = v_uid
    ),

    'message_edits', (
      SELECT COALESCE(json_agg(row_to_json(me.*)), '[]'::json)
      FROM message_edits me
      WHERE me.message_id IN (
        SELECT m.id FROM messages m WHERE m.sender_id = v_uid
      )
    ),

    'message_reactions', (
      SELECT COALESCE(json_agg(row_to_json(mr.*)), '[]'::json)
      FROM message_reactions mr
      WHERE mr.user_id = v_uid
    ),

    'starred_messages', (
      SELECT COALESCE(json_agg(row_to_json(sm.*)), '[]'::json)
      FROM starred_messages sm
      WHERE sm.user_id = v_uid
    ),

    'message_read_receipts', (
      SELECT COALESCE(json_agg(row_to_json(rr.*)), '[]'::json)
      FROM message_read_receipts rr
      WHERE rr.user_id = v_uid
    ),

    'quick_messages', (
      SELECT COALESCE(json_agg(row_to_json(qm.*)), '[]'::json)
      FROM quick_messages qm
      WHERE qm.user_id = v_uid
    ),

    'reports', (
      SELECT COALESCE(json_agg(row_to_json(r.*)), '[]'::json)
      FROM reports r
      WHERE r.reporter_id = v_uid
    ),

    'sos_alerts', (
      SELECT COALESCE(json_agg(row_to_json(sa.*)), '[]'::json)
      FROM sos_alerts sa
      WHERE sa.texter_id = v_uid
    ),

    'call_logs', (
      SELECT COALESCE(json_agg(row_to_json(cl.*)), '[]'::json)
      FROM call_logs cl
      WHERE cl.initiator_id = v_uid
    ),

    'push_tokens', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', pt.id,
        'platform', pt.platform,
        'created_at', pt.created_at
      )), '[]'::json)
      FROM push_tokens pt
      WHERE pt.user_id = v_uid
    ),

    'user_sessions', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', us.id,
        'device_name', us.device_name,
        'last_active_at', us.last_active_at,
        'created_at', us.created_at
      )), '[]'::json)
      FROM user_sessions us
      WHERE us.user_id = v_uid
    ),

    'manual_subscriptions', (
      SELECT COALESCE(json_agg(row_to_json(ms.*)), '[]'::json)
      FROM manual_subscriptions ms
      WHERE ms.user_id = v_uid
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION export_user_data TO authenticated;

-- ============================================================
-- 3. DELETE OWNER ACCOUNT (entire team)
-- ============================================================

CREATE OR REPLACE FUNCTION delete_owner_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role user_role;
  v_team_id uuid;
  v_team_name text;
  v_member_count int;
  v_member_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Verify caller is an owner
  SELECT role, team_id INTO v_role, v_team_id
  FROM users
  WHERE id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_role != 'owner' THEN
    RAISE EXCEPTION 'Only team owners can delete accounts';
  END IF;

  -- 2. Gather team info
  SELECT name INTO v_team_name
  FROM teams
  WHERE id = v_team_id;

  SELECT array_agg(id), count(*)::int
  INTO v_member_ids, v_member_count
  FROM users
  WHERE team_id = v_team_id;

  -- 3. Log deletion (anonymised — SHA-256 hash of team name)
  INSERT INTO account_deletion_log (team_name_hash, member_count, deletion_type, initiated_by_role)
  VALUES (
    encode(digest(v_team_name, 'sha256'), 'hex'),
    v_member_count,
    'owner_full_team',
    v_role
  );

  -- 4. Delete storage objects for all team members
  DELETE FROM storage.objects
  WHERE owner IN (
    SELECT id::text FROM unnest(v_member_ids) AS id
  );

  -- 5. Delete all auth.users for team members (except the owner)
  --    CASCADE will handle: public.users → all FK-dependent tables
  DELETE FROM auth.users
  WHERE id IN (
    SELECT unnest(v_member_ids)
  )
  AND id != v_uid;

  -- 6. Delete the owner's auth.users record last
  --    This also cascades: users → teams (via teams.owner_id ON DELETE CASCADE)
  DELETE FROM auth.users
  WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_owner_account TO authenticated;
