-- Fix: ambiguous overload of update_user_profile.
--
-- Two signatures coexisted because CREATE OR REPLACE cannot change a function's
-- argument list:
--   * update_user_profile(new_display_name TEXT)            -- gdpr_compliance / input_length_validation
--   * update_user_profile(new_display_name TEXT, new_avatar_url TEXT)  -- add_avatar_upload
--
-- Both arguments on the 2-arg version default to NULL, so an RPC call that
-- passes only new_display_name matches BOTH overloads. PostgREST then returns
-- "Could not choose the best candidate function between: ..." and the raw error
-- surfaced in the profile UI (and profile saves failed).
--
-- The 2-arg version is a strict superset (it validates and COALESCEs both
-- columns) and covers every call site (display_name update + avatar update),
-- so we drop the redundant 1-arg overload to leave a single unambiguous function.
DROP FUNCTION IF EXISTS public.update_user_profile(TEXT);

-- Keep the canonical grant in place (no-op if already granted).
GRANT EXECUTE ON FUNCTION public.update_user_profile(TEXT, TEXT) TO authenticated;
