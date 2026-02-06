-- Zemichat v2 – Initial Schema
-- Based on docs/SCHEMA.md
-- Migration order follows SCHEMA.md specification

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

-- PostGIS required for geography type (messages.location, sos_alerts.location)
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- pgcrypto required for password hashing (crypt, gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Set search path to include extensions schema for PostGIS types
SET search_path TO public, extensions;

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

CREATE TYPE plan_type AS ENUM ('free', 'basic', 'pro');
CREATE TYPE user_role AS ENUM ('owner', 'super', 'texter');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE message_type AS ENUM (
  'text',
  'image',
  'voice',
  'video',
  'document',
  'location',
  'contact',
  'system'
);
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'escalated');
CREATE TYPE call_type AS ENUM ('voice', 'video');
CREATE TYPE call_status AS ENUM ('missed', 'answered', 'declined');
CREATE TYPE platform_type AS ENUM ('ios', 'android');

-- ============================================================
-- 2. TEAMS (without owner_id FK – circular dependency)
-- ============================================================

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL, -- FK added after users table
  plan plan_type NOT NULL DEFAULT 'free',
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. USERS
-- ============================================================

CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  zemi_number text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  status_message text,
  last_seen_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_users_zemi_number ON users(zemi_number);

-- ============================================================
-- 4. ADD TEAMS OWNER FK (resolves circular dependency)
-- ============================================================

ALTER TABLE teams
  ADD CONSTRAINT teams_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================
-- 5. TEXTER SETTINGS
-- ============================================================

CREATE TABLE texter_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_send_images boolean NOT NULL DEFAULT true,
  can_send_voice boolean NOT NULL DEFAULT true,
  can_send_video boolean NOT NULL DEFAULT true,
  can_send_documents boolean NOT NULL DEFAULT true,
  can_share_location boolean NOT NULL DEFAULT true,
  can_voice_call boolean NOT NULL DEFAULT true,
  can_video_call boolean NOT NULL DEFAULT true,
  can_screen_share boolean NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  quiet_hours_days int[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. FRIENDSHIPS
-- ============================================================

CREATE TABLE friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);

-- Denied friend requests (Owner can deny for a Texter)
CREATE TABLE denied_friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  denied_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  denied_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(texter_id, denied_user_id)
);

-- ============================================================
-- 7. CHATS
-- ============================================================

CREATE TABLE chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  description text,
  avatar_url text,
  is_group boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chat members (who participates in which chat)
CREATE TABLE chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  is_muted boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  unread_count int NOT NULL DEFAULT 0,
  last_read_at timestamptz,
  UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_chat_members_user ON chat_members(user_id);
CREATE INDEX idx_chat_members_chat ON chat_members(chat_id);

-- ============================================================
-- 8. MESSAGES
-- ============================================================

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  type message_type NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  media_metadata jsonb,
  reply_to_id uuid REFERENCES messages(id),
  forwarded_from_id uuid REFERENCES messages(id),
  location geography(Point, 4326),
  contact_zemi_number text,
  is_edited boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(chat_id, created_at DESC);

-- ============================================================
-- 9. SUPPORTING TABLES
-- ============================================================

-- Message edit history (for Owner transparency)
CREATE TABLE message_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  old_content text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_edits_message ON message_edits(message_id);

-- Message reactions
CREATE TABLE message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);

-- Starred messages
CREATE TABLE starred_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- Read receipts
CREATE TABLE message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_read_receipts_message ON message_read_receipts(message_id);

-- Quick messages / templates
CREATE TABLE quick_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id),
  content text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quick_messages_user ON quick_messages(user_id);

-- Reports
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id),
  reported_user_id uuid REFERENCES users(id),
  reported_message_id uuid REFERENCES messages(id),
  reason text,
  status report_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id),
  escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reported_user_id IS NOT NULL OR reported_message_id IS NOT NULL)
);

CREATE INDEX idx_reports_reported_user ON reports(reported_user_id);

-- SOS alerts
CREATE TABLE sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texter_id uuid NOT NULL REFERENCES users(id),
  location geography(Point, 4326),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sos_alerts_texter ON sos_alerts(texter_id);

-- Call logs
CREATE TABLE call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id),
  initiator_id uuid NOT NULL REFERENCES users(id),
  type call_type NOT NULL,
  status call_status NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int
);

CREATE INDEX idx_call_logs_chat ON call_logs(chat_id);

-- Push tokens
CREATE TABLE push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform platform_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- User sessions
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name text,
  ip_address inet,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);

-- ============================================================
-- 10. FUNCTIONS
-- ============================================================

-- Generate unique Zemi number
CREATE OR REPLACE FUNCTION generate_zemi_number()
RETURNS text AS $$
DECLARE
  new_number text;
  exists_already boolean;
BEGIN
  LOOP
    new_number := 'ZEMI-' ||
      LPAD(floor(random() * 1000)::text, 3, '0') || '-' ||
      LPAD(floor(random() * 1000)::text, 3, '0');

    SELECT EXISTS(SELECT 1 FROM users WHERE zemi_number = new_number) INTO exists_already;

    IF NOT exists_already THEN
      RETURN new_number;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Save message content before edit (for Owner transparency)
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
$$ LANGUAGE plpgsql;

-- Auto-escalate reports after 3 unique reporters
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
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. TRIGGERS
-- ============================================================

-- updated_at triggers
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_texter_settings_updated_at BEFORE UPDATE ON texter_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_push_tokens_updated_at BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Message edit history trigger
CREATE TRIGGER message_edit_trigger BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION save_message_edit();

-- Report escalation trigger
CREATE TRIGGER report_escalation_trigger AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION check_report_escalation();

-- ============================================================
-- 12. ROW LEVEL SECURITY (enable on all tables)
-- ============================================================
-- RLS policies will be added in a separate migration after review.
-- For now, enable RLS on all tables to ensure security by default.

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE texter_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE denied_friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE sos_alerts;
