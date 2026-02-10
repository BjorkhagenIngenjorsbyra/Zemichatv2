-- search_user_by_zemi: SECURITY DEFINER function for cross-team user lookup
--
-- The users table has RLS policies that restrict SELECT to:
--   1. Own profile
--   2. Same-team members
--   3. Accepted friends
--   4. Pending friendship partners
--
-- This means a user cannot find someone from another team to send a friend
-- request. This function bypasses RLS to allow searching by Zemi number,
-- returning only the minimal fields needed for the friend request UI.

CREATE OR REPLACE FUNCTION search_user_by_zemi(p_zemi_number text)
RETURNS TABLE (
  id uuid,
  display_name text,
  zemi_number text,
  avatar_url text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.display_name,
    u.zemi_number,
    u.avatar_url,
    u.role::text
  FROM users u
  WHERE UPPER(u.zemi_number) = UPPER(TRIM(p_zemi_number))
    AND u.is_active = true
    AND u.id != auth.uid();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION search_user_by_zemi(text) TO authenticated;
