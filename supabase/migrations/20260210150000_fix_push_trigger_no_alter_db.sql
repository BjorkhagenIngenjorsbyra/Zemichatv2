-- ============================================================
-- Fix push notification trigger: remove ALTER DATABASE dependency
--
-- Strategy: Hardcode the production Edge Function URL directly
-- in the trigger. No auth header needed — the Edge Function
-- validates the payload by checking the message exists in the DB
-- using its built-in SUPABASE_SERVICE_ROLE_KEY env var.
--
-- For local dev, override via:
--   ALTER DATABASE postgres SET "app.settings.edge_function_url"
--     = 'http://host.docker.internal:54321/functions/v1/send-push';
-- ============================================================

-- Drop old trigger first
DROP TRIGGER IF EXISTS on_new_message_send_push ON messages;

-- Replace trigger function
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  edge_function_url text;
  payload jsonb;
  truncated_content text;
BEGIN
  -- Skip system messages
  IF NEW.type = 'system' THEN
    RETURN NEW;
  END IF;

  -- Use custom setting if available (local dev), otherwise hardcoded production URL
  edge_function_url := COALESCE(
    current_setting('app.settings.edge_function_url', true),
    'https://qrrorlxocpxvqcfdipbq.supabase.co/functions/v1/send-push'
  );

  -- Truncate content to 200 chars for the notification preview
  truncated_content := LEFT(COALESCE(NEW.content, ''), 200);

  -- Build JSON payload
  payload := jsonb_build_object(
    'message_id', NEW.id,
    'chat_id', NEW.chat_id,
    'sender_id', NEW.sender_id,
    'message_type', NEW.type,
    'content', truncated_content
  );

  -- Fire-and-forget HTTP POST to Edge Function (no auth header needed)
  PERFORM net.http_post(
    url := edge_function_url,
    body := payload,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_new_message_send_push
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();
