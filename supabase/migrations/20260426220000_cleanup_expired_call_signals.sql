-- Cleanup expired call_signals.
-- Signals have expires_at set on insert (typically a few minutes ahead);
-- without cleanup the table grows unboundedly with stale rows.
--
-- Aktivering av schemaläggning:
-- 1) Aktivera pg_cron i Supabase Dashboard → Database → Extensions
-- 2) Kör manuellt:
--    SELECT cron.schedule(
--      'cleanup-expired-call-signals', '*/5 * * * *',
--      'SELECT cleanup_expired_call_signals();'
--    );
-- Tills dess kan funktionen anropas manuellt eller från en Edge Function.

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
