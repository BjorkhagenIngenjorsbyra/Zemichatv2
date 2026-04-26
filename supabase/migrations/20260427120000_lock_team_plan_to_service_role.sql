-- Audit fix #20: prevent clients from updating teams.plan / teams.trial_ends_at.
--
-- RevenueCat is the sole source of truth for subscriptions. Updates flow
-- through the revenuecat-webhook edge function with service-role rights,
-- which bypass RLS. The Owner can still rename their team, change description,
-- etc., but plan and trial state are off limits to client UPDATEs.
--
-- We keep startFreeTrial() working by adding a SECURITY DEFINER RPC
-- (start_team_trial_for_owner) that the Owner can call to set trial_ends_at
-- exactly once when no trial has run yet.

-- ============================================================
-- 1. Replace the broad teams_update_owner policy with a strict variant
-- ============================================================

DROP POLICY IF EXISTS teams_update_owner ON teams;

-- Owner can update their team but NEW.plan and NEW.trial_ends_at must
-- match the existing values (no plan/trial mutations from the client).
-- The trick: we move plan/trial into a guard trigger because RLS
-- WITH CHECK cannot reference OLD.

CREATE POLICY teams_update_owner ON teams
  FOR UPDATE USING (
    owner_id = auth.uid()
  ) WITH CHECK (
    owner_id = auth.uid()
  );

-- ============================================================
-- 2. Trigger that blocks plan / trial_ends_at changes outside service-role
-- ============================================================

CREATE OR REPLACE FUNCTION block_client_team_plan_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Service role / triggers / SECURITY DEFINER funcs run with role = postgres
  -- or supabase_admin. Authenticated client requests run with role 'authenticated'.
  -- Allow non-authenticated roles (service_role, postgres) through unconditionally.
  IF current_setting('role', true) NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'teams.plan cannot be modified by clients. Use the RevenueCat webhook.';
  END IF;

  IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'teams.trial_ends_at cannot be modified by clients. Use start_team_trial_for_owner() or the webhook.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_block_client_plan ON teams;
CREATE TRIGGER teams_block_client_plan
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION block_client_team_plan_changes();

-- ============================================================
-- 3. RPC that lets the Owner start a free trial exactly once
-- ============================================================
--
-- Replaces the direct UPDATE on teams.trial_ends_at performed by the old
-- subscription.ts:startFreeTrial(). Constraint: the team must have plan=free
-- and no trial_ends_at set. After this RPC is called, the next state change
-- has to come from a RevenueCat webhook event.

CREATE OR REPLACE FUNCTION start_team_trial_for_owner(
  trial_days int DEFAULT 10
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_existing_trial timestamptz;
  v_existing_plan text;
  v_new_trial_ends_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trial_days IS NULL OR trial_days <= 0 OR trial_days > 30 THEN
    RAISE EXCEPTION 'trial_days must be between 1 and 30';
  END IF;

  SELECT t.id, t.trial_ends_at, t.plan
    INTO v_team_id, v_existing_trial, v_existing_plan
  FROM teams t
  WHERE t.owner_id = v_uid;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Only Owners can start a trial';
  END IF;

  IF v_existing_plan <> 'free' THEN
    RAISE EXCEPTION 'Team is already on a paid plan';
  END IF;

  IF v_existing_trial IS NOT NULL AND v_existing_trial > now() THEN
    -- Trial already running — return existing end-time, idempotent.
    RETURN v_existing_trial;
  END IF;

  v_new_trial_ends_at := now() + (trial_days || ' days')::interval;

  UPDATE teams
    SET trial_ends_at = v_new_trial_ends_at,
        updated_at = now()
    WHERE id = v_team_id;

  RETURN v_new_trial_ends_at;
END;
$$;

GRANT EXECUTE ON FUNCTION start_team_trial_for_owner(int) TO authenticated;
