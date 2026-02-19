-- Fix: wall_comments_insert_member caused infinite recursion (42P17)
-- because the INSERT WITH CHECK subquery on wall_comments triggered
-- the SELECT policy, which in turn queried wall_posts, creating a loop.
-- Fix: use a SECURITY DEFINER helper to check parent comment validity.

CREATE OR REPLACE FUNCTION is_valid_parent_comment(p_parent_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM wall_comments
    WHERE id = p_parent_id
      AND parent_comment_id IS NULL
      AND deleted_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION is_valid_parent_comment TO authenticated;

-- Recreate the INSERT policy using the helper
DROP POLICY IF EXISTS wall_comments_insert_member ON public.wall_comments;

CREATE POLICY wall_comments_insert_member ON public.wall_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM wall_posts wp
      JOIN users u ON u.team_id = wp.team_id AND u.id = auth.uid() AND u.is_active = true
      WHERE wp.id = post_id AND wp.deleted_at IS NULL
    )
    AND (
      parent_comment_id IS NULL
      OR is_valid_parent_comment(parent_comment_id)
    )
  );
