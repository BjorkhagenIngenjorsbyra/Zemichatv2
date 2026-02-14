-- Repair: The original friend_settings migration (20260213120000) was recorded
-- as applied but failed because it referenced update_updated_at_column()
-- (which doesn't exist). The correct function is update_updated_at().
-- This migration re-creates everything using IF NOT EXISTS / OR REPLACE.

-- ============================================================
-- 1. Create the table (if it doesn't exist)
-- ============================================================

CREATE TABLE IF NOT EXISTS friend_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL DEFAULT '',
  categories TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_user_id)
);

-- ============================================================
-- 2. RLS (drop + recreate to be idempotent)
-- ============================================================

ALTER TABLE friend_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS friend_settings_select_own ON friend_settings;
  DROP POLICY IF EXISTS friend_settings_insert_own ON friend_settings;
  DROP POLICY IF EXISTS friend_settings_update_own ON friend_settings;
  DROP POLICY IF EXISTS friend_settings_delete_own ON friend_settings;
  DROP POLICY IF EXISTS friend_settings_select_owner ON friend_settings;
END $$;

CREATE POLICY friend_settings_select_own ON friend_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY friend_settings_insert_own ON friend_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY friend_settings_update_own ON friend_settings
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY friend_settings_delete_own ON friend_settings
  FOR DELETE USING (user_id = auth.uid());

-- Owner transparency: Owner can read their texters' friend settings
CREATE POLICY friend_settings_select_owner ON friend_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users o
      JOIN users t ON o.team_id = t.team_id
      WHERE o.id = auth.uid() AND o.role = 'owner'
        AND t.id = friend_settings.user_id AND t.role = 'texter'
    )
  );

-- ============================================================
-- 3. Trigger (with the CORRECT function name)
-- ============================================================

DROP TRIGGER IF EXISTS set_friend_settings_updated_at ON friend_settings;

CREATE TRIGGER set_friend_settings_updated_at
  BEFORE UPDATE ON friend_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
