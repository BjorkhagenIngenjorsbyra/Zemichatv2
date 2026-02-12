-- Add is_paused column to users table.
-- Paused members cannot log in but are not deactivated.
-- Used when trial expires and team exceeds the free plan member limit.

ALTER TABLE public.users
  ADD COLUMN is_paused boolean NOT NULL DEFAULT false;

-- Allow Owner to read the paused state (already covered by existing SELECT policies).
-- Update policies need to allow setting is_paused.
-- The existing users_update_owner policy already permits partial updates on users
-- in the same team, so no new policy is needed.
