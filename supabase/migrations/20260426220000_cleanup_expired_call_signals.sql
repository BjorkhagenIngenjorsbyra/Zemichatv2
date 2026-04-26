-- Cleanup expired call_signals every 5 minutes via pg_cron.
-- Signals have expires_at set on insert (typically a few minutes ahead);
-- without cleanup the table grows unboundedly with stale rows.

CREATE OR REPLACE FUNCTION cleanup_expired_call_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM call_signals
  WHERE expires_at < now();
END;
$$;

-- Schedule cleanup every 5 minutes. pg_cron is already enabled.
-- Use INSERT ... ON CONFLICT to keep this migration idempotent if re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-call-signals'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-expired-call-signals',
      '*/5 * * * *',
      'SELECT cleanup_expired_call_signals();'
    );
  END IF;
END $$;
