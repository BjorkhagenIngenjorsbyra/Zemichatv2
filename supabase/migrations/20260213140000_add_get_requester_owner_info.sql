-- ============================================================
-- get_requester_owner_info: Returns team owner info for given user IDs
-- Used by Team Owners to see who is responsible for friend requesters
-- ============================================================

CREATE OR REPLACE FUNCTION get_requester_owner_info(user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  team_name text,
  owner_display_name text,
  owner_email text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id AS user_id,
    t.name AS team_name,
    owner_u.display_name AS owner_display_name,
    au.email AS owner_email
  FROM unnest(user_ids) AS req(id)
  JOIN users u ON u.id = req.id
  JOIN teams t ON t.id = u.team_id
  JOIN users owner_u ON owner_u.id = t.owner_id
  JOIN auth.users au ON au.id = t.owner_id;
$$;

-- Only authenticated users can call this function
REVOKE ALL ON FUNCTION get_requester_owner_info(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_requester_owner_info(uuid[]) TO authenticated;
