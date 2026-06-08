-- Snapshot each chat member's display name onto chat_members.
--
-- Why: a 1-on-1 chat can outlive the relationship that made the other person's
-- profile visible (e.g. after unfriending, users RLS no longer exposes their
-- row). The chat then loses the ability to show who you talked to. By snapshotting
-- the name onto the membership row — which a chat member can always read — the
-- name survives as evidence ("Tidigare kontakt (Kalle)") without loosening any
-- RLS on the users table.
--
-- The snapshot tracks the live name while the membership exists (kept fresh by a
-- trigger on users), and naturally freezes at the last-known value once the
-- relationship/visibility ends.

ALTER TABLE public.chat_members ADD COLUMN IF NOT EXISTS display_name text;

-- Backfill existing rows from the current user names.
UPDATE public.chat_members cm
SET display_name = u.display_name
FROM public.users u
WHERE u.id = cm.user_id
  AND cm.display_name IS DISTINCT FROM u.display_name;

-- Capture the name when a membership is created.
CREATE OR REPLACE FUNCTION public.chat_member_capture_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.display_name IS NULL THEN
    SELECT u.display_name INTO NEW.display_name
    FROM public.users u
    WHERE u.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_member_capture_display_name ON public.chat_members;
CREATE TRIGGER trg_chat_member_capture_display_name
  BEFORE INSERT ON public.chat_members
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_member_capture_display_name();

-- Keep snapshots fresh while the user's name is known/changing.
CREATE OR REPLACE FUNCTION public.sync_chat_member_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_members
  SET display_name = NEW.display_name
  WHERE user_id = NEW.id
    AND display_name IS DISTINCT FROM NEW.display_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_member_display_name ON public.users;
CREATE TRIGGER trg_sync_chat_member_display_name
  AFTER UPDATE OF display_name ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_chat_member_display_name();
