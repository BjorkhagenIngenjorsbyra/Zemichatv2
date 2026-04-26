-- Audit fix #19: send-push edge function now requires a shared secret in
-- the Authorization header. The DB trigger here reads the secret from a
-- runtime GUC and forwards it as `Authorization: Bearer <secret>`.
--
-- DEPLOYMENT — both must be set, otherwise push notifications stop working:
--   1. Edge Function secret (Supabase Dashboard → Edge Functions → Secrets):
--        PG_NET_SHARED_SECRET = <random uuid v4>
--   2. Database setting (run once in the SQL editor against production):
--        ALTER DATABASE postgres
--          SET app.settings.pg_net_shared_secret = '<same uuid>';
--
-- The two values MUST match. Generate with `uuidgen` or `gen_random_uuid()`.
-- The 5-minute message-window check inside the edge function is kept as a
-- defense-in-depth layer.

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  edge_function_url text;
  shared_secret text;
  payload jsonb;
  truncated_content text;
  request_headers jsonb;
BEGIN
  -- Skip system messages
  IF NEW.type = 'system' THEN
    RETURN NEW;
  END IF;

  -- Use custom setting if available (local dev), otherwise hardcoded production URL.
  edge_function_url := COALESCE(
    current_setting('app.settings.edge_function_url', true),
    'https://qrrorlxocpxvqcfdipbq.supabase.co/functions/v1/send-push'
  );

  -- Shared secret for the edge function. NULL/empty means the operator has
  -- not finished the migration yet — bail out rather than firing an
  -- unauthenticated request.
  shared_secret := current_setting('app.settings.pg_net_shared_secret', true);
  IF shared_secret IS NULL OR shared_secret = '' THEN
    RAISE WARNING 'notify_new_message: app.settings.pg_net_shared_secret not set, skipping push';
    RETURN NEW;
  END IF;

  truncated_content := LEFT(COALESCE(NEW.content, ''), 200);

  payload := jsonb_build_object(
    'message_id', NEW.id,
    'chat_id', NEW.chat_id,
    'sender_id', NEW.sender_id,
    'message_type', NEW.type,
    'content', truncated_content
  );

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || shared_secret
  );

  PERFORM net.http_post(
    url := edge_function_url,
    body := payload,
    headers := request_headers
  );

  RETURN NEW;
END;
$$;
