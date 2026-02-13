-- Referral system: referral codes for teams and referral tracking
-- Every Team Owner gets a unique referral code (ZEMI-XXXXXX).
-- When a new user creates a team and enters a valid code, the referrer
-- earns 1 month free Plus Ringa per referral (activated after trial expires).

-- ============================================================
-- 1. Add referral_code column to teams
-- ============================================================

ALTER TABLE teams ADD COLUMN referral_code text UNIQUE;
CREATE INDEX idx_teams_referral_code ON teams(referral_code);

-- Backfill existing teams with unique codes
UPDATE teams SET referral_code = 'ZEMI-' || upper(substring(md5(id::text || random()::text) from 1 for 6))
WHERE referral_code IS NULL;

-- Ensure uniqueness after backfill (extremely unlikely collision, but handle it)
DO $$
DECLARE
  r RECORD;
  v_new_code TEXT;
BEGIN
  FOR r IN
    SELECT id FROM teams
    WHERE referral_code IN (
      SELECT referral_code FROM teams GROUP BY referral_code HAVING count(*) > 1
    )
    OFFSET 1  -- keep one, regenerate the rest
  LOOP
    v_new_code := 'ZEMI-' || upper(substring(md5(r.id::text || random()::text || clock_timestamp()::text) from 1 for 6));
    WHILE EXISTS (SELECT 1 FROM teams WHERE referral_code = v_new_code) LOOP
      v_new_code := 'ZEMI-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    END LOOP;
    UPDATE teams SET referral_code = v_new_code WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE teams ALTER COLUMN referral_code SET NOT NULL;

-- ============================================================
-- 2. Update create_team_with_owner to generate referral_code
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

  INSERT INTO teams (id, name, owner_id, plan, referral_code)
  VALUES (v_team_id, team_name, v_user_id, 'free', v_referral_code)
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
-- 3. Create referrals table
-- ============================================================

CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  referred_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  reward_granted_at timestamptz,  -- NULL = pending (waiting for trial to expire)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_team_id)  -- Each team can only be referred once
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_team_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Owners can see referrals where their team is the referrer
CREATE POLICY referrals_select_referrer ON referrals
  FOR SELECT USING (
    referrer_team_id IN (
      SELECT t.id FROM teams t WHERE t.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 4. validate_referral_code – check if a code is valid
-- ============================================================

CREATE OR REPLACE FUNCTION validate_referral_code(code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team teams%ROWTYPE;
BEGIN
  IF code IS NULL OR char_length(code) = 0 THEN
    RETURN json_build_object('valid', false, 'team_name', null);
  END IF;

  SELECT * INTO v_team
  FROM teams
  WHERE referral_code = upper(trim(code));

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'team_name', null);
  END IF;

  RETURN json_build_object('valid', true, 'team_name', v_team.name);
END;
$$;

-- ============================================================
-- 5. submit_referral – record a referral after team creation
-- ============================================================

CREATE OR REPLACE FUNCTION submit_referral(code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_team_id uuid;
  v_my_team_id uuid;
BEGIN
  IF code IS NULL OR char_length(code) = 0 THEN
    RAISE EXCEPTION 'Referral code is required';
  END IF;

  -- Find referrer team
  SELECT id INTO v_referrer_team_id
  FROM teams
  WHERE referral_code = upper(trim(code));

  IF v_referrer_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;

  -- Find caller's team
  SELECT team_id INTO v_my_team_id
  FROM users
  WHERE id = auth.uid();

  IF v_my_team_id IS NULL THEN
    RAISE EXCEPTION 'User has no team';
  END IF;

  -- No self-referral
  IF v_referrer_team_id = v_my_team_id THEN
    RAISE EXCEPTION 'Cannot refer your own team';
  END IF;

  -- Already referred check (UNIQUE constraint will also catch this)
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_team_id = v_my_team_id) THEN
    RAISE EXCEPTION 'Team has already been referred';
  END IF;

  INSERT INTO referrals (referrer_team_id, referred_team_id)
  VALUES (v_referrer_team_id, v_my_team_id);
END;
$$;

-- ============================================================
-- 6. claim_referral_rewards – grant pending rewards
-- ============================================================

CREATE OR REPLACE FUNCTION claim_referral_rewards()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_team_id uuid;
  v_owner_id uuid;
  v_claimed_count int;
  v_current_expires timestamptz;
  v_new_expires timestamptz;
BEGIN
  v_owner_id := auth.uid();

  -- Get caller's team (must be owner)
  SELECT t.id INTO v_my_team_id
  FROM teams t
  WHERE t.owner_id = v_owner_id;

  IF v_my_team_id IS NULL THEN
    RETURN json_build_object('claimed_count', 0);
  END IF;

  -- Count eligible referrals:
  -- reward not yet granted AND referred team's trial has expired
  SELECT count(*) INTO v_claimed_count
  FROM referrals r
  JOIN teams rt ON rt.id = r.referred_team_id
  WHERE r.referrer_team_id = v_my_team_id
    AND r.reward_granted_at IS NULL
    AND rt.trial_ends_at IS NOT NULL
    AND rt.trial_ends_at < now();

  IF v_claimed_count = 0 THEN
    RETURN json_build_object('claimed_count', 0);
  END IF;

  -- Mark referrals as granted
  UPDATE referrals
  SET reward_granted_at = now()
  WHERE referrer_team_id = v_my_team_id
    AND reward_granted_at IS NULL
    AND referred_team_id IN (
      SELECT rt.id FROM teams rt
      WHERE rt.trial_ends_at IS NOT NULL
        AND rt.trial_ends_at < now()
    );

  -- Calculate new expiry: extend from MAX(current expires, now())
  SELECT expires_at INTO v_current_expires
  FROM manual_subscriptions
  WHERE user_id = v_owner_id;

  IF v_current_expires IS NOT NULL AND v_current_expires > now() THEN
    v_new_expires := v_current_expires + (v_claimed_count || ' months')::interval;
  ELSE
    v_new_expires := now() + (v_claimed_count || ' months')::interval;
  END IF;

  -- UPSERT manual subscription
  INSERT INTO manual_subscriptions (user_id, plan_type, expires_at, reason)
  VALUES (v_owner_id, 'pro', v_new_expires, 'referral_reward')
  ON CONFLICT (user_id) DO UPDATE SET
    plan_type = 'pro',
    expires_at = v_new_expires,
    reason = CASE
      WHEN manual_subscriptions.reason IS NULL THEN 'referral_reward'
      WHEN manual_subscriptions.reason LIKE '%referral_reward%' THEN manual_subscriptions.reason
      ELSE manual_subscriptions.reason || ', referral_reward'
    END;

  RETURN json_build_object('claimed_count', v_claimed_count);
END;
$$;

-- ============================================================
-- 7. get_referral_stats – stats for the calling owner
-- ============================================================

CREATE OR REPLACE FUNCTION get_referral_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_team_id uuid;
  v_referral_code text;
  v_total_referred int;
  v_rewards_earned int;
  v_pending_rewards int;
BEGIN
  -- Get caller's team
  SELECT t.id, t.referral_code INTO v_my_team_id, v_referral_code
  FROM teams t
  WHERE t.owner_id = auth.uid();

  IF v_my_team_id IS NULL THEN
    RETURN json_build_object(
      'referral_code', null,
      'total_referred', 0,
      'rewards_earned', 0,
      'pending_rewards', 0
    );
  END IF;

  SELECT count(*) INTO v_total_referred
  FROM referrals WHERE referrer_team_id = v_my_team_id;

  SELECT count(*) INTO v_rewards_earned
  FROM referrals WHERE referrer_team_id = v_my_team_id AND reward_granted_at IS NOT NULL;

  SELECT count(*) INTO v_pending_rewards
  FROM referrals r
  JOIN teams rt ON rt.id = r.referred_team_id
  WHERE r.referrer_team_id = v_my_team_id
    AND r.reward_granted_at IS NULL
    AND (rt.trial_ends_at IS NULL OR rt.trial_ends_at >= now());

  RETURN json_build_object(
    'referral_code', v_referral_code,
    'total_referred', v_total_referred,
    'rewards_earned', v_rewards_earned,
    'pending_rewards', v_pending_rewards
  );
END;
$$;
