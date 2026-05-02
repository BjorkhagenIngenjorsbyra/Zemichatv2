-- Issue #34: Reactions — max one emoji per user per message (overwrite on new)
--
-- Behaviour: WhatsApp/iMessage style. When a user picks a new emoji on a
-- message, it replaces the old one rather than being added alongside it.
--
-- This migration:
--   1. Cleans up any existing duplicate reactions (keeping the most recent
--      reaction per (message_id, user_id) pair).
--   2. Drops the old unique constraint on (message_id, user_id, emoji)
--      from the initial schema.
--   3. Adds a new unique constraint on (message_id, user_id) so the database
--      enforces the one-reaction-per-user invariant.
--
-- The migration is idempotent — re-running it on a database that already has
-- the new constraint is a no-op.

-- 1. De-duplicate: keep the latest reaction per (message_id, user_id).
--    Older duplicates are removed before we tighten the constraint.
DELETE FROM public.message_reactions
WHERE id NOT IN (
  SELECT DISTINCT ON (message_id, user_id) id
  FROM public.message_reactions
  ORDER BY message_id, user_id, created_at DESC
);

-- 2. Drop the old constraint on (message_id, user_id, emoji) if present.
--    The default name PostgreSQL assigned to the inline UNIQUE in
--    20260205090232_initial_schema.sql is
--    `message_reactions_message_id_user_id_emoji_key`.
ALTER TABLE public.message_reactions
  DROP CONSTRAINT IF EXISTS message_reactions_message_id_user_id_emoji_key;

-- 3. Add the new (message_id, user_id) unique constraint, but only if it
--    is not already present (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_reactions_one_per_user'
      AND conrelid = 'public.message_reactions'::regclass
  ) THEN
    ALTER TABLE public.message_reactions
      ADD CONSTRAINT message_reactions_one_per_user
      UNIQUE (message_id, user_id);
  END IF;
END $$;
