-- ============================================================
-- Function to create a team and owner user atomically
-- Handles the circular FK between teams.owner_id and users.team_id
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
  -- Get the authenticated user's ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  -- Generate unique Zemi number
  v_zemi_number := 'ZEMI-' ||
    upper(substring(md5(random()::text) from 1 for 3)) || '-' ||
    upper(substring(md5(random()::text) from 1 for 3));

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM users WHERE zemi_number = v_zemi_number) LOOP
    v_zemi_number := 'ZEMI-' ||
      upper(substring(md5(random()::text) from 1 for 3)) || '-' ||
      upper(substring(md5(random()::text) from 1 for 3));
  END LOOP;

  -- Generate team ID
  v_team_id := gen_random_uuid();

  -- Insert team first (owner_id FK is DEFERRABLE or we handle it)
  -- We need to temporarily disable the FK check
  SET CONSTRAINTS teams_owner_id_fkey DEFERRED;

  INSERT INTO teams (id, name, owner_id, plan)
  VALUES (v_team_id, team_name, v_user_id, 'free')
  RETURNING * INTO v_team;

  -- Insert user profile
  INSERT INTO users (id, team_id, role, zemi_number, display_name)
  VALUES (v_user_id, v_team_id, 'owner', v_zemi_number, owner_display_name)
  RETURNING * INTO v_user;

  -- Return the created data
  RETURN json_build_object(
    'team', row_to_json(v_team),
    'user', row_to_json(v_user)
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_team_with_owner TO authenticated;

-- ============================================================
-- Function to create a Texter in a team
-- Only team owners can call this
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
  -- Get the authenticated user's ID
  v_owner_id := auth.uid();

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if caller is an owner
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

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM users WHERE zemi_number = v_zemi_number) LOOP
    v_zemi_number := 'ZEMI-' ||
      upper(substring(md5(random()::text) from 1 for 3)) || '-' ||
      upper(substring(md5(random()::text) from 1 for 3));
  END LOOP;

  -- Create fake email for auth (texters don't have real email)
  v_fake_email := lower(replace(v_zemi_number, '-', '')) || '@texter.zemichat.local';

  -- Create auth user using admin function
  -- Note: This requires the function to have SECURITY DEFINER and proper grants
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
    role,
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    email_change,
    phone_change,
    phone_change_token,
    reauthentication_token
  )
  VALUES (
    v_texter_id,
    '00000000-0000-0000-0000-000000000000',
    v_fake_email,
    extensions.crypt(texter_password, extensions.gen_salt('bf')),
    now(), -- Auto-confirm email for texters
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('display_name', texter_display_name, 'role', 'texter', 'zemi_number', v_zemi_number),
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

  -- Create user profile
  INSERT INTO users (id, team_id, role, zemi_number, display_name)
  VALUES (v_texter_id, v_team_id, 'texter', v_zemi_number, texter_display_name)
  RETURNING * INTO v_user;

  -- Create texter_settings with defaults
  INSERT INTO texter_settings (user_id)
  VALUES (v_texter_id);

  -- Return the created data
  RETURN json_build_object(
    'user', row_to_json(v_user),
    'zemi_number', v_zemi_number,
    'password', texter_password
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_texter TO authenticated;

-- Make the FK deferrable so we can insert team before user
ALTER TABLE teams
  DROP CONSTRAINT IF EXISTS teams_owner_id_fkey,
  ADD CONSTRAINT teams_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;
