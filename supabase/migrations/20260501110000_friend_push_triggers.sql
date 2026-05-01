-- Issue #7: Push notifications for friend requests.
--
-- When someone sends a friend request, the addressee should get a push
-- notification. When the addressee accepts, the original requester should
-- get a push notification.
--
-- Implementation mirrors notify_new_message (see migration
-- 20260427110000_send_push_shared_secret.sql): SECURITY DEFINER plpgsql
-- function reads the shared secret from Vault, posts to the friend-push
-- edge function via net.http_post with a Bearer header. URL is hardcoded
-- to production with a fallback to a local-dev custom GUC.
--
-- DEPLOYMENT — uses the SAME secret as send-push:
--   - PG_NET_SHARED_SECRET edge env (already configured for send-push)
--   - vault.secrets row name='pg_net_shared_secret' (already configured)
-- No additional secret setup required if send-push is already deployed.
--
-- Auto-team friendships (see 20260210120000_auto_team_friendships.sql) insert
-- with status='accepted' directly. The INSERT trigger only fires on
-- status='pending', so those skip the 'request' event. The UPDATE trigger
-- additionally checks OLD.status='pending' so it only fires on real
-- pending→accepted transitions, not on accepted→accepted no-ops or any
-- future status change starting from accepted.

-- ============================================================
-- 1. Trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  edge_function_url text;
  shared_secret text;
  payload jsonb;
  request_headers jsonb;
  v_recipient_id uuid;
  v_sender_id uuid;
  v_event text;
BEGIN
  -- Decide event + direction based on TG_OP and status transition.
  IF TG_OP = 'INSERT' THEN
    -- Only pending inserts produce a 'request' event. Auto-accepted
    -- team friendships insert directly with status='accepted' and must
    -- be ignored here.
    IF NEW.status <> 'pending' THEN
      RETURN NEW;
    END IF;

    v_event := 'request';
    v_recipient_id := NEW.addressee_id;
    v_sender_id := NEW.requester_id;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only real pending → accepted transitions count. This guards against
    -- accepted-on-insert auto friendships ever surfacing as an 'accepted'
    -- event if some future migration UPDATEs them, and against any other
    -- status flip that happens to land on 'accepted'.
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      v_event := 'accepted';
      -- Notify the original requester that their request went through.
      v_recipient_id := NEW.requester_id;
      v_sender_id := NEW.addressee_id;
    ELSE
      RETURN NEW;
    END IF;

  ELSE
    RETURN NEW;
  END IF;

  -- Edge function URL: prod by default, GUC override for local dev.
  edge_function_url := COALESCE(
    current_setting('app.settings.edge_function_url', true) || '/friend-push',
    'https://qrrorlxocpxvqcfdipbq.supabase.co/functions/v1/friend-push'
  );

  -- Pull shared secret from Vault. Same secret as send-push.
  SELECT decrypted_secret INTO shared_secret
  FROM vault.decrypted_secrets
  WHERE name = 'pg_net_shared_secret'
  LIMIT 1;

  IF shared_secret IS NULL OR shared_secret = '' THEN
    RAISE WARNING 'notify_friend_request: vault secret pg_net_shared_secret not set, skipping push';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'recipient_id', v_recipient_id,
    'sender_id', v_sender_id,
    'event', v_event
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

-- ============================================================
-- 2. Triggers on friendships
-- ============================================================

DROP TRIGGER IF EXISTS notify_friend_request_insert ON public.friendships;
CREATE TRIGGER notify_friend_request_insert
  AFTER INSERT ON public.friendships
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_friend_request();

DROP TRIGGER IF EXISTS notify_friend_request_update ON public.friendships;
CREATE TRIGGER notify_friend_request_update
  AFTER UPDATE OF status ON public.friendships
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted')
  EXECUTE FUNCTION notify_friend_request();
