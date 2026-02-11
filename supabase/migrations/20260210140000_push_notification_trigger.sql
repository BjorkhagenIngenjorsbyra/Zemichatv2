-- ============================================================
-- Push Notification Trigger
-- Fires an HTTP request to the send-push Edge Function
-- whenever a new message is inserted.
-- ============================================================

-- 1. Enable pg_net extension for async HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Grant usage to postgres role (needed for triggers)
GRANT USAGE ON SCHEMA net TO postgres;

-- 3. Create the trigger function
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
  payload jsonb;
  truncated_content text;
BEGIN
  -- Skip system messages (e.g., "User joined", "Chat created")
  IF NEW.type = 'system' THEN
    RETURN NEW;
  END IF;

  -- Read config from app settings
  edge_function_url := current_setting('app.settings.edge_function_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not configured, skip silently
  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

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

  -- Fire-and-forget HTTP POST to Edge Function
  PERFORM net.http_post(
    url := edge_function_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  );

  RETURN NEW;
END;
$$;

-- 4. Attach trigger on messages INSERT
CREATE TRIGGER on_new_message_send_push
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- 5. App settings for the trigger
-- These must be set via the Supabase Dashboard SQL Editor (runs as superuser):
--
--   ALTER DATABASE postgres SET "app.settings.edge_function_url"
--     = 'https://<project-ref>.supabase.co/functions/v1/send-push';
--   ALTER DATABASE postgres SET "app.settings.service_role_key"
--     = '<your-service-role-key>';
--
-- For local dev, run these manually after supabase db reset:
--   ALTER DATABASE postgres SET "app.settings.edge_function_url"
--     = 'http://host.docker.internal:54321/functions/v1/send-push';
--   ALTER DATABASE postgres SET "app.settings.service_role_key"
--     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
