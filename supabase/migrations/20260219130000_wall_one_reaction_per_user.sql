-- Wall reactions: limit to 1 reaction per user per post
-- Clean up existing duplicates (keep the latest per user per post)
DELETE FROM public.wall_reactions
WHERE id NOT IN (
  SELECT DISTINCT ON (post_id, user_id) id
  FROM public.wall_reactions
  ORDER BY post_id, user_id, created_at DESC
);

-- Drop old unique constraint on (post_id, user_id, emoji)
ALTER TABLE public.wall_reactions DROP CONSTRAINT IF EXISTS wall_reactions_unique;

-- Add new unique constraint on (post_id, user_id) — one reaction per user per post
ALTER TABLE public.wall_reactions ADD CONSTRAINT wall_reactions_one_per_user UNIQUE (post_id, user_id);
