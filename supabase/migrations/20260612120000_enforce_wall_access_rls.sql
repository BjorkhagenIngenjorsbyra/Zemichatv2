-- Enforce per-texter wall access on the SERVER, not just in the client.
--
-- The owner's per-texter `can_access_wall` toggle was only gated in the app
-- (TabLayout hid the tab). wall_posts_select_team granted SELECT to ANY active
-- team member, so a texter with the wall disabled could still read the team
-- wall by calling the API directly. Same for posting. This adds the access
-- check to both the SELECT and INSERT policies so the database enforces it.
--
-- Non-texters (Owner/Super) are unaffected. A missing texter_settings row
-- defaults to allowed, matching the column default (NOT NULL DEFAULT true) and
-- the existing texter_can_send_type() convention.

CREATE OR REPLACE FUNCTION public.can_view_team_wall()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN (SELECT role FROM public.users WHERE id = auth.uid()) <> 'texter' THEN true
    ELSE COALESCE(
      (SELECT can_access_wall FROM public.texter_settings WHERE user_id = auth.uid()),
      true
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_team_wall() TO authenticated;

-- SELECT: team members see the wall, but a texter only if wall access is on.
DROP POLICY IF EXISTS wall_posts_select_team ON public.wall_posts;
CREATE POLICY wall_posts_select_team ON public.wall_posts
  FOR SELECT USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid())
    AND public.can_view_team_wall()
  );

-- INSERT: a texter with the wall disabled must not be able to post either.
-- Recreate the existing insert policy with the access check appended (keeps the
-- media-permission gate from the original add_team_wall migration).
DROP POLICY IF EXISTS wall_posts_insert_member ON public.wall_posts;
CREATE POLICY wall_posts_insert_member ON public.wall_posts
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND is_active = true)
    AND (media_url IS NULL OR can_post_wall_images())
    AND public.can_view_team_wall()
  );
