-- Team Wall: shared social feed per team
-- Tables: wall_posts, wall_comments, wall_reactions

-- ============================================================
-- HELPER FUNCTION: can_post_wall_images()
-- ============================================================
-- Returns true for Owner/Super, checks texter_settings.can_send_images for Texter.
-- Deny-by-default if texter_settings row is missing.
CREATE OR REPLACE FUNCTION public.can_post_wall_images()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
  _allowed boolean;
BEGIN
  SELECT role INTO _role FROM users WHERE id = auth.uid();
  IF _role IS NULL THEN
    RETURN false;
  END IF;

  IF _role IN ('owner', 'super') THEN
    RETURN true;
  END IF;

  -- Texter: check texter_settings
  SELECT can_send_images INTO _allowed
    FROM texter_settings
    WHERE user_id = auth.uid();

  -- Deny by default if row missing
  RETURN COALESCE(_allowed, false);
END;
$$;

-- ============================================================
-- TABLE: wall_posts
-- ============================================================
CREATE TABLE public.wall_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text,
  media_url text,
  media_metadata jsonb,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT wall_posts_content_or_media CHECK (content IS NOT NULL OR media_url IS NOT NULL)
);

CREATE INDEX idx_wall_posts_team_created ON public.wall_posts (team_id, created_at DESC);
CREATE INDEX idx_wall_posts_author ON public.wall_posts (author_id);

-- Reuse existing trigger for updated_at
CREATE TRIGGER wall_posts_updated_at
  BEFORE UPDATE ON public.wall_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- TABLE: wall_comments
-- ============================================================
CREATE TABLE public.wall_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.wall_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.wall_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wall_comments_post ON public.wall_comments (post_id, created_at);
CREATE INDEX idx_wall_comments_parent ON public.wall_comments (parent_comment_id);

CREATE TRIGGER wall_comments_updated_at
  BEFORE UPDATE ON public.wall_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- TABLE: wall_reactions
-- ============================================================
CREATE TABLE public.wall_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.wall_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT wall_reactions_unique UNIQUE (post_id, user_id, emoji)
);

CREATE INDEX idx_wall_reactions_post ON public.wall_reactions (post_id);

-- ============================================================
-- RLS: Enable
-- ============================================================
ALTER TABLE public.wall_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wall_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wall_reactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS: wall_posts (5 policies)
-- ============================================================

-- SELECT: team members can see posts from their team
CREATE POLICY wall_posts_select_team ON public.wall_posts
  FOR SELECT USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid())
  );

-- SELECT: author can always see own posts (needed for soft-delete UPDATE visibility)
CREATE POLICY wall_posts_select_author ON public.wall_posts
  FOR SELECT USING (
    author_id = auth.uid()
  );

-- INSERT: active team members can create posts
-- If post has media_url, check can_post_wall_images()
CREATE POLICY wall_posts_insert_member ON public.wall_posts
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND is_active = true)
    AND (media_url IS NULL OR can_post_wall_images())
  );

-- UPDATE: author can soft-delete own posts
CREATE POLICY wall_posts_update_soft_delete_author ON public.wall_posts
  FOR UPDATE USING (
    author_id = auth.uid()
    AND deleted_at IS NULL
  ) WITH CHECK (
    deleted_at IS NOT NULL
    AND deleted_by = auth.uid()
  );

-- UPDATE: team owner can soft-delete any post in their team
CREATE POLICY wall_posts_update_soft_delete_owner ON public.wall_posts
  FOR UPDATE USING (
    deleted_at IS NULL
    AND team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'owner')
  ) WITH CHECK (
    deleted_at IS NOT NULL
    AND deleted_by = auth.uid()
  );

-- ============================================================
-- RLS: wall_comments (4 policies)
-- ============================================================

-- SELECT: team members can see comments on posts in their team
CREATE POLICY wall_comments_select_team ON public.wall_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wall_posts wp
      WHERE wp.id = post_id
        AND wp.team_id = (SELECT team_id FROM users WHERE id = auth.uid())
    )
  );

-- INSERT: active team members can comment
-- Enforce 2-level depth: parent_comment_id must be NULL or a top-level comment
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

-- UPDATE: author can soft-delete own comments
CREATE POLICY wall_comments_update_soft_delete_author ON public.wall_comments
  FOR UPDATE USING (
    author_id = auth.uid()
    AND deleted_at IS NULL
  ) WITH CHECK (
    deleted_at IS NOT NULL
    AND deleted_by = auth.uid()
  );

-- UPDATE: team owner can soft-delete any comment
CREATE POLICY wall_comments_update_soft_delete_owner ON public.wall_comments
  FOR UPDATE USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM wall_posts wp
      WHERE wp.id = post_id
        AND wp.team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'owner')
    )
  ) WITH CHECK (
    deleted_at IS NOT NULL
    AND deleted_by = auth.uid()
  );

-- ============================================================
-- RLS: wall_reactions (3 policies)
-- ============================================================

-- SELECT: team members can see reactions on posts in their team
CREATE POLICY wall_reactions_select_team ON public.wall_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wall_posts wp
      WHERE wp.id = post_id
        AND wp.team_id = (SELECT team_id FROM users WHERE id = auth.uid())
    )
  );

-- INSERT: active team members can react to non-deleted posts
CREATE POLICY wall_reactions_insert_member ON public.wall_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM wall_posts wp
      JOIN users u ON u.team_id = wp.team_id AND u.id = auth.uid() AND u.is_active = true
      WHERE wp.id = post_id AND wp.deleted_at IS NULL
    )
  );

-- DELETE: users can remove their own reactions
CREATE POLICY wall_reactions_delete_own ON public.wall_reactions
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- ============================================================
-- STORAGE: wall media policies on chat-media bucket
-- ============================================================

-- INSERT: users can upload to their own wall/ path if permitted
CREATE POLICY wall_media_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] = 'wall'
    AND can_post_wall_images()
  );

-- SELECT: team members can read wall media from same-team users
CREATE POLICY wall_media_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[2] = 'wall'
    AND EXISTS (
      SELECT 1 FROM users u1
      JOIN users u2 ON u1.team_id = u2.team_id
      WHERE u1.id = auth.uid()
        AND u2.id = (storage.foldername(name))[1]::uuid
    )
  );

-- ============================================================
-- REALTIME: add tables to publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_reactions;
