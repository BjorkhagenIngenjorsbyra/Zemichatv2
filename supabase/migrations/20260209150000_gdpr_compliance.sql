-- GDPR compliance improvements:
-- 1. consent_accepted_at column on users
-- 2. Update create functions to record consent
-- 3. delete_super_account() function
-- 4. Expand export_user_data() to include received messages

-- ============================================================
-- 1. ADD consent_accepted_at TO users
-- ============================================================

ALTER TABLE users ADD COLUMN consent_accepted_at timestamptz;

-- ============================================================
-- 2. UPDATE create_team_with_owner TO RECORD CONSENT
-- ============================================================

CREATE OR REPLACE FUNCTION create_team_with_owner(
  team_name TEXT,
  owner_display_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_team_id uuid;
  v_zemi_number text;
  v_team teams%ROWTYPE;
  v_user users%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  -- Generate unique Zemi number
  v_zemi_number := 'ZEMI-' ||
    upper(substring(md5(random()::text) from 1 for 3)) || '-' ||
    upper(substring(md5(random()::text) from 1 for 3));

  WHILE EXISTS (SELECT 1 FROM users WHERE zemi_number = v_zemi_number) LOOP
    v_zemi_number := 'ZEMI-' ||
      upper(substring(md5(random()::text) from 1 for 3)) || '-' ||
      upper(substring(md5(random()::text) from 1 for 3));
  END LOOP;

  v_team_id := gen_random_uuid();

  SET CONSTRAINTS teams_owner_id_fkey DEFERRED;

  INSERT INTO teams (id, name, owner_id, plan)
  VALUES (v_team_id, team_name, v_user_id, 'free')
  RETURNING * INTO v_team;

  INSERT INTO users (id, team_id, role, zemi_number, display_name, consent_accepted_at)
  VALUES (v_user_id, v_team_id, 'owner', v_zemi_number, owner_display_name, now())
  RETURNING * INTO v_user;

  RETURN json_build_object(
    'team', row_to_json(v_team),
    'user', row_to_json(v_user)
  );
END;
$$;

-- ============================================================
-- 3. UPDATE create_texter TO RECORD PARENTAL CONSENT
-- ============================================================

CREATE OR REPLACE FUNCTION create_texter(
  texter_display_name TEXT,
  texter_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_team_id uuid;
  v_texter_id uuid;
  v_zemi_number text;
  v_fake_email text;
  v_user users%ROWTYPE;
BEGIN
  v_owner_id := auth.uid();

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT team_id INTO v_team_id
  FROM users
  WHERE id = v_owner_id AND role = 'owner';

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Only team owners can create texters';
  END IF;

  -- Generate unique Zemi number
  v_zemi_number := 'ZEMI-' ||
    upper(substring(md5(random()::text) from 1 for 3)) || '-' ||
    upper(substring(md5(random()::text) from 1 for 3));

  WHILE EXISTS (SELECT 1 FROM users WHERE zemi_number = v_zemi_number) LOOP
    v_zemi_number := 'ZEMI-' ||
      upper(substring(md5(random()::text) from 1 for 3)) || '-' ||
      upper(substring(md5(random()::text) from 1 for 3));
  END LOOP;

  v_fake_email := lower(replace(v_zemi_number, '-', '')) || '@texter.zemichat.local';

  v_texter_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    email_change,
    phone_change,
    phone_change_token,
    reauthentication_token
  ) VALUES (
    v_texter_id,
    '00000000-0000-0000-0000-000000000000',
    v_fake_email,
    extensions.crypt(texter_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('display_name', texter_display_name)::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated',
    '', -- confirmation_token
    '', -- recovery_token
    '', -- email_change_token_new
    '', -- email_change_token_current
    '', -- email_change
    '', -- phone_change
    '', -- phone_change_token
    ''  -- reauthentication_token
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_texter_id,
    v_texter_id,
    json_build_object('sub', v_texter_id, 'email', v_fake_email)::jsonb,
    'email',
    v_texter_id::text,
    now(),
    now(),
    now()
  );

  INSERT INTO users (id, team_id, role, zemi_number, display_name, consent_accepted_at)
  VALUES (v_texter_id, v_team_id, 'texter', v_zemi_number, texter_display_name, now())
  RETURNING * INTO v_user;

  INSERT INTO texter_settings (user_id)
  VALUES (v_texter_id);

  RETURN json_build_object(
    'user', row_to_json(v_user),
    'zemi_number', v_zemi_number,
    'password', texter_password
  );
END;
$$;

-- ============================================================
-- 4. UPDATE claim_super_invitation TO RECORD CONSENT
-- ============================================================

CREATE OR REPLACE FUNCTION claim_super_invitation(invitation_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation team_invitations%ROWTYPE;
  v_zemi_number text;
  v_user users%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token = invitation_token;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  IF v_invitation.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already claimed';
  END IF;

  IF v_invitation.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Generate unique Zemi number
  v_zemi_number := 'ZEMI-' ||
    upper(substring(md5(random()::text) from 1 for 3)) || '-' ||
    upper(substring(md5(random()::text) from 1 for 3));

  WHILE EXISTS (SELECT 1 FROM users WHERE zemi_number = v_zemi_number) LOOP
    v_zemi_number := 'ZEMI-' ||
      upper(substring(md5(random()::text) from 1 for 3)) || '-' ||
      upper(substring(md5(random()::text) from 1 for 3));
  END LOOP;

  INSERT INTO users (id, team_id, role, zemi_number, display_name, consent_accepted_at)
  VALUES (
    v_user_id,
    v_invitation.team_id,
    v_invitation.role,
    v_zemi_number,
    COALESCE(v_invitation.display_name, ''),
    now()
  )
  RETURNING * INTO v_user;

  UPDATE team_invitations
  SET claimed_at = now(), claimed_by = v_user_id
  WHERE id = v_invitation.id;

  RETURN row_to_json(v_user);
END;
$$;

-- ============================================================
-- 5. DELETE SUPER ACCOUNT (self-service)
-- ============================================================

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

  -- Delete storage objects
  DELETE FROM storage.objects WHERE owner = v_uid::text;

  -- Handle FK-restricted tables (no ON DELETE CASCADE on users(id)):

  -- message_edits → reference messages that will be deleted
  DELETE FROM message_edits WHERE message_id IN (
    SELECT id FROM messages WHERE sender_id = v_uid
  );

  -- messages sent by this user
  DELETE FROM messages WHERE sender_id = v_uid;

  -- messages.deleted_by (nullable, no CASCADE)
  UPDATE messages SET deleted_by = NULL WHERE deleted_by = v_uid;

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
  -- Ones where user_id = v_uid will cascade; reassign others to owner
  UPDATE quick_messages SET created_by = v_owner_id
  WHERE created_by = v_uid AND user_id != v_uid;

  -- Delete auth.users → cascades to public.users → cascades to remaining FK tables
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_super_account TO authenticated;

-- ============================================================
-- 6. UPDATE USER PROFILE (display_name)
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_profile(new_display_name TEXT DEFAULT NULL)
RETURNS void
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

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_uid) THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  UPDATE users
  SET display_name = new_display_name,
      updated_at = now()
  WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_profile TO authenticated;

-- ============================================================
-- 7. UPDATE EXPORT TO INCLUDE RECEIVED MESSAGES
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

    'messages_sent', (
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

    'messages_received', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', m.id,
        'chat_id', m.chat_id,
        'sender_id', m.sender_id,
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
      WHERE m.sender_id != v_uid
        AND m.chat_id IN (
          SELECT cm.chat_id FROM chat_members cm WHERE cm.user_id = v_uid
        )
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
