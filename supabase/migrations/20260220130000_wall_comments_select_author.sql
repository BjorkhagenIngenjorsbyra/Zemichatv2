-- Fix: allow comment author to see their own comments
-- Required for INSERT + .select().single() to work (PostgREST needs a
-- passing SELECT policy on the new row after mutation).
CREATE POLICY wall_comments_select_author ON public.wall_comments
  FOR SELECT USING (author_id = auth.uid());
