-- Extend reports table for the in-app moderation flow.
--
-- The reports table already exists from the initial schema with
-- (reporter_id, reported_user_id, reported_message_id, reason, status).
-- This migration ADDS what the moderation UI / Apple+Google App Review
-- review require, without breaking existing RLS, triggers or tests:
--
--   * a discrete category enum (instead of free-form `reason`)
--   * an optional free-text `description`
--   * a `chat_id` so users can report an entire chat
--   * `reviewed_at` timestamp
--   * extra status values: `resolved`, `dismissed`
--   * a generated `target_type` column so callers can filter on
--     message/chat/user without inspecting which FK is set
--
-- The legacy `reason` column is kept (nullable) so older clients keep
-- working until they ship the new enum.

-- ------------------------------------------------------------------
-- 1. New enum-värden för report_status ('resolved', 'dismissed') ligger
--    i 20260427155900_add_report_status_values.sql för att Postgres ska
--    tillåta dem i denna migrations WITH CHECK-klausuler.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 2. New report_category enum.
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_category') THEN
    CREATE TYPE report_category AS ENUM (
      'inappropriate',
      'harassment',
      'spam',
      'self_harm',
      'illegal',
      'other'
    );
  END IF;
END$$;

-- ------------------------------------------------------------------
-- 3. New columns on reports.
-- ------------------------------------------------------------------
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS category report_category,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS reported_chat_id uuid REFERENCES chats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Cap free-text length so a malicious client can't insert megabytes
-- of text. 2000 chars is plenty for context.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_description_length_chk'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_description_length_chk
      CHECK (description IS NULL OR length(description) <= 2000);
  END IF;
END$$;

-- Allow exactly one of (user, message, chat) to be the target. The
-- legacy CHECK only required user OR message; widen to include chat.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_reported_user_id_check'
      AND conrelid = 'reports'::regclass
  ) THEN
    ALTER TABLE reports DROP CONSTRAINT reports_reported_user_id_check;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_target_present_chk'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_target_present_chk CHECK (
        (reported_user_id IS NOT NULL)::int
        + (reported_message_id IS NOT NULL)::int
        + (reported_chat_id IS NOT NULL)::int
        >= 1
      );
  END IF;
END$$;

-- ------------------------------------------------------------------
-- 4. Generated target_type column for convenience filtering.
-- ------------------------------------------------------------------
-- Priority: message > chat > user (most specific first). This matches
-- how the UI groups reports.
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS target_type text
  GENERATED ALWAYS AS (
    CASE
      WHEN reported_message_id IS NOT NULL THEN 'message'
      WHEN reported_chat_id    IS NOT NULL THEN 'chat'
      WHEN reported_user_id    IS NOT NULL THEN 'user'
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_reports_target_type ON reports(target_type);
CREATE INDEX IF NOT EXISTS idx_reports_chat ON reports(reported_chat_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

-- ------------------------------------------------------------------
-- 5. Update the escalation trigger to count chat / message reports
--    too, and to record reviewed_at.
-- ------------------------------------------------------------------
-- Threshold = 3 unique reporters per (target_type, target_id), only
-- counting non-terminal statuses.
CREATE OR REPLACE FUNCTION check_report_escalation()
RETURNS TRIGGER AS $$
DECLARE
  report_count int := 0;
BEGIN
  IF NEW.reported_message_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT reporter_id) INTO report_count
    FROM reports
    WHERE reported_message_id = NEW.reported_message_id
      AND status IN ('pending', 'reviewed');
    IF report_count >= 3 THEN
      UPDATE reports
      SET status = 'escalated', escalated_at = now()
      WHERE reported_message_id = NEW.reported_message_id
        AND status IN ('pending', 'reviewed');
    END IF;
  ELSIF NEW.reported_chat_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT reporter_id) INTO report_count
    FROM reports
    WHERE reported_chat_id = NEW.reported_chat_id
      AND status IN ('pending', 'reviewed');
    IF report_count >= 3 THEN
      UPDATE reports
      SET status = 'escalated', escalated_at = now()
      WHERE reported_chat_id = NEW.reported_chat_id
        AND status IN ('pending', 'reviewed');
    END IF;
  ELSIF NEW.reported_user_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT reporter_id) INTO report_count
    FROM reports
    WHERE reported_user_id = NEW.reported_user_id
      AND status IN ('pending', 'reviewed');
    IF report_count >= 3 THEN
      UPDATE reports
      SET status = 'escalated', escalated_at = now()
      WHERE reported_user_id = NEW.reported_user_id
        AND status IN ('pending', 'reviewed');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------
-- 6. Touch reviewed_at when an Owner moves a report to reviewed/
--    resolved/dismissed.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_report_reviewed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('reviewed', 'resolved', 'dismissed')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.reviewed_at IS NULL THEN
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS report_reviewed_at_trigger ON reports;
CREATE TRIGGER report_reviewed_at_trigger BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_report_reviewed_at();

-- ------------------------------------------------------------------
-- 7. Extend RLS so chat-target reports are visible to the right
--    Owner — the reporter clause already handles "I see my own".
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS reports_select ON reports;
CREATE POLICY reports_select ON reports
  FOR SELECT USING (
    reporter_id = auth.uid()
    OR is_team_owner_of(reporter_id)
    OR (reported_user_id IS NOT NULL AND is_team_owner_of(reported_user_id))
    OR (
      reported_chat_id IS NOT NULL
      AND auth_user_role() = 'owner'
      AND chat_has_texter_from_team(reported_chat_id, auth_user_team_id())
    )
  );

-- Owner update policy: allow setting status to reviewed/resolved/
-- dismissed for reports the Owner is allowed to see, with reviewed_by
-- pointing at themselves. Escalation stays trigger-driven.
DROP POLICY IF EXISTS reports_update_owner ON reports;
CREATE POLICY reports_update_owner ON reports
  FOR UPDATE USING (
    auth_user_role() = 'owner'
    AND (
      is_team_owner_of(reporter_id)
      OR (reported_user_id IS NOT NULL AND is_team_owner_of(reported_user_id))
      OR (
        reported_chat_id IS NOT NULL
        AND chat_has_texter_from_team(reported_chat_id, auth_user_team_id())
      )
    )
  ) WITH CHECK (
    reviewed_by = auth.uid()
    AND status IN ('reviewed', 'resolved', 'dismissed')
  );

-- ------------------------------------------------------------------
-- 8. Schema reload so PostgREST picks up the new columns.
-- ------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
