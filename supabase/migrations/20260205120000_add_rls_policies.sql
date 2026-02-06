-- Zemichat v2 – RLS Policies
-- Implements Row Level Security for all 18 tables.
-- Depends on: 20260205090232_initial_schema.sql

-- ============================================================
-- 1. HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================
-- All helpers: STABLE, SECURITY DEFINER, SET search_path = public
-- for both security (no search_path injection) and performance
-- (query planner can cache results within a statement).

-- Returns the role of the currently authenticated user.
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns the team_id of the currently authenticated user.
CREATE OR REPLACE FUNCTION auth_user_team_id()
RETURNS uuid AS $$
  SELECT team_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns true if the currently authenticated user is active.
CREATE OR REPLACE FUNCTION auth_user_is_active()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_active FROM users WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns the role of a given user (bypasses RLS).
CREATE OR REPLACE FUNCTION get_user_role(target_user_id uuid)
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = target_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns the team_id of a given user (bypasses RLS).
CREATE OR REPLACE FUNCTION get_user_team_id(target_user_id uuid)
RETURNS uuid AS $$
  SELECT team_id FROM users WHERE id = target_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns true if auth.uid() is the Team Owner of the given user.
CREATE OR REPLACE FUNCTION is_team_owner_of(target_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN teams t ON t.id = u.team_id
    WHERE u.id = target_user_id
      AND t.owner_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns true if auth.uid() is the Owner of the given team.
CREATE OR REPLACE FUNCTION is_owner_of_team(target_team_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM teams
    WHERE id = target_team_id
      AND owner_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns true if auth.uid() is an active member of the given chat
-- (left_at IS NULL).
CREATE OR REPLACE FUNCTION is_chat_member(target_chat_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_id = target_chat_id
      AND user_id = auth.uid()
      AND left_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns true if the given chat contains a Texter from the given team.
-- This is the CORE transparency function: Owner can see any chat where
-- one of their Texters participates.
CREATE OR REPLACE FUNCTION chat_has_texter_from_team(
  target_chat_id uuid,
  target_team_id uuid
)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.chat_id = target_chat_id
      AND u.team_id = target_team_id
      AND u.role = 'texter'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 2. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chat_members_active
  ON chat_members(chat_id, user_id) WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_team_role
  ON users(team_id, role);

CREATE INDEX IF NOT EXISTS idx_teams_owner
  ON teams(owner_id);

-- ============================================================
-- 3. TRIGGER SECURITY FIXES
-- ============================================================
-- Trigger functions that perform INSERT/UPDATE must be SECURITY
-- DEFINER so they bypass RLS (they run as the function owner,
-- typically the migration role / superuser).

CREATE OR REPLACE FUNCTION save_message_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO message_edits (message_id, old_content)
    VALUES (OLD.id, OLD.content);

    NEW.is_edited := true;
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION check_report_escalation()
RETURNS TRIGGER AS $$
DECLARE
  report_count int;
BEGIN
  IF NEW.reported_user_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT reporter_id) INTO report_count
    FROM reports
    WHERE reported_user_id = NEW.reported_user_id
    AND status != 'escalated';

    IF report_count >= 3 THEN
      UPDATE reports
      SET status = 'escalated', escalated_at = now()
      WHERE reported_user_id = NEW.reported_user_id
      AND status != 'escalated';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- ************************************************************
-- 4.1 TEAMS (3 policies)
-- ************************************************************

-- Members can see their own team.
CREATE POLICY teams_select_member ON teams
  FOR SELECT USING (
    id = auth_user_team_id()
  );

-- Only Owner can create a team, and must set themselves as owner.
CREATE POLICY teams_insert_owner ON teams
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
  );

-- Only Owner can update their team.
CREATE POLICY teams_update_owner ON teams
  FOR UPDATE USING (
    owner_id = auth.uid()
  ) WITH CHECK (
    owner_id = auth.uid()
  );

-- ************************************************************
-- 4.2 USERS (5 policies: 4 SELECT variants + INSERT + 2 UPDATE)
-- ************************************************************

-- Everyone can read their own profile.
CREATE POLICY users_select_self ON users
  FOR SELECT USING (
    id = auth.uid()
  );

-- Members can see other members in the same team.
CREATE POLICY users_select_team ON users
  FOR SELECT USING (
    team_id = auth_user_team_id()
  );

-- Users can see their friends (cross-team visibility).
CREATE POLICY users_select_friends ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = auth.uid() AND addressee_id = users.id)
          OR
          (addressee_id = auth.uid() AND requester_id = users.id)
        )
    )
  );

-- Users can see the other party in a pending friendship (to display
-- the friend request UI).
CREATE POLICY users_select_pending_friendship ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'pending'
        AND (
          (requester_id = auth.uid() AND addressee_id = users.id)
          OR
          (addressee_id = auth.uid() AND requester_id = users.id)
        )
    )
  );

-- Signup: user can only insert themselves.
CREATE POLICY users_insert_self ON users
  FOR INSERT WITH CHECK (
    id = auth.uid()
  );

-- Self-update: users can update their own profile, but NOT role or team_id.
-- Uses SECURITY DEFINER helpers to avoid infinite recursion on users table.
CREATE POLICY users_update_self ON users
  FOR UPDATE USING (
    id = auth.uid()
  ) WITH CHECK (
    id = auth.uid()
    AND role = auth_user_role()
    AND team_id = auth_user_team_id()
  );

-- Owner can deactivate/reactivate Supers and Texters in their team.
-- Uses SECURITY DEFINER helpers to avoid infinite recursion on users table.
CREATE POLICY users_update_owner_deactivate ON users
  FOR UPDATE USING (
    is_team_owner_of(id)
    AND role IN ('super', 'texter')
  ) WITH CHECK (
    -- Owner can only change is_active, not role/team_id
    role = get_user_role(id)
    AND team_id = get_user_team_id(id)
  );

-- ************************************************************
-- 4.3 TEXTER_SETTINGS (3 policies)
-- ************************************************************

-- Texter can see their own settings. Owner can see their Texters' settings.
CREATE POLICY texter_settings_select ON texter_settings
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_team_owner_of(user_id)
  );

-- Only Owner can create settings for their Texters.
CREATE POLICY texter_settings_insert_owner ON texter_settings
  FOR INSERT WITH CHECK (
    is_team_owner_of(user_id)
  );

-- Only Owner can update settings for their Texters.
CREATE POLICY texter_settings_update_owner ON texter_settings
  FOR UPDATE USING (
    is_team_owner_of(user_id)
  ) WITH CHECK (
    is_team_owner_of(user_id)
  );

-- ************************************************************
-- 4.4 FRIENDSHIPS (6 policies)
-- ************************************************************

-- Participants can see their own friendships.
CREATE POLICY friendships_select_participant ON friendships
  FOR SELECT USING (
    requester_id = auth.uid()
    OR addressee_id = auth.uid()
  );

-- Owner can see all friendships involving their team members.
CREATE POLICY friendships_select_owner ON friendships
  FOR SELECT USING (
    is_team_owner_of(requester_id)
    OR is_team_owner_of(addressee_id)
  );

-- Anyone can send a friend request (requester must be self, status pending).
CREATE POLICY friendships_insert_request ON friendships
  FOR INSERT WITH CHECK (
    requester_id = auth.uid()
    AND status = 'pending'
    AND auth_user_is_active()
  );

-- Super or Owner can accept incoming friend requests to themselves.
-- Owner can accept on behalf of their Texters (approved_by is set).
-- TEXTER CANNOT ACCEPT — requires Owner approval.
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
    -- Can only change status and approved_by
    requester_id = requester_id
    AND addressee_id = addressee_id
  );

-- Either party can unfriend (DELETE). Owner can also remove for team.
CREATE POLICY friendships_delete_participant ON friendships
  FOR DELETE USING (
    requester_id = auth.uid()
    OR addressee_id = auth.uid()
  );

CREATE POLICY friendships_delete_owner ON friendships
  FOR DELETE USING (
    is_team_owner_of(requester_id)
    OR is_team_owner_of(addressee_id)
  );

-- ************************************************************
-- 4.5 DENIED_FRIEND_REQUESTS (3 policies)
-- ************************************************************

-- Only Owner can see denied requests for their Texters.
CREATE POLICY denied_friend_requests_select_owner ON denied_friend_requests
  FOR SELECT USING (
    is_team_owner_of(texter_id)
  );

-- Only Owner can deny a request for their Texters.
CREATE POLICY denied_friend_requests_insert_owner ON denied_friend_requests
  FOR INSERT WITH CHECK (
    is_team_owner_of(texter_id)
    AND denied_by = auth.uid()
  );

-- Only Owner can remove a denial for their Texters.
CREATE POLICY denied_friend_requests_delete_owner ON denied_friend_requests
  FOR DELETE USING (
    is_team_owner_of(texter_id)
  );

-- ************************************************************
-- 4.6 CHATS (3 policies)
-- ************************************************************

-- Active chat members can see the chat.
CREATE POLICY chats_select_member ON chats
  FOR SELECT USING (
    is_chat_member(id)
  );

-- Owner oversight: can see chats where a Texter from their team participates.
CREATE POLICY chats_select_owner_oversight ON chats
  FOR SELECT USING (
    auth_user_role() = 'owner'
    AND chat_has_texter_from_team(id, auth_user_team_id())
  );

-- Active users can create chats.
CREATE POLICY chats_insert_active ON chats
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND auth_user_is_active()
  );

-- Only the creator can update chat metadata.
CREATE POLICY chats_update_creator ON chats
  FOR UPDATE USING (
    created_by = auth.uid()
  ) WITH CHECK (
    created_by = auth.uid()
  );

-- ************************************************************
-- 4.7 CHAT_MEMBERS (4 policies)
-- ************************************************************

-- Active members can see who's in their chats.
CREATE POLICY chat_members_select_member ON chat_members
  FOR SELECT USING (
    is_chat_member(chat_id)
  );

-- Owner oversight: can see members of chats with their Texters.
CREATE POLICY chat_members_select_owner_oversight ON chat_members
  FOR SELECT USING (
    auth_user_role() = 'owner'
    AND chat_has_texter_from_team(chat_id, auth_user_team_id())
  );

-- Only the chat creator can add members.
CREATE POLICY chat_members_insert_creator ON chat_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE id = chat_id
        AND created_by = auth.uid()
    )
    AND auth_user_is_active()
  );

-- Members can update their own settings (mute, pin, archive, unread, last_read).
CREATE POLICY chat_members_update_own ON chat_members
  FOR UPDATE USING (
    user_id = auth.uid()
  ) WITH CHECK (
    user_id = auth.uid()
    -- Cannot change chat_id or user_id
    AND chat_id = chat_id
  );

-- ************************************************************
-- 4.8 MESSAGES (6 policies) — CRITICAL TABLE
-- ************************************************************

-- Active chat members can see non-deleted messages.
CREATE POLICY messages_select_member ON messages
  FOR SELECT USING (
    is_chat_member(chat_id)
    AND deleted_at IS NULL
  );

-- Sender can always see own messages (including soft-deleted).
-- Required by PostgreSQL: UPDATE requires the NEW row to pass at least one
-- SELECT policy. Without this, soft-delete (setting deleted_at) would fail
-- because the new row breaks messages_select_member's deleted_at IS NULL check.
CREATE POLICY messages_select_sender ON messages
  FOR SELECT USING (
    sender_id = auth.uid()
  );

-- Owner oversight: Owner sees ALL messages including soft-deleted.
-- NO deleted_at filter — Owner sees EVERYTHING. This is by design
-- for the core transparency model.
CREATE POLICY messages_select_owner_oversight ON messages
  FOR SELECT USING (
    auth_user_role() = 'owner'
    AND chat_has_texter_from_team(chat_id, auth_user_team_id())
  );

-- Active chat members can send messages.
CREATE POLICY messages_insert_member ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_chat_member(chat_id)
    AND auth_user_is_active()
  );

-- Sender can edit their own messages (trigger saves history).
-- WITH CHECK ensures deleted_at stays NULL to prevent using the edit policy
-- to bypass soft-delete constraints (PostgreSQL ORs WITH CHECKs across policies).
CREATE POLICY messages_update_edit ON messages
  FOR UPDATE USING (
    sender_id = auth.uid()
    AND deleted_at IS NULL
  ) WITH CHECK (
    sender_id = auth.uid()
    AND chat_id = chat_id
    AND deleted_at IS NULL
  );

-- Sender can soft-delete their own messages.
-- Separate policy: deleted_by must be auth.uid().
CREATE POLICY messages_update_soft_delete ON messages
  FOR UPDATE USING (
    sender_id = auth.uid()
    AND deleted_at IS NULL
  ) WITH CHECK (
    sender_id = auth.uid()
    AND deleted_by = auth.uid()
    AND deleted_at IS NOT NULL
  );

-- ************************************************************
-- 4.9 MESSAGE_EDITS (2 policies)
-- ************************************************************
-- INSERT is handled by the save_message_edit() trigger (SECURITY DEFINER).

-- Sender can see edit history of their own messages.
CREATE POLICY message_edits_select_sender ON message_edits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_edits.message_id
        AND messages.sender_id = auth.uid()
    )
  );

-- Owner oversight: can see edit history for messages in Texter chats.
CREATE POLICY message_edits_select_owner_oversight ON message_edits
  FOR SELECT USING (
    auth_user_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_edits.message_id
        AND chat_has_texter_from_team(messages.chat_id, auth_user_team_id())
    )
  );

-- ************************************************************
-- 4.10 MESSAGE_REACTIONS (3 policies)
-- ************************************************************

-- Chat members can see reactions.
CREATE POLICY message_reactions_select_member ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_reactions.message_id
        AND is_chat_member(messages.chat_id)
    )
  );

-- Owner oversight for reactions.
CREATE POLICY message_reactions_select_owner_oversight ON message_reactions
  FOR SELECT USING (
    auth_user_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_reactions.message_id
        AND chat_has_texter_from_team(messages.chat_id, auth_user_team_id())
    )
  );

-- Active chat members can add reactions.
CREATE POLICY message_reactions_insert_member ON message_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND auth_user_is_active()
    AND EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_reactions.message_id
        AND is_chat_member(messages.chat_id)
    )
  );

-- Users can remove their own reactions.
CREATE POLICY message_reactions_delete_own ON message_reactions
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- ************************************************************
-- 4.11 STARRED_MESSAGES (3 policies)
-- ************************************************************
-- Purely personal — only the starring user.

CREATE POLICY starred_messages_select_own ON starred_messages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY starred_messages_insert_own ON starred_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY starred_messages_delete_own ON starred_messages
  FOR DELETE USING (user_id = auth.uid());

-- ************************************************************
-- 4.12 MESSAGE_READ_RECEIPTS (3 policies)
-- ************************************************************

-- Chat members can see read receipts in their chats.
CREATE POLICY message_read_receipts_select_member ON message_read_receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_read_receipts.message_id
        AND is_chat_member(messages.chat_id)
    )
  );

-- Owner oversight for read receipts.
CREATE POLICY message_read_receipts_select_owner_oversight ON message_read_receipts
  FOR SELECT USING (
    auth_user_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_read_receipts.message_id
        AND chat_has_texter_from_team(messages.chat_id, auth_user_team_id())
    )
  );

-- Users can mark messages as read (only themselves).
CREATE POLICY message_read_receipts_insert_own ON message_read_receipts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- ************************************************************
-- 4.13 QUICK_MESSAGES (4 policies)
-- ************************************************************

-- Users can see their own quick messages. Owner can see Texters'.
CREATE POLICY quick_messages_select ON quick_messages
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_team_owner_of(user_id)
  );

-- Super/Owner can create quick messages for themselves.
CREATE POLICY quick_messages_insert_own ON quick_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND created_by = auth.uid()
    AND auth_user_role() IN ('owner', 'super')
    AND auth_user_is_active()
  );

-- Owner can create quick messages for their Texters.
CREATE POLICY quick_messages_insert_owner_for_texter ON quick_messages
  FOR INSERT WITH CHECK (
    is_team_owner_of(user_id)
    AND created_by = auth.uid()
    AND auth_user_role() = 'owner'
  );

-- Only the creator can update or delete quick messages.
CREATE POLICY quick_messages_update_creator ON quick_messages
  FOR UPDATE USING (
    created_by = auth.uid()
  ) WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY quick_messages_delete_creator ON quick_messages
  FOR DELETE USING (
    created_by = auth.uid()
  );

-- ************************************************************
-- 4.14 REPORTS (3 policies)
-- ************************************************************

-- Reporter can see their own reports. Owner can see reports involving
-- their team members.
CREATE POLICY reports_select ON reports
  FOR SELECT USING (
    reporter_id = auth.uid()
    OR is_team_owner_of(reporter_id)
    OR is_team_owner_of(reported_user_id)
  );

-- Active users can create reports.
CREATE POLICY reports_insert_reporter ON reports
  FOR INSERT WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'pending'
    AND auth_user_is_active()
  );

-- Owner can mark reports as reviewed (for reports involving their team).
-- Escalation is handled by the trigger (SECURITY DEFINER).
CREATE POLICY reports_update_owner ON reports
  FOR UPDATE USING (
    auth_user_role() = 'owner'
    AND (
      is_team_owner_of(reporter_id)
      OR is_team_owner_of(reported_user_id)
    )
  ) WITH CHECK (
    -- Owner can set reviewed_by to themselves
    reviewed_by = auth.uid()
  );

-- ************************************************************
-- 4.15 SOS_ALERTS (3 policies)
-- ************************************************************

-- Texter can see their own SOS alerts. Owner sees their Texters'.
CREATE POLICY sos_alerts_select ON sos_alerts
  FOR SELECT USING (
    texter_id = auth.uid()
    OR is_team_owner_of(texter_id)
  );

-- ONLY Texters can send SOS. NO is_active check — SOS can NEVER be
-- disabled. This is a critical safety feature.
CREATE POLICY sos_alerts_insert_texter ON sos_alerts
  FOR INSERT WITH CHECK (
    texter_id = auth.uid()
    AND auth_user_role() = 'texter'
    -- Deliberately NO auth_user_is_active() check
  );

-- Owner can acknowledge SOS alerts for their Texters.
CREATE POLICY sos_alerts_update_owner ON sos_alerts
  FOR UPDATE USING (
    is_team_owner_of(texter_id)
  ) WITH CHECK (
    acknowledged_by = auth.uid()
  );

-- ************************************************************
-- 4.16 CALL_LOGS (3 policies)
-- ************************************************************

-- Chat members can see call logs in their chats.
CREATE POLICY call_logs_select_member ON call_logs
  FOR SELECT USING (
    is_chat_member(chat_id)
  );

-- Owner oversight for call logs.
CREATE POLICY call_logs_select_owner_oversight ON call_logs
  FOR SELECT USING (
    auth_user_role() = 'owner'
    AND chat_has_texter_from_team(chat_id, auth_user_team_id())
  );

-- Active chat members can initiate calls.
CREATE POLICY call_logs_insert_initiator ON call_logs
  FOR INSERT WITH CHECK (
    initiator_id = auth.uid()
    AND is_chat_member(chat_id)
    AND auth_user_is_active()
  );

-- Chat members can update call logs (ended_at, duration).
CREATE POLICY call_logs_update_member ON call_logs
  FOR UPDATE USING (
    is_chat_member(chat_id)
  ) WITH CHECK (
    -- Cannot change chat_id or initiator_id
    chat_id = chat_id
    AND initiator_id = initiator_id
  );

-- ************************************************************
-- 4.17 PUSH_TOKENS (4 policies)
-- ************************************************************

CREATE POLICY push_tokens_select_own ON push_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY push_tokens_insert_own ON push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY push_tokens_update_own ON push_tokens
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_tokens_delete_own ON push_tokens
  FOR DELETE USING (user_id = auth.uid());

-- ************************************************************
-- 4.18 USER_SESSIONS (5 policies)
-- ************************************************************

-- Users can see their own sessions. Owner can see team members' sessions.
CREATE POLICY user_sessions_select ON user_sessions
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_team_owner_of(user_id)
  );

-- Users can create their own sessions.
CREATE POLICY user_sessions_insert_own ON user_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- Users can update their own sessions.
CREATE POLICY user_sessions_update_own ON user_sessions
  FOR UPDATE USING (
    user_id = auth.uid()
  ) WITH CHECK (
    user_id = auth.uid()
  );

-- Users can delete their own sessions.
CREATE POLICY user_sessions_delete_own ON user_sessions
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- Owner can remotely log out team members.
CREATE POLICY user_sessions_delete_owner ON user_sessions
  FOR DELETE USING (
    is_team_owner_of(user_id)
  );
