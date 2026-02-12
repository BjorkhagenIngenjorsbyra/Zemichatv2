-- ============================================================
-- Input length validation for all user-callable SQL functions.
-- Prevents oversized input from hitting the database.
--
-- Limits:
--   Names / display_name:   max 100 characters
--   Email:                  max 255 characters
--   Password:               max 500 characters
--   Token / ID strings:     max 500 characters
--   Zemi number search:     max 20 characters
-- ============================================================

-- ============================================================
-- 1. create_team_with_owner — add team_name + display_name checks
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
  -- Input length validation
  IF team_name IS NULL OR char_length(team_name) = 0 THEN
    RAISE EXCEPTION 'Team name is required';
  END IF;
  IF char_length(team_name) > 100 THEN
    RAISE EXCEPTION 'Team name too long (max 100 characters)';
  END IF;
  IF owner_display_name IS NOT NULL AND char_length(owner_display_name) > 100 THEN
    RAISE EXCEPTION 'Display name too long (max 100 characters)';
  END IF;

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

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
-- 2. create_texter — add display_name + password checks
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
  -- Input length validation
  IF texter_display_name IS NULL OR char_length(texter_display_name) = 0 THEN
    RAISE EXCEPTION 'Display name is required';
  END IF;
  IF char_length(texter_display_name) > 100 THEN
    RAISE EXCEPTION 'Display name too long (max 100 characters)';
  END IF;
  IF texter_password IS NULL OR char_length(texter_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF char_length(texter_password) > 500 THEN
    RAISE EXCEPTION 'Password too long (max 500 characters)';
  END IF;

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
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    aud, role, confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, phone_change, phone_change_token,
    reauthentication_token
  ) VALUES (
    v_texter_id, '00000000-0000-0000-0000-000000000000', v_fake_email,
    extensions.crypt(texter_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('display_name', texter_display_name)::jsonb,
    now(), now(), 'authenticated', 'authenticated',
    '', '', '', '', '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_texter_id, v_texter_id,
    json_build_object('sub', v_texter_id, 'email', v_fake_email)::jsonb,
    'email', v_texter_id::text, now(), now(), now()
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
-- 3. create_super_invitation — add email + display_name checks
-- ============================================================

CREATE OR REPLACE FUNCTION create_super_invitation(
  invitation_email TEXT,
  invitation_display_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_team_id uuid;
  v_token text;
  v_invitation team_invitations%ROWTYPE;
BEGIN
  -- Input length validation
  IF invitation_email IS NOT NULL AND char_length(invitation_email) > 255 THEN
    RAISE EXCEPTION 'Email too long (max 255 characters)';
  END IF;
  IF invitation_display_name IS NOT NULL AND char_length(invitation_display_name) > 100 THEN
    RAISE EXCEPTION 'Display name too long (max 100 characters)';
  END IF;

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT team_id INTO v_team_id
  FROM users
  WHERE id = v_user_id AND role = 'owner';

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Only team owners can create invitations';
  END IF;

  IF invitation_email IS NULL
     OR invitation_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  IF EXISTS (
    SELECT 1 FROM team_invitations
    WHERE team_id = v_team_id
      AND lower(email) = lower(invitation_email)
      AND claimed_at IS NULL
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'An active invitation already exists for this email';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO team_invitations (
    team_id, invited_by, email, role, token, display_name, expires_at
  ) VALUES (
    v_team_id, v_user_id, lower(invitation_email), 'super',
    v_token, invitation_display_name, now() + interval '7 days'
  )
  RETURNING * INTO v_invitation;

  RETURN row_to_json(v_invitation);
END;
$$;

-- ============================================================
-- 4. get_invitation_public — add token length check
-- ============================================================

CREATE OR REPLACE FUNCTION get_invitation_public(
  invitation_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Input length validation
  IF invitation_token IS NULL OR char_length(invitation_token) = 0 THEN
    RAISE EXCEPTION 'Token is required';
  END IF;
  IF char_length(invitation_token) > 500 THEN
    RAISE EXCEPTION 'Token too long (max 500 characters)';
  END IF;

  SELECT
    ti.id, ti.role, ti.email,
    ti.display_name AS invited_display_name,
    ti.expires_at, ti.claimed_at,
    t.name AS team_name,
    u.display_name AS inviter_name
  INTO v_invitation
  FROM team_invitations ti
  JOIN teams t ON t.id = ti.team_id
  JOIN users u ON u.id = ti.invited_by
  WHERE ti.token = invitation_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  IF v_invitation.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already claimed';
  END IF;

  IF v_invitation.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  RETURN json_build_object(
    'id', v_invitation.id,
    'role', v_invitation.role,
    'email', v_invitation.email,
    'invited_display_name', v_invitation.invited_display_name,
    'team_name', v_invitation.team_name,
    'inviter_name', v_invitation.inviter_name,
    'expires_at', v_invitation.expires_at
  );
END;
$$;

-- ============================================================
-- 5. claim_super_invitation — add token length check
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
  -- Input length validation
  IF invitation_token IS NULL OR char_length(invitation_token) = 0 THEN
    RAISE EXCEPTION 'Token is required';
  END IF;
  IF char_length(invitation_token) > 500 THEN
    RAISE EXCEPTION 'Token too long (max 500 characters)';
  END IF;

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

-- ============================================================
-- 6. update_user_profile — add display_name length check
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
  -- Input length validation
  IF new_display_name IS NOT NULL AND char_length(new_display_name) > 100 THEN
    RAISE EXCEPTION 'Display name too long (max 100 characters)';
  END IF;

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

-- ============================================================
-- 7. search_user_by_zemi — add zemi_number length check
-- ============================================================

CREATE OR REPLACE FUNCTION search_user_by_zemi(p_zemi_number text)
RETURNS TABLE (
  id uuid,
  display_name text,
  zemi_number text,
  avatar_url text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Input length validation (ZEMI-XXX-XXX = 12 chars; allow some slack)
  IF p_zemi_number IS NULL OR char_length(TRIM(p_zemi_number)) = 0 THEN
    RAISE EXCEPTION 'Zemi number is required';
  END IF;
  IF char_length(p_zemi_number) > 20 THEN
    RAISE EXCEPTION 'Zemi number too long (max 20 characters)';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.display_name,
    u.zemi_number,
    u.avatar_url,
    u.role::text
  FROM users u
  WHERE UPPER(u.zemi_number) = UPPER(TRIM(p_zemi_number))
    AND u.is_active = true
    AND u.id != auth.uid();
END;
$$;
