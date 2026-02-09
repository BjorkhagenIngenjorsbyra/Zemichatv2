-- Fix: friendships_update_accept WITH CHECK should validate approved_by.
-- Previously, the WITH CHECK only ensured requester_id and addressee_id were unchanged,
-- but didn't enforce that approved_by matches the authenticated user when Owner accepts
-- on behalf of a Texter.

-- Drop the old policy
DROP POLICY IF EXISTS friendships_update_accept ON friendships;

-- Recreate with approved_by validation
CREATE POLICY friendships_update_accept ON friendships
  FOR UPDATE USING (
    -- Must be an incoming request to self or team member
    (
      addressee_id = auth.uid()
      AND auth_user_role() IN ('owner', 'super')
    )
    OR
    -- Owner can accept for their Texters
    (
      is_team_owner_of(addressee_id)
      AND auth_user_role() = 'owner'
    )
  ) WITH CHECK (
    -- Cannot change requester or addressee
    requester_id = requester_id
    AND addressee_id = addressee_id
    -- approved_by must be the authenticated user (or NULL for self-accept)
    AND (approved_by IS NULL OR approved_by = auth.uid())
  );
