-- Allow Owner to see the user profile of anyone who has sent a
-- pending friend request to one of the Owner's Texters.
-- This is needed for the OwnerApprovals page: the owner queries
-- friendships (visible via friendships_select_owner), but then
-- needs to load the requester's profile. Without this policy the
-- requester (from another team) is invisible to the owner.
CREATE POLICY users_select_texter_pending_requester ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'pending'
        AND f.requester_id = users.id
        AND is_team_owner_of(f.addressee_id)
    )
  );
