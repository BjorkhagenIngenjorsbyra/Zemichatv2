-- Fix: Allow chat creators to see their own chats
-- This is needed because after INSERT, PostgREST tries to return the row
-- but the creator isn't a member yet (chat_members are added after the chat).

CREATE POLICY chats_select_creator ON chats
  FOR SELECT USING (
    created_by = auth.uid()
  );
