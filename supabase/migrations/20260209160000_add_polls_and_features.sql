-- Migration: Add polls, marked_unread, muted_until
-- Supports features: Polls/Voting, Mute with duration, Mark as unread

-- ============================================================
-- 1. chat_members additions
-- ============================================================

ALTER TABLE chat_members
  ADD COLUMN IF NOT EXISTS marked_unread boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted_until timestamptz;

-- ============================================================
-- 2. polls tables
-- ============================================================

CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  question text NOT NULL,
  allows_multiple boolean NOT NULL DEFAULT false,
  is_anonymous boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, option_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_polls_chat_id ON polls(chat_id);
CREATE INDEX IF NOT EXISTS idx_polls_message_id ON polls(message_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON poll_votes(option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON poll_votes(user_id);

-- ============================================================
-- 3. Enable RLS
-- ============================================================

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies for polls
-- ============================================================

-- polls: SELECT – chat members can see polls
CREATE POLICY polls_select_member ON polls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = polls.chat_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- polls: INSERT – chat members can create polls
CREATE POLICY polls_insert_member ON polls
  FOR INSERT WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = polls.chat_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- poll_options: SELECT – can see options for visible polls
CREATE POLICY poll_options_select_member ON poll_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM polls p
      JOIN chat_members cm ON cm.chat_id = p.chat_id
      WHERE p.id = poll_options.poll_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- poll_options: INSERT – poll creator can add options
CREATE POLICY poll_options_insert_creator ON poll_options
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls p
      WHERE p.id = poll_options.poll_id
        AND p.creator_id = auth.uid()
    )
  );

-- poll_votes: SELECT – chat members can see votes
CREATE POLICY poll_votes_select_member ON poll_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM polls p
      JOIN chat_members cm ON cm.chat_id = p.chat_id
      WHERE p.id = poll_votes.poll_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- poll_votes: INSERT – chat members can vote
CREATE POLICY poll_votes_insert_member ON poll_votes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM polls p
      JOIN chat_members cm ON cm.chat_id = p.chat_id
      WHERE p.id = poll_votes.poll_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- poll_votes: DELETE – users can remove own votes
CREATE POLICY poll_votes_delete_own ON poll_votes
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 5. Owner transparency for polls (Owner sees polls in Texter chats)
-- ============================================================

CREATE POLICY polls_select_owner ON polls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'owner'
        AND EXISTS (
          SELECT 1 FROM chat_members cm
          JOIN users t ON t.id = cm.user_id
          WHERE cm.chat_id = polls.chat_id
            AND t.team_id = u.team_id
            AND t.role = 'texter'
            AND cm.left_at IS NULL
        )
    )
  );

CREATE POLICY poll_votes_select_owner ON poll_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM polls p
      JOIN users u ON u.id = auth.uid()
      WHERE p.id = poll_votes.poll_id
        AND u.role = 'owner'
        AND EXISTS (
          SELECT 1 FROM chat_members cm
          JOIN users t ON t.id = cm.user_id
          WHERE cm.chat_id = p.chat_id
            AND t.team_id = u.team_id
            AND t.role = 'texter'
            AND cm.left_at IS NULL
        )
    )
  );
