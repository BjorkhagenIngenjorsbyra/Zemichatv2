-- ============================================================
-- Team Invitations: table, RLS policies, and RPC functions
-- Enables Owners to invite Supers via shareable links
-- ============================================================

-- ============================================================
-- 1. TABLE
-- ============================================================

CREATE TABLE team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL DEFAULT 'super',
  token text NOT NULL UNIQUE,
  display_name text,
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  claimed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. RLS POLICIES
-- ============================================================

-- Owner can see their team's invitations
CREATE POLICY team_invitations_select_owner ON team_invitations
  FOR SELECT
  USING (
    team_id IN (
      SELECT u.team_id FROM users u
      WHERE u.id = auth.uid() AND u.role = 'owner'
    )
  );

-- Owner can create invitations for their team
CREATE POLICY team_invitations_insert_owner ON team_invitations
  FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND team_id IN (
      SELECT u.team_id FROM users u
      WHERE u.id = auth.uid() AND u.role = 'owner'
    )
  );

-- Owner can delete pending invitations for their team
CREATE POLICY team_invitations_delete_owner ON team_invitations
  FOR DELETE
  USING (
    claimed_at IS NULL
    AND team_id IN (
      SELECT u.team_id FROM users u
      WHERE u.id = auth.uid() AND u.role = 'owner'
    )
  );

-- ============================================================
-- 3. create_super_invitation() — Owner creates an invitation
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
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is an owner
  SELECT team_id INTO v_team_id
  FROM users
  WHERE id = v_user_id AND role = 'owner';

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Only team owners can create invitations';
  END IF;

  -- Basic email format validation
  IF invitation_email IS NULL
     OR invitation_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Check for existing unclaimed, unexpired invitation with same email in same team
  IF EXISTS (
    SELECT 1 FROM team_invitations
    WHERE team_id = v_team_id
      AND lower(email) = lower(invitation_email)
      AND claimed_at IS NULL
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'An active invitation already exists for this email';
  END IF;

  -- Generate cryptographically secure token
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  -- Create invitation (expires in 7 days)
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

GRANT EXECUTE ON FUNCTION create_super_invitation TO authenticated;

-- ============================================================
-- 4. get_invitation_public(token) — Public info without auth
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
  SELECT
    ti.id,
    ti.role,
    ti.email,
    ti.display_name AS invited_display_name,
    ti.expires_at,
    ti.claimed_at,
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

-- Grant to both anon and authenticated so it works before and after signup
GRANT EXECUTE ON FUNCTION get_invitation_public TO anon;
GRANT EXECUTE ON FUNCTION get_invitation_public TO authenticated;

-- ============================================================
-- 5. claim_super_invitation(token) — Authenticated user claims invite
-- ============================================================

CREATE OR REPLACE FUNCTION claim_super_invitation(
  invitation_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_invitation team_invitations%ROWTYPE;
  v_zemi_number text;
  v_user users%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- User must NOT already have a profile
  IF EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  -- Find and lock the invitation
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token = invitation_token
  FOR UPDATE;

  IF NOT FOUND THEN
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

  -- Create user profile as super in the invitation's team
  INSERT INTO users (id, team_id, role, zemi_number, display_name)
  VALUES (
    v_user_id,
    v_invitation.team_id,
    v_invitation.role,
    v_zemi_number,
    COALESCE(v_invitation.display_name, (
      SELECT raw_user_meta_data->>'display_name'
      FROM auth.users WHERE id = v_user_id
    ))
  )
  RETURNING * INTO v_user;

  -- Mark invitation as claimed
  UPDATE team_invitations
  SET claimed_at = now(), claimed_by = v_user_id
  WHERE id = v_invitation.id;

  RETURN row_to_json(v_user);
END;
$$;

GRANT EXECUTE ON FUNCTION claim_super_invitation TO authenticated;
