-- Audit fix #24: delete_super_account() must soft-delete messages, not
-- hard-delete them. Owner-oversight depends on every Texter chat message
-- staying queryable; if a Super hard-deletes their account the Owner
-- loses transparency into messages the Super sent in Texter chats.
--
-- Soft-delete sets:
--   deleted_at = now()
--   deleted_by = the user being deleted
--   content    = '[user deleted]'   (GDPR data minimisation while keeping
--                                    the row + metadata for transparency)
-- Owner-oversight policy `messages_select_owner_oversight` ignores
-- deleted_at, so the row stays visible to the Owner with the placeholder.

CREATE OR REPLACE FUNCTION delete_super_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role user_role;
  v_team_id uuid;
  v_owner_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, team_id INTO v_role, v_team_id
  FROM users
  WHERE id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_role != 'super' THEN
    RAISE EXCEPTION 'Only Super users can use this function';
  END IF;

  -- Get team owner for reassigning orphaned records
  SELECT owner_id INTO v_owner_id FROM teams WHERE id = v_team_id;

  -- Log deletion (anonymised)
  INSERT INTO account_deletion_log (team_name_hash, member_count, deletion_type, initiated_by_role)
  VALUES (
    encode(extensions.digest((SELECT name FROM teams WHERE id = v_team_id), 'sha256'), 'hex'),
    1,
    'super_self_delete',
    v_role
  );

  -- Delete storage objects (uploaded media)
  DELETE FROM storage.objects WHERE owner = v_uid::text;

  -- Handle FK-restricted tables (no ON DELETE CASCADE on users(id)):

  -- messages: SOFT-delete instead of hard-delete (audit fix #24).
  -- Owner-oversight RLS keeps these rows visible even after the auth
  -- user is gone. Content is replaced with a placeholder for GDPR.
  UPDATE messages
    SET deleted_at = now(),
        deleted_by = v_uid,
        content = '[user deleted]',
        media_url = NULL,
        media_metadata = NULL
    WHERE sender_id = v_uid AND deleted_at IS NULL;

  -- message_edits referencing the soft-deleted messages: keep them so
  -- Owner can still see edit history if needed. The edit content was
  -- already user-typed text — no additional removal beyond clearing
  -- the live `messages.content` above.

  -- messages.deleted_by (nullable, no CASCADE) — clear references
  -- coming from this user as the deleter on OTHER people's messages.
  -- Don't touch the row we just soft-deleted (where deleted_by = v_uid
  -- is intentional).
  UPDATE messages
    SET deleted_by = NULL
    WHERE deleted_by = v_uid AND sender_id != v_uid;

  -- chats.created_by (NOT NULL, no CASCADE) → reassign to team owner
  UPDATE chats SET created_by = v_owner_id WHERE created_by = v_uid;

  -- friendships.approved_by (nullable, no CASCADE)
  UPDATE friendships SET approved_by = NULL WHERE approved_by = v_uid;

  -- denied_friend_requests.denied_by (NOT NULL, no CASCADE)
  DELETE FROM denied_friend_requests WHERE denied_by = v_uid;

  -- reports
  DELETE FROM reports WHERE reporter_id = v_uid;
  UPDATE reports SET reported_user_id = NULL WHERE reported_user_id = v_uid;
  UPDATE reports SET reviewed_by = NULL WHERE reviewed_by = v_uid;

  -- sos_alerts (unlikely for Super but handle)
  DELETE FROM sos_alerts WHERE texter_id = v_uid;
  UPDATE sos_alerts SET acknowledged_by = NULL WHERE acknowledged_by = v_uid;

  -- call_logs (NOT NULL initiator_id, no CASCADE)
  DELETE FROM call_logs WHERE initiator_id = v_uid;

  -- call_signals (NOT NULL caller_id, no CASCADE)
  DELETE FROM call_signals WHERE caller_id = v_uid;

  -- quick_messages.created_by (NOT NULL, no CASCADE)
  UPDATE quick_messages SET created_by = v_owner_id
  WHERE created_by = v_uid AND user_id != v_uid;

  -- The auth.users row would normally be deleted here so the user can
  -- no longer log in. With soft-deleted messages we MUST keep the
  -- public.users row intact (sender_id is NOT NULL on messages and
  -- references users(id) — deleting it would either cascade or fail).
  -- Keep public.users but mark inactive + scrub PII to satisfy GDPR.
  UPDATE users
    SET is_active = false,
        is_paused = true,
        display_name = '[deleted]',
        avatar_url = NULL,
        updated_at = now()
    WHERE id = v_uid;

  -- Disable the auth login by clearing the password and email and
  -- banning the user. We do not DELETE the auth.users row because that
  -- would cascade and orphan public.users rows the soft-delete relies on.
  UPDATE auth.users
    SET email = 'deleted-' || v_uid::text || '@deleted.zemichat.local',
        encrypted_password = '',
        banned_until = '2099-12-31'::timestamptz,
        updated_at = now()
    WHERE id = v_uid;
END;
$$;
