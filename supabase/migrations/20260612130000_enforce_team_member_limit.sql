-- Enforce the per-plan team member limit on the SERVER, not just in the client.
--
-- The free/basic/pro member caps (PLAN_FEATURES[plan].maxUsers in the app) were
-- only enforced by a client-side dialog (MemberLimitDialog). A modified client
-- that skips the dialog could add members past the cap. This trigger rejects
-- any insert/move into a team that would exceed the team's plan limit.
--
-- Limits mirror src/types/subscription.ts (free 3, basic 10, pro 10, incl. Owner).
-- Keep the two in sync if the plans change. Inactive users do not consume a slot
-- (matches the dialog's "totalActive" logic).

CREATE OR REPLACE FUNCTION public.enforce_team_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  plan_type;
  v_limit int;
  v_count int;
BEGIN
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only check when actually joining a team (insert) or switching team (update).
  IF TG_OP = 'UPDATE' AND NEW.team_id IS NOT DISTINCT FROM OLD.team_id THEN
    RETURN NEW;
  END IF;

  -- An inactive member does not occupy a slot.
  IF NOT COALESCE(NEW.is_active, true) THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO v_plan FROM public.teams WHERE id = NEW.team_id;
  v_limit := CASE v_plan
    WHEN 'free'  THEN 3
    WHEN 'basic' THEN 10
    WHEN 'pro'   THEN 10
    ELSE 3
  END;

  SELECT count(*) INTO v_count
    FROM public.users
    WHERE team_id = NEW.team_id AND is_active = true AND id <> NEW.id;

  IF v_count + 1 > v_limit THEN
    RAISE EXCEPTION 'team_member_limit_exceeded: plan % allows % active members', v_plan, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_team_member_limit ON public.users;
CREATE TRIGGER trg_enforce_team_member_limit
  BEFORE INSERT OR UPDATE OF team_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_member_limit();
