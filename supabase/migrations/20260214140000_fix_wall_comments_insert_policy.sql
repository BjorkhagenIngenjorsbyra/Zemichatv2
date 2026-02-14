-- Repair: wall_comments_insert_member had a self-referencing bug.
-- `pc.id = parent_comment_id` resolved to `pc.id = pc.parent_comment_id`
-- because both the policy target and subquery are `wall_comments`.
-- Fix: qualify as `wall_comments.parent_comment_id` to reference the NEW row.

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
      OR EXISTS (
        SELECT 1 FROM wall_comments pc
        WHERE pc.id = wall_comments.parent_comment_id
          AND pc.parent_comment_id IS NULL
          AND pc.deleted_at IS NULL
      )
    )
  );
