-- Auto-friendship for team members:
-- When a Texter is created or a Super claims an invitation,
-- automatically create 'accepted' friendships with all existing
-- active team members so they can chat immediately.

-- ============================================================
-- 1. UPDATE create_texter TO ADD AUTO-FRIENDSHIPS
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

  -- Auto-create friendships with all existing active team members
  INSERT INTO friendships (requester_id, addressee_id, status, approved_by)
  SELECT v_texter_id, u.id, 'accepted', v_owner_id
  FROM users u
  WHERE u.team_id = v_team_id AND u.id != v_texter_id AND u.is_active = true;

  RETURN json_build_object(
    'user', row_to_json(v_user),
    'zemi_number', v_zemi_number,
    'password', texter_password
  );
END;
$$;

-- ============================================================
-- 2. UPDATE claim_super_invitation TO ADD AUTO-FRIENDSHIPS
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

  -- Auto-create friendships with all existing active team members
  INSERT INTO friendships (requester_id, addressee_id, status, approved_by)
  SELECT v_user_id, u.id, 'accepted', (SELECT owner_id FROM teams WHERE id = v_invitation.team_id)
  FROM users u
  WHERE u.team_id = v_invitation.team_id AND u.id != v_user_id AND u.is_active = true;

  RETURN row_to_json(v_user);
END;
$$;
