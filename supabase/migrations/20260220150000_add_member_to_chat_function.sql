-- Fix: chat_members_insert_creator only allows chat creator to add members.
-- Any active member of a chat should be able to add new members.
-- Also: adding a third person to a 1-on-1 chat should convert it to a group.
--
-- Solution: SECURITY DEFINER function that validates membership, inserts
-- the new member, and converts is_group when necessary.

CREATE OR REPLACE FUNCTION add_member_to_chat(p_chat_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is an active member of this chat
  IF NOT EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_id = p_chat_id
      AND user_id = auth.uid()
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  -- Verify caller is active
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User is not active';
  END IF;

  -- Verify target user exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Target user not found or not active';
  END IF;

  -- Verify target is not already a member
  IF EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_id = p_chat_id
      AND user_id = p_user_id
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User is already a member of this chat';
  END IF;

  -- Insert new member
  INSERT INTO chat_members (chat_id, user_id)
  VALUES (p_chat_id, p_user_id);

  -- Convert to group chat if not already
  UPDATE chats
  SET is_group = true
  WHERE id = p_chat_id
    AND is_group = false;
END;
$$;

GRANT EXECUTE ON FUNCTION add_member_to_chat TO authenticated;
