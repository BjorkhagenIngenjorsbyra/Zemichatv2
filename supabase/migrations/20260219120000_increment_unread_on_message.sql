-- Increment unread_count for all chat members (except sender) when a new message arrives.
-- System messages are excluded. Muted members still get incremented (WhatsApp behavior).

CREATE OR REPLACE FUNCTION increment_unread_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Skip system messages
  IF NEW.type = 'system' THEN
    RETURN NEW;
  END IF;

  UPDATE chat_members
  SET    unread_count = unread_count + 1
  WHERE  chat_id  = NEW.chat_id
    AND  user_id != NEW.sender_id
    AND  left_at  IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message_increment_unread
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_unread_on_message();
