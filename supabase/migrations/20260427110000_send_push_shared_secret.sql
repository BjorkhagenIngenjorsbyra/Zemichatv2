-- Audit fix #19: send-push edge function now requires a shared secret in
-- the Authorization header. The DB trigger here reads the secret from
-- Supabase Vault (krypterat, bara SECURITY DEFINER-funktioner kan läsa)
-- och forwardar det som `Authorization: Bearer <secret>`.
--
-- DEPLOYMENT — båda måste vara satta annars stoppar push:
--   1. Edge Function secret (Supabase Dashboard → Edge Functions → Secrets,
--      eller via `supabase secrets set`):
--        PG_NET_SHARED_SECRET = <random uuid v4>
--   2. Vault-secret med EXAKT samma värde och namnet 'pg_net_shared_secret':
--        SELECT vault.create_secret('<same uuid>', 'pg_net_shared_secret');
--      Eller uppdatera ett existerande:
--        UPDATE vault.secrets SET secret = '<new uuid>'
--          WHERE name = 'pg_net_shared_secret';
--
-- Värdena MÅSTE matcha. 5-minuters message-window-checken i edge-funktionen
-- behålls som defense-in-depth.

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
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

  -- Använd custom setting om satt (local dev), annars hardkodad produktions-URL.
  edge_function_url := COALESCE(
    current_setting('app.settings.edge_function_url', true),
    'https://qrrorlxocpxvqcfdipbq.supabase.co/functions/v1/send-push'
  );

  -- Hämta shared secret från Vault. NULL/saknad rad betyder att operatören
  -- inte slutfört deploy än — bail out istället för att skicka utan auth.
  SELECT decrypted_secret INTO shared_secret
  FROM vault.decrypted_secrets
  WHERE name = 'pg_net_shared_secret'
  LIMIT 1;

  IF shared_secret IS NULL OR shared_secret = '' THEN
    RAISE WARNING 'notify_new_message: vault secret pg_net_shared_secret not set, skipping push';
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
