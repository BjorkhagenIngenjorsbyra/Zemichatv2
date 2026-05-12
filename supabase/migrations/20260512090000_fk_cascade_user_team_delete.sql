-- ============================================================
-- Migration: ON DELETE policy on FKs touching users/teams/chats
-- Issue: #41 (https://github.com/BjorkhagenIngenjorsbyra/Zemichatv2/issues/41)
-- ============================================================
--
-- WHY
-- ---
-- During team-delete-testing 2026-05-05 Erik tried to delete the team
-- "Flickorna Holmgrenz" plus its users via the Supabase Admin API. The
-- DELETE auth.users call walked into 11 FK-violations (23503), because the
-- corresponding constraints were created without `ON DELETE CASCADE` or
-- `ON DELETE SET NULL`. Every "delete my account" path in the client hits
-- the same wall.
--
-- This migration normalises ON DELETE policy across the 11 constraints
-- called out in the issue:
--
--   CASCADE   – the child row is meaningless without the parent
--   SET NULL  – the child row should survive but lose its reference
--
-- | FK                                | Action     | Rationale                                                            |
-- | --------------------------------- | ---------- | -------------------------------------------------------------------- |
-- | poll_votes.user_id                | CASCADE    | a vote belongs to a user; if user is gone the vote is meaningless     |
-- | polls.creator_id                  | SET NULL   | the poll itself survives, but creator becomes "[Borttagen användare]" |
-- | message_reactions.user_id         | CASCADE    | reaction is per-user, no value without owner                          |
-- | message_read_receipts.user_id     | CASCADE    | read receipt is per-user                                              |
-- | messages.sender_id                | SET NULL   | preserve transcript history; render "Borttagen användare"             |
-- | chat_members.user_id              | CASCADE    | membership is the join row; without user it has no meaning            |
-- | push_tokens.user_id               | CASCADE    | token is device-per-user                                              |
-- | texter_settings.user_id           | CASCADE    | settings row is per-user                                              |
-- | call_logs.chat_id                 | CASCADE    | call log is per-chat; chat deletion takes call history with it        |
-- | call_logs.initiator_id            | SET NULL   | preserve historic call entries when initiator is removed              |
-- | chats.created_by                  | SET NULL   | chat survives owner removal so members keep their conversation        |
--
-- Several of these constraints (chat_members.user_id, push_tokens.user_id,
-- texter_settings.user_id, message_reactions.user_id,
-- message_read_receipts.user_id) already had ON DELETE CASCADE in the
-- initial schema, but the issue reporter encountered FK violations on the
-- production cluster — meaning either an early ad-hoc migration ran on
-- prod without going through the migrations folder, or the constraint
-- was recreated under a different name. We re-assert the policy on all
-- 11 constraints regardless so prod and migrations agree.
--
-- The migration is idempotent: every statement looks up the existing FK
-- in `pg_constraint`, drops it, and recreates it with the correct policy.
-- If the constraint is already in the desired state it gets recreated
-- with the same definition — cheap, no data movement.
--
-- DDL transactionality: Postgres wraps each migration file in an implicit
-- transaction, so a failure in any step rolls the whole file back.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Helper: drop FK by (table, column) and recreate with policy
-- ------------------------------------------------------------
-- We use a DO block per constraint so the migration handles both the
-- "constraint exists under the default name" case and the "constraint
-- was renamed somewhere along the line" case. The lookup is on the
-- (table, column) pair rather than the constraint name.
--
-- `find_fk_name` returns the conname for a single-column FK on the
-- requested table+column. If no FK is found the DO block raises so we
-- notice rather than silently no-op.

CREATE OR REPLACE FUNCTION pg_temp.find_fk_name(
  p_schema text,
  p_table  text,
  p_column text
)
RETURNS text
LANGUAGE plpgsql
AS $func$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname
    INTO v_conname
    FROM pg_constraint c
    JOIN pg_class      t ON t.oid = c.conrelid
    JOIN pg_namespace  n ON n.oid = t.relnamespace
    JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
   WHERE c.contype = 'f'
     AND n.nspname = p_schema
     AND t.relname = p_table
     AND a.attname = p_column
     AND array_length(c.conkey, 1) = 1
   LIMIT 1;
  RETURN v_conname;
END
$func$;

-- ------------------------------------------------------------
-- 1. poll_votes.user_id → auth.users(id) ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'poll_votes', 'user_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on poll_votes.user_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.poll_votes DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.poll_votes
    ADD CONSTRAINT poll_votes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- ------------------------------------------------------------
-- 2. polls.creator_id → auth.users(id) ON DELETE SET NULL
--    Drop NOT NULL so SET NULL is legal.
-- ------------------------------------------------------------
ALTER TABLE public.polls ALTER COLUMN creator_id DROP NOT NULL;

DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'polls', 'creator_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on polls.creator_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.polls DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.polls
    ADD CONSTRAINT polls_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
END $$;

-- ------------------------------------------------------------
-- 3. message_reactions.user_id → users(id) ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'message_reactions', 'user_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on message_reactions.user_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.message_reactions DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
END $$;

-- ------------------------------------------------------------
-- 4. message_read_receipts.user_id → users(id) ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'message_read_receipts', 'user_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on message_read_receipts.user_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.message_read_receipts DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
END $$;

-- ------------------------------------------------------------
-- 5. messages.sender_id → users(id) ON DELETE SET NULL
--    Drop NOT NULL so SET NULL is legal. Client renders
--    "Borttagen användare" when sender is null.
-- ------------------------------------------------------------
ALTER TABLE public.messages ALTER COLUMN sender_id DROP NOT NULL;

DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'messages', 'sender_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on messages.sender_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- ------------------------------------------------------------
-- 6. chat_members.user_id → users(id) ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'chat_members', 'user_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on chat_members.user_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.chat_members DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.chat_members
    ADD CONSTRAINT chat_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
END $$;

-- ------------------------------------------------------------
-- 7. push_tokens.user_id → users(id) ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'push_tokens', 'user_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on push_tokens.user_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.push_tokens DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
END $$;

-- ------------------------------------------------------------
-- 8. texter_settings.user_id → users(id) ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'texter_settings', 'user_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on texter_settings.user_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.texter_settings DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.texter_settings
    ADD CONSTRAINT texter_settings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
END $$;

-- ------------------------------------------------------------
-- 9. call_logs.chat_id → chats(id) ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'call_logs', 'chat_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on call_logs.chat_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.call_logs DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.call_logs
    ADD CONSTRAINT call_logs_chat_id_fkey
    FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;
END $$;

-- ------------------------------------------------------------
-- 10. call_logs.initiator_id → users(id) ON DELETE SET NULL
--     Drop NOT NULL so SET NULL is legal.
-- ------------------------------------------------------------
ALTER TABLE public.call_logs ALTER COLUMN initiator_id DROP NOT NULL;

DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'call_logs', 'initiator_id');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on call_logs.initiator_id not found';
  END IF;
  EXECUTE format('ALTER TABLE public.call_logs DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.call_logs
    ADD CONSTRAINT call_logs_initiator_id_fkey
    FOREIGN KEY (initiator_id) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- ------------------------------------------------------------
-- 11. chats.created_by → users(id) ON DELETE SET NULL
--     Drop NOT NULL so SET NULL is legal.
-- ------------------------------------------------------------
ALTER TABLE public.chats ALTER COLUMN created_by DROP NOT NULL;

DO $$
DECLARE c_name text;
BEGIN
  c_name := pg_temp.find_fk_name('public', 'chats', 'created_by');
  IF c_name IS NULL THEN
    RAISE EXCEPTION 'FK on chats.created_by not found';
  END IF;
  EXECUTE format('ALTER TABLE public.chats DROP CONSTRAINT %I', c_name);
  ALTER TABLE public.chats
    ADD CONSTRAINT chats_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- find_fk_name is a temp function (pg_temp.*) so it disappears when the
-- migration's session ends — no cleanup needed.

COMMIT;
