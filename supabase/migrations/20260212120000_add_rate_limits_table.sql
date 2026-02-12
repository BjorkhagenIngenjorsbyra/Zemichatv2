-- Rate limiting table for Edge Functions
-- Each row = one API call. Edge Functions count recent rows to enforce limits.

CREATE TABLE IF NOT EXISTS rate_limits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text    NOT NULL,
  user_id       uuid    NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Fast lookups: (function_name, user_id, created_at DESC)
CREATE INDEX idx_rate_limits_lookup
  ON rate_limits (function_name, user_id, created_at DESC);

-- Auto-purge rows older than 2 minutes (keeps the table small).
-- Runs every 60 seconds via pg_cron if available, otherwise do manual cleanup.
-- For Supabase hosted, pg_cron is available.

-- Enable RLS (service role only — Edge Functions use service role key)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No public policies — only service role can read/write
-- This prevents users from manipulating their own rate limit records

-- Cleanup function: delete rows older than 2 minutes
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limits WHERE created_at < now() - interval '2 minutes';
$$;

-- Schedule cleanup every minute via pg_cron (Supabase hosted has pg_cron)
-- If pg_cron is not available this will silently fail
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-rate-limits',
      '* * * * *',
      'SELECT cleanup_rate_limits()'
    );
  END IF;
END;
$$;
