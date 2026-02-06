-- Call signals for real-time incoming call notifications
-- This table stores temporary signals used to notify users of incoming calls

CREATE TABLE call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  call_log_id uuid NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES users(id),
  signal_type text NOT NULL CHECK (signal_type IN ('ring', 'cancel', 'decline', 'busy')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by chat
CREATE INDEX idx_call_signals_chat ON call_signals(chat_id);
CREATE INDEX idx_call_signals_caller ON call_signals(caller_id);
CREATE INDEX idx_call_signals_expires ON call_signals(expires_at);

-- Enable RLS
ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;

-- Chat members can see signals for their chats
CREATE POLICY call_signals_select_member ON call_signals FOR SELECT
  USING (
    chat_id IN (
      SELECT chat_id FROM chat_members
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

-- Team Owner can see signals for chats where their Texters participate
CREATE POLICY call_signals_select_owner ON call_signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'owner'
        AND chat_id IN (
          SELECT cm.chat_id FROM chat_members cm
          JOIN users texter ON texter.id = cm.user_id
          WHERE texter.team_id = u.team_id
            AND texter.role = 'texter'
            AND cm.left_at IS NULL
        )
    )
  );

-- Callers can insert signals
CREATE POLICY call_signals_insert_caller ON call_signals FOR INSERT
  WITH CHECK (caller_id = auth.uid());

-- Callers can delete their own signals (for cancel)
CREATE POLICY call_signals_delete_caller ON call_signals FOR DELETE
  USING (caller_id = auth.uid());

-- Receivers can delete signals (for decline/answer)
CREATE POLICY call_signals_delete_receiver ON call_signals FOR DELETE
  USING (
    chat_id IN (
      SELECT chat_id FROM chat_members
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

-- Enable realtime for call signals
ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;

-- Also enable realtime for call_logs if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'call_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
  END IF;
END $$;
