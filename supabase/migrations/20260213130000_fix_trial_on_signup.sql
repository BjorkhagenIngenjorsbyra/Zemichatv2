-- Fix: New teams now start with a 10-day Pro trial.
-- The original create_team_with_owner set plan='free' and never set trial_ends_at,
-- so no team ever received a trial automatically.

-- ============================================================
-- 1. Replace create_team_with_owner to start with trial
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
  v_referral_code text;
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

  -- Generate unique referral code
  v_referral_code := 'ZEMI-' || upper(substring(md5(random()::text) from 1 for 6));
  WHILE EXISTS (SELECT 1 FROM teams WHERE referral_code = v_referral_code) LOOP
    v_referral_code := 'ZEMI-' || upper(substring(md5(random()::text) from 1 for 6));
  END LOOP;

  v_team_id := gen_random_uuid();

  SET CONSTRAINTS teams_owner_id_fkey DEFERRED;

  INSERT INTO teams (id, name, owner_id, plan, trial_ends_at, referral_code)
  VALUES (v_team_id, team_name, v_user_id, 'pro', now() + interval '10 days', v_referral_code)
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
-- 2. Backfill existing teams with a fresh 10-day trial
-- ============================================================

UPDATE teams
SET trial_ends_at = now() + interval '10 days',
    plan = 'pro'
WHERE trial_ends_at IS NULL;
